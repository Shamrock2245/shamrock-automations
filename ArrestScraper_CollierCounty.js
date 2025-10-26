/*************************************************
 * Collier County Arrest Scraper (v1.0)
 * Entry point: runCollierArrestsNow
 * - HTML parsing from ASP.NET WebForms page
 * - Upsert by County + Booking_Number
 * - Auto-scoring and qualified arrests sync
 * - Triggers + menu integration
 **************************************************/

// ========== CONFIG ==========
function getCollierConfig_() {
  var base = {
    SHEET_ID: '1jq1-N7sCbwSiYPLAdI2ZnxhLzym1QsOSuHPy-Gw07Qc',
    TAB_NAME: 'Collier_County_Arrests',
    QUALIFIED_SHEET_ID: '1_8jmb3UsbDNWoEtD2_5O27JNvXKBExrQq2pG0W-mPJI',
    QUALIFIED_TAB: 'Collier County Qualified Arrests',
    TIMEZONE: 'America/New_York',
    BASE_URL: 'https://www2.colliersheriff.org/arrestsearch/Report.aspx',
    DAYS_BACK: 3,
    MAX_CELL_LEN: 49000,
    DETAIL_DELAY_MS: 500,
    MAX_EXECUTION_MS: 330000
  };
  
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.COLLIER) {
      var o = CONFIG.COLLIER;
      for (var k in o) base[k] = o[k];
    }
  } catch (_) {}
  
  return base;
}

var COLLIER = getCollierConfig_();

// ========== MENU & TRIGGERS ==========
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🟩 Bail Suite')
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Arrests (Collier)')
      .addItem('▶️ Run now', 'runCollierArrestsNow')
      .addItem('⏰ Install 30-min trigger', 'installCollierTrigger')
      .addItem('🛑 Disable triggers', 'disableCollierTriggers'))
    .addToUi();
}

function installCollierTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runCollierArrestsNow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runCollierArrestsNow').timeBased().everyMinutes(30).create();
  Logger.log('⏰ Installed 30-minute trigger for runCollierArrestsNow');
}

function disableCollierTriggers() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runCollierArrestsNow') {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  });
  Logger.log('🛑 Removed ' + n + ' trigger(s) for runCollierArrestsNow');
}

// ========== ENTRY ==========
function runCollierArrestsNow() {
  var startMs = Date.now();
  var lock = LockService.getScriptLock();
  
  if (!lock.tryLock(30000)) {
    Logger.log('🚫 Another run is in progress.');
    return;
  }
  
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('🚦 Starting Collier County Arrest Scraper');
    Logger.log('═══════════════════════════════════════');
    
    var sheet = getOrCreateCollierSheet_();
    var existing = loadExistingCollierBookings_(sheet);
    Logger.log('📚 Existing rows: ' + existing.size);
    
    var end = new Date();
    var start = new Date(end.getTime() - (COLLIER.DAYS_BACK * 86400000));
    Logger.log('📅 Date range: ' + formatCollierDate_(start) + ' to ' + formatCollierDate_(end));
    
    var arrests = fetchCollierArrests_(start, end);
    Logger.log('📥 Total fetched: ' + arrests.length);
    
    var newOnes = arrests.filter(function(a) {
      return a && a.bookingNumber && !existing.has('Collier-' + String(a.bookingNumber).trim());
    });
    Logger.log('📥 New arrests: ' + newOnes.length);
    
    if (newOnes.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      upsertCollierStrict_(sheet, newOnes);
      Logger.log('✅ Wrote new rows: ' + newOnes.length);
      
      var endRow = sheet.getLastRow();
      
      // Auto-score new arrests
      if (typeof autoScoreNewArrests === 'function') {
        Logger.log('📊 Auto-scoring new arrests...');
        try {
          autoScoreNewArrests(startRow, endRow);
        } catch (e) {
          Logger.log('⚠️ Auto-scoring failed: ' + e.message);
        }
      }
      
      // Auto-generate search links
      if (typeof autoGenerateSearchLinksForNewArrests === 'function') {
        Logger.log('🔍 Auto-generating search links...');
        try {
          autoGenerateSearchLinksForNewArrests(startRow, endRow);
        } catch (e) {
          Logger.log('⚠️ Search link generation failed: ' + e.message);
        }
      }
      
      // Sync qualified arrests
      if (typeof syncQualifiedArrests === 'function' && CONFIG.QUALIFIED_ARRESTS && CONFIG.QUALIFIED_ARRESTS.AUTO_SYNC) {
        Logger.log('🎯 Auto-syncing qualified arrests...');
        try {
          syncQualifiedArrests();
        } catch (e) {
          Logger.log('⚠️ Qualified arrests sync failed: ' + e.message);
        }
      }
    } else {
      Logger.log('ℹ️ No new rows to write.');
    }
    
    var duration = Math.round((Date.now() - startMs) / 1000);
    Logger.log('⏱️ Total execution time: ' + duration + ' seconds');
    Logger.log('═══════════════════════════════════════');
    
  } catch (e) {
    Logger.log('❌ Fatal: ' + (e && e.stack ? e.stack : e));
    throw e;
  } finally {
    lock.releaseLock();
  }
}

// ========== SHEET OPERATIONS ==========
function getOrCreateCollierSheet_() {
  var ss = SpreadsheetApp.openById(COLLIER.SHEET_ID);
  var sheet = ss.getSheetByName(COLLIER.TAB_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(COLLIER.TAB_NAME);
    var headers = collierHeaders_();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    Logger.log('✅ Created new sheet: ' + COLLIER.TAB_NAME);
  }
  
  return sheet;
}

function collierHeaders_() {
  return [
    'County', 'Person_ID', 'Booking_Number', 'Full_Name', 'Last_Name', 'First_Name', 
    'Middle_Name', 'Suffix', 'DOB', 'Age', 'Sex', 'Race', 'Height', 'Weight', 
    'Hair_Color', 'Eye_Color', 'Address', 'City', 'State', 'ZIP', 'Booking_Date', 
    'Booking_Time', 'Release_Date', 'Release_Time', 'Status', 'Charges', 'Bond_Amount', 
    'Bond_Type', 'Bond_Paid', 'Case_Number', 'Court_Date', 'Court_Time', 'Court_Type', 
    'Court_Location', 'Agency', 'Arresting_Officer', 'Facility', 'Notes', 
    'Detail_URL', 'Mugshot_URL', 'Lead_Score', 'Lead_Status', 'Scraped_At',
    'Google_Search', 'Facebook_Search', 'TruePeopleSearch'
  ];
}

function loadExistingCollierBookings_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  
  var bookingCol = 3; // Booking_Number column
  var data = sheet.getRange(2, bookingCol, lastRow - 1, 1).getValues();
  var set = new Set();
  
  for (var i = 0; i < data.length; i++) {
    if (data[i][0]) {
      set.add('Collier-' + String(data[i][0]).trim());
    }
  }
  
  return set;
}

function upsertCollierStrict_(sheet, arrests) {
  if (!arrests || !arrests.length) return;
  
  var headers = collierHeaders_();
  var rows = [];
  
  for (var i = 0; i < arrests.length; i++) {
    var a = arrests[i];
    var row = [];
    
    for (var j = 0; j < headers.length; j++) {
      var h = headers[j];
      var val = a[h] || '';
      
      if (typeof val === 'string' && val.length > COLLIER.MAX_CELL_LEN) {
        val = val.substring(0, COLLIER.MAX_CELL_LEN);
      }
      
      row.push(val);
    }
    
    rows.push(row);
  }
  
  if (rows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
    Logger.log('✅ Inserted ' + rows.length + ' rows starting at row ' + startRow);
  }
}

// ========== FETCHING & PARSING ==========
function fetchCollierArrests_(startDate, endDate) {
  Logger.log('📡 Fetching Collier County arrests...');
  
  var url = COLLIER.BASE_URL;
  var resp = httpFetchCollier_(url);
  
  if (!resp || resp.code !== 200) {
    Logger.log('⚠️ Failed to fetch Collier page: HTTP ' + (resp ? resp.code : 'error'));
    return [];
  }
  
  var html = resp.text;
  var arrests = parseCollierHTML_(html);
  
  Logger.log('✅ Parsed ' + arrests.length + ' arrest records');
  
  // Filter by date range
  var filtered = arrests.filter(function(a) {
    if (!a.Booking_Date) return false;
    var bookingDate = parseCollierDateString_(a.Booking_Date);
    return bookingDate >= startDate && bookingDate <= endDate;
  });
  
  Logger.log('✅ Filtered to ' + filtered.length + ' arrests in date range');
  
  return filtered;
}

function parseCollierHTML_(html) {
  var arrests = [];
  
  // Split by arrest record blocks (each starts with Name table)
  var namePattern = /<table[^>]*>\s*<tr[^>]*>\s*<td[^>]*>Name<\/td>/gi;
  var matches = [];
  var match;
  
  while ((match = namePattern.exec(html)) !== null) {
    matches.push(match.index);
  }
  
  for (var i = 0; i < matches.length; i++) {
    var start = matches[i];
    var end = (i < matches.length - 1) ? matches[i + 1] : html.length;
    var block = html.substring(start, end);
    
    try {
      var arrest = parseCollierArrestBlock_(block);
      if (arrest && arrest.Booking_Number) {
        arrests.push(arrest);
      }
    } catch (e) {
      Logger.log('⚠️ Error parsing arrest block: ' + e.message);
    }
  }
  
  return arrests;
}

function parseCollierArrestBlock_(block) {
  var arrest = {
    County: 'Collier',
    Scraped_At: new Date().toISOString()
  };
  
  // Extract Name
  var nameMatch = /<td[^>]*>Name<\/td>\s*<td[^>]*>Date of Birth<\/td>\s*<td[^>]*>Residence<\/td>[\s\S]*?<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/i.exec(block);
  if (nameMatch) {
    arrest.Full_Name = cleanText_(nameMatch[1]);
    arrest.DOB = cleanText_(nameMatch[2]);
    var residence = cleanText_(nameMatch[3]);
    parseCollierResidence_(residence, arrest);
    parseCollierName_(arrest.Full_Name, arrest);
  }
  
  // Extract Description (physical details)
  var aNumMatch = /A#.*?(\d{8})/i.exec(block);
  if (aNumMatch) arrest.Person_ID = aNumMatch[1];
  
  var pinMatch = /PIN.*?(\d{9,10})/i.exec(block);
  if (pinMatch) arrest.PIN = pinMatch[1];
  
  var raceMatch = /Race<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (raceMatch) arrest.Race = cleanText_(raceMatch[1]);
  
  var sexMatch = /Sex<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (sexMatch) arrest.Sex = cleanText_(sexMatch[1]);
  
  var heightMatch = /Height<\/td>\s*<td[^>]*>(\d+)</i.exec(block);
  if (heightMatch) arrest.Height = cleanText_(heightMatch[1]);
  
  var weightMatch = /Weight<\/td>\s*<td[^>]*>(\d+)</i.exec(block);
  if (weightMatch) arrest.Weight = cleanText_(weightMatch[1]);
  
  var hairMatch = /Hair Color<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (hairMatch) arrest.Hair_Color = cleanText_(hairMatch[1]);
  
  var eyeMatch = /Eye Color<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (eyeMatch) arrest.Eye_Color = cleanText_(eyeMatch[1]);
  
  // Extract Booking info
  var bookingDateMatch = /Booking Date<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (bookingDateMatch) arrest.Booking_Date = cleanText_(bookingDateMatch[1]);
  
  var bookingNumberMatch = /Booking Number<\/td>\s*<td[^>]*>(\d+)</i.exec(block);
  if (bookingNumberMatch) arrest.Booking_Number = cleanText_(bookingNumberMatch[1]);
  
  var agencyMatch = /Agency<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (agencyMatch) arrest.Agency = cleanText_(agencyMatch[1]);
  
  var ageMatch = /Age at Arrest<\/td>\s*<td[^>]*>(\d+)</i.exec(block);
  if (ageMatch) arrest.Age = cleanText_(ageMatch[1]);
  
  // Extract Charges
  var chargesPattern = /<tr[^>]*>\s*<td[^>]*>(\d{1,2}\/\d{1,2}\/\d{4})<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
  var charges = [];
  var caseNumbers = [];
  var courtDates = [];
  var chargeMatch;
  
  while ((chargeMatch = chargesPattern.exec(block)) !== null) {
    var chargeDate = cleanText_(chargeMatch[1]);
    var count = cleanText_(chargeMatch[2]);
    var offense = cleanText_(chargeMatch[3]);
    
    charges.push(offense);
    
    // Extract case number and court date from next cells if available
    var casePattern = /<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>(\d{1,2}\/\d{1,2}\/\d{4})?<\/td>/i;
    var caseMatch = casePattern.exec(block.substring(chargeMatch.index + chargeMatch[0].length, chargeMatch.index + chargeMatch[0].length + 200));
    
    if (caseMatch && caseMatch[3]) {
      courtDates.push(cleanText_(caseMatch[3]));
    }
  }
  
  if (charges.length > 0) {
    arrest.Charges = charges.join(' | ');
  }
  
  if (courtDates.length > 0) {
    arrest.Court_Date = courtDates[0]; // Use first court date
  }
  
  // Extract Bond Status
  var bondStatusMatch = /Bond Status<\/td>[\s\S]*?<td[^>]*>([^<]+)</i.exec(block);
  if (bondStatusMatch) {
    var bondStatus = cleanText_(bondStatusMatch[1]);
    arrest.Status = bondStatus;
    
    if (bondStatus.toLowerCase().indexOf('bonded') > -1) {
      arrest.Bond_Paid = 'Yes';
    } else if (bondStatus.toLowerCase().indexOf('no information') > -1) {
      arrest.Bond_Paid = 'Unknown';
    }
  }
  
  // Check for IN CUSTODY status
  if (block.toLowerCase().indexOf('in custody') > -1) {
    arrest.Status = 'In Custody';
  }
  
  // Generate Detail URL
  if (arrest.Booking_Number) {
    arrest.Detail_URL = 'https://www2.colliersheriff.org/arrestsearch/Report.aspx?BookingNumber=' + arrest.Booking_Number;
  }
  
  return arrest;
}

function parseCollierName_(fullName, arrest) {
  if (!fullName) return;
  
  var parts = fullName.split(',');
  if (parts.length >= 2) {
    arrest.Last_Name = cleanText_(parts[0]);
    var firstParts = cleanText_(parts[1]).split(' ');
    arrest.First_Name = firstParts[0] || '';
    
    if (firstParts.length > 1) {
      // Check for suffix
      var suffixes = ['JR', 'SR', 'II', 'III', 'IV', 'V', 'ESQ'];
      var lastPart = firstParts[firstParts.length - 1].toUpperCase().replace(/\./g, '');
      
      if (suffixes.indexOf(lastPart) > -1) {
        arrest.Suffix = firstParts[firstParts.length - 1];
        arrest.Middle_Name = firstParts.slice(1, -1).join(' ');
      } else {
        arrest.Middle_Name = firstParts.slice(1).join(' ');
      }
    }
  } else {
    arrest.Last_Name = fullName;
  }
}

function parseCollierResidence_(residence, arrest) {
  if (!residence) return;
  
  // Format: "FORT MYERS, FL 33967" or "NAPLES, FL 34120"
  var parts = residence.split(',');
  if (parts.length >= 2) {
    arrest.City = cleanText_(parts[0]);
    
    var stateZip = cleanText_(parts[1]).split(' ');
    if (stateZip.length >= 2) {
      arrest.State = stateZip[0];
      arrest.ZIP = stateZip[1];
    }
  }
}

function parseCollierDateString_(dateStr) {
  if (!dateStr) return null;
  
  // Format: "10/25/2025"
  var parts = dateStr.split('/');
  if (parts.length === 3) {
    var month = parseInt(parts[0], 10) - 1;
    var day = parseInt(parts[1], 10);
    var year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  
  return null;
}

// ========== UTILITIES ==========
function httpFetchCollier_(url) {
  var maxRetries = 3;
  var retryDelay = 1000;
  
  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      var options = {
        method: 'get',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        muteHttpExceptions: true,
        followRedirects: true
      };
      
      var response = UrlFetchApp.fetch(url, options);
      var code = response.getResponseCode();
      var text = response.getContentText();
      
      return { code: code, text: text };
      
    } catch (e) {
      Logger.log('⚠️ HTTP fetch attempt ' + attempt + ' failed: ' + e.message);
      if (attempt < maxRetries) {
        Utilities.sleep(retryDelay * attempt);
      }
    }
  }
  
  return null;
}

function cleanText_(text) {
  if (!text) return '';
  return String(text).trim().replace(/\s+/g, ' ');
}

function formatCollierDate_(date) {
  return Utilities.formatDate(date, COLLIER.TIMEZONE, 'MM/dd/yyyy');
}

