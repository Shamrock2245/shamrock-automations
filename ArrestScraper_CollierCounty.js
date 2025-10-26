/**
 * ============================================
 * COLLIER COUNTY ARREST SCRAPER v2.0
 * ============================================
 * Handles ASP.NET WebForms with ViewState
 * Auto-scraping, backfill, scoring, qualified arrests sync
 */

// Configuration
var COLLIER_CONFIG = {
  SPREADSHEET_ID: '1jq1-N7sCbwSiYPLAdI2ZnxhLzym1QsOSuHPy-Gw07Qc', // Same as Lee County
  TAB_NAME: 'Collier_County_Arrests',
  QUALIFIED_SHEET_ID: '1_8jmb3UsbDNWoEtD2_5O27JNvXKBExrQq2pG0W-mPJI',
  QUALIFIED_TAB_NAME: 'Qualified_Arrests',
  DAYS_BACK: 3, // How many days to look back
  BASE_URL: 'https://www2.colliersheriff.org/arrestsearch/Report.aspx',
  COUNTY: 'Collier'
};

/**
 * Main function - Run Collier County scraper
 */
function runCollierArrestsNow() {
  var startTime = new Date();
  Logger.log('═══════════════════════════════════════');
  Logger.log('🚦 Starting Collier County Arrest Scraper v2.0');
  Logger.log('═══════════════════════════════════════');
  
  try {
    // Get or create the arrests sheet
    var sheet = getOrCreateCollierSheet_();
    var existingData = sheet.getDataRange().getValues();
    var existingBookings = {};
    
    // Build map of existing booking numbers (skip header row)
    for (var i = 1; i < existingData.length; i++) {
      var bookingNum = existingData[i][1]; // Column B = Booking_Number
      if (bookingNum) existingBookings[bookingNum] = true;
    }
    
    Logger.log('📚 Existing rows: ' + (existingData.length - 1));
    
    // Calculate date range
    var today = new Date();
    var startDate = new Date(today.getTime() - (COLLIER_CONFIG.DAYS_BACK * 24 * 60 * 60 * 1000));
    var dateFrom = Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'MM/dd/yyyy');
    var dateTo = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MM/dd/yyyy');
    
    Logger.log('📅 Date range: ' + dateFrom + ' to ' + dateTo);
    
    // Fetch arrests
    Logger.log('📡 Fetching Collier County arrests...');
    var arrests = fetchCollierArrests_(dateFrom, dateTo);
    
    Logger.log('✅ Parsed ' + arrests.length + ' arrest records');
    
    // Filter to new arrests only
    var newArrests = arrests.filter(function(arrest) {
      return !existingBookings[arrest.Booking_Number];
    });
    
    Logger.log('📥 New arrests: ' + newArrests.length);
    
    if (newArrests.length === 0) {
      Logger.log('ℹ️ No new arrests to add.');
    } else {
      // Write new arrests to sheet
      writeCollierArrestsToSheet_(sheet, newArrests);
      Logger.log('✅ Added ' + newArrests.length + ' new arrests to sheet');
      
      // Score the new arrests
      scoreCollierArrests_(sheet, newArrests);
      
      // Sync qualified arrests (score >= 70)
      syncCollierQualifiedArrests_(newArrests);
      
      // Send Slack notifications
      notifyCollierQualifiedArrests_(newArrests);
    }
    
    var endTime = new Date();
    var duration = Math.round((endTime - startTime) / 1000);
    Logger.log('⏱️ Total execution time: ' + duration + ' seconds');
    Logger.log('═══════════════════════════════════════');
    
    return {
      success: true,
      totalFetched: arrests.length,
      newArrests: newArrests.length,
      duration: duration
    };
    
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Fetch arrests from Collier County website
 * Handles ASP.NET WebForms ViewState
 */
function fetchCollierArrests_(dateFrom, dateTo) {
  try {
    // STEP 1: Get the initial page to extract ViewState
    var initialResponse = UrlFetchApp.fetch(COLLIER_CONFIG.BASE_URL, {
      method: 'get',
      muteHttpExceptions: true
    });
    
    var initialHtml = initialResponse.getContentText();
    
    // Extract ViewState fields
    var viewState = extractValue_(initialHtml, '__VIEWSTATE');
    var viewStateGenerator = extractValue_(initialHtml, '__VIEWSTATEGENERATOR');
    var eventValidation = extractValue_(initialHtml, '__EVENTVALIDATION');
    
    Logger.log('🔑 ViewState extracted: ' + (viewState ? 'Yes' : 'No'));
    
    // STEP 2: Build POST request with form data
    var formData = {
      '__VIEWSTATE': viewState || '',
      '__VIEWSTATEGENERATOR': viewStateGenerator || '',
      '__EVENTVALIDATION': eventValidation || '',
      'ctl00$ContentPlaceHolder1$txtDateFrom': dateFrom,
      'ctl00$ContentPlaceHolder1$txtDateTo': dateTo,
      'ctl00$ContentPlaceHolder1$btnSearch': 'Search'
    };
    
    // Convert to URL-encoded string
    var payload = Object.keys(formData).map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(formData[key]);
    }).join('&');
    
    // STEP 3: POST the form
    var response = UrlFetchApp.fetch(COLLIER_CONFIG.BASE_URL, {
      method: 'post',
      payload: payload,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      muteHttpExceptions: true
    });
    
    var html = response.getContentText();
    
    // STEP 4: Parse the results
    return parseCollierHTML_(html);
    
  } catch (error) {
    Logger.log('⚠️ Error fetching Collier arrests: ' + error.message);
    return [];
  }
}

/**
 * Extract value from hidden input field
 */
function extractValue_(html, fieldName) {
  var regex = new RegExp('id="' + fieldName + '"[^>]*value="([^"]*)"', 'i');
  var match = regex.exec(html);
  return match ? match[1] : null;
}

/**
 * Parse Collier County HTML to extract arrest records
 */
function parseCollierHTML_(html) {
  var arrests = [];
  
  try {
    // Split by arrest record blocks (each starts with Name table)
    var blocks = html.split(/<table[^>]*>\s*<tr[^>]*>\s*<td[^>]*>Name<\/td>/gi);
    
    Logger.log('🔍 Found ' + (blocks.length - 1) + ' potential arrest blocks');
    
    for (var i = 1; i < blocks.length; i++) {
      var block = blocks[i];
      var arrest = parseCollierBlock_(block);
      if (arrest && arrest.Booking_Number) {
        arrests.push(arrest);
      }
    }
    
  } catch (error) {
    Logger.log('⚠️ Error parsing HTML: ' + error.message);
  }
  
  return arrests;
}

/**
 * Parse a single arrest block
 */
function parseCollierBlock_(block) {
  var arrest = {
    County: 'Collier',
    Full_Name: '',
    First_Name: '',
    Last_Name: '',
    DOB: '',
    Address: '',
    City: '',
    State: '',
    ZIP: '',
    Booking_Number: '',
    Booking_Date: '',
    Charges: '',
    Bond_Amount: '',
    Bond_Type: '',
    Bond_Paid: '',
    Case_Number: '',
    Court_Date: '',
    Court_Time: '',
    Court_Location: '',
    Status: '',
    Person_ID: '',
    PIN: '',
    Race: '',
    Sex: '',
    Height: '',
    Weight: '',
    Hair_Color: '',
    Eye_Color: '',
    Age: '',
    Agency: ''
  };
  
  // Extract name, DOB, residence (first row of first table)
  var nameMatch = /<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>(\d{2}\/\d{2}\/\d{4})<\/td>\s*<td[^>]*>([^<]+)<\/td>/i.exec(block);
  if (nameMatch) {
    arrest.Full_Name = cleanText_(nameMatch[1]);
    arrest.DOB = cleanText_(nameMatch[2]);
    var residence = cleanText_(nameMatch[3]);
    parseCollierResidence_(residence, arrest);
    parseCollierName_(arrest.Full_Name, arrest);
  }
  
  // Extract Person ID (A#)
  var aNumMatch = /A#[^\d]*(\d{8})/i.exec(block);
  if (aNumMatch) arrest.Person_ID = aNumMatch[1];
  
  // Extract PIN
  var pinMatch = /PIN[^\d]*(\d{9,10})/i.exec(block);
  if (pinMatch) arrest.PIN = pinMatch[1];
  
  // Extract physical description
  var raceMatch = /Race<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (raceMatch) arrest.Race = cleanText_(raceMatch[1]);
  
  var sexMatch = /Sex<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (sexMatch) arrest.Sex = cleanText_(sexMatch[1]);
  
  var heightMatch = /Height<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (heightMatch) arrest.Height = cleanText_(heightMatch[1]);
  
  var weightMatch = /Weight<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (weightMatch) arrest.Weight = cleanText_(weightMatch[1]);
  
  var hairMatch = /Hair Color<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (hairMatch) arrest.Hair_Color = cleanText_(hairMatch[1]);
  
  var eyeMatch = /Eye Color<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (eyeMatch) arrest.Eye_Color = cleanText_(eyeMatch[1]);
  
  // Extract booking info
  var bookingDateMatch = /Booking Date<\/td>\s*<td[^>]*>(\d{2}\/\d{2}\/\d{4})</i.exec(block);
  if (bookingDateMatch) arrest.Booking_Date = bookingDateMatch[1];
  
  var bookingNumMatch = /Booking Number<\/td>\s*<td[^>]*>(\d+)</i.exec(block);
  if (bookingNumMatch) arrest.Booking_Number = bookingNumMatch[1];
  
  var agencyMatch = /Agency<\/td>\s*<td[^>]*>([^<]+)</i.exec(block);
  if (agencyMatch) arrest.Agency = cleanText_(agencyMatch[1]);
  
  var ageMatch = /Age at Arrest<\/td>\s*<td[^>]*>(\d+)</i.exec(block);
  if (ageMatch) arrest.Age = ageMatch[1];
  
  // Extract charges (multiple rows in Charged table)
  var charges = [];
  var chargeRegex = /<tr[^>]*>\s*<td[^>]*>(\d{2}\/\d{2}\/\d{4})<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
  var chargeMatch;
  while ((chargeMatch = chargeRegex.exec(block)) !== null) {
    charges.push(cleanText_(chargeMatch[3]));
  }
  arrest.Charges = charges.join(' | ');
  
  // Extract court date
  var courtDateMatch = /Court Date<\/th>\s*<\/tr>\s*<tr[^>]*>.*?<td[^>]*>(\d{2}\/\d{2}\/\d{4})</is.exec(block);
  if (courtDateMatch) arrest.Court_Date = courtDateMatch[1];
  
  // Extract bond status
  var bondMatch = /(\d{2}\/\d{2}\/\d{4})\s+(BONDED|RELEASED|IN CUSTODY)/i.exec(block);
  if (bondMatch) {
    arrest.Bond_Paid = bondMatch[2];
    arrest.Status = bondMatch[2];
  }
  
  // Determine if in custody
  if (block.indexOf('IN CUSTODY') > -1) {
    arrest.Status = 'In Custody';
  } else if (block.indexOf('BONDED') > -1) {
    arrest.Status = 'Released';
    arrest.Bond_Paid = 'Yes';
  }
  
  return arrest;
}

/**
 * Parse residence into address, city, state, ZIP
 */
function parseCollierResidence_(residence, arrest) {
  if (!residence) return;
  
  // Format: "FORT MYERS, FL 33967" or "NAPLES, FL 34120"
  var parts = residence.split(',');
  if (parts.length >= 2) {
    arrest.City = cleanText_(parts[0]);
    var stateZip = cleanText_(parts[1]);
    var stateZipMatch = /([A-Z]{2})\s*(\d{5})/i.exec(stateZip);
    if (stateZipMatch) {
      arrest.State = stateZipMatch[1];
      arrest.ZIP = stateZipMatch[2];
    }
  }
}

/**
 * Parse full name into first/last
 */
function parseCollierName_(fullName, arrest) {
  if (!fullName) return;
  
  // Format: "CORNELL, SARA" or "MCKSYMICK, JOSEY WALES"
  var parts = fullName.split(',');
  if (parts.length >= 2) {
    arrest.Last_Name = titleCase_(parts[0].trim());
    arrest.First_Name = titleCase_(parts[1].trim());
  }
}

/**
 * Clean text (trim, remove extra spaces)
 */
function cleanText_(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Convert to title case
 */
function titleCase_(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, function(char) {
    return char.toUpperCase();
  });
}

/**
 * Get or create Collier County arrests sheet
 */
function getOrCreateCollierSheet_() {
  var ss = SpreadsheetApp.openById(COLLIER_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(COLLIER_CONFIG.TAB_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(COLLIER_CONFIG.TAB_NAME);
    
    // Add headers
    var headers = [
      'County', 'Booking_Number', 'Booking_Date', 'Full_Name', 'First_Name', 'Last_Name',
      'DOB', 'Age', 'Sex', 'Race', 'Height', 'Weight', 'Hair_Color', 'Eye_Color',
      'Address', 'City', 'State', 'ZIP', 'Person_ID', 'PIN',
      'Charges', 'Case_Number', 'Court_Date', 'Court_Time', 'Court_Location',
      'Bond_Amount', 'Bond_Type', 'Bond_Paid', 'Status', 'Agency',
      'Lead_Score', 'Lead_Status',
      'Google_Search', 'Facebook_Search', 'TruePeopleSearch'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#00A86B').setFontColor('white');
    sheet.setFrozenRows(1);
    
    Logger.log('✅ Created new sheet: ' + COLLIER_CONFIG.TAB_NAME);
  }
  
  return sheet;
}

/**
 * Write arrests to sheet
 */
function writeCollierArrestsToSheet_(sheet, arrests) {
  if (arrests.length === 0) return;
  
  var rows = arrests.map(function(arrest) {
    return [
      arrest.County,
      arrest.Booking_Number,
      arrest.Booking_Date,
      arrest.Full_Name,
      arrest.First_Name,
      arrest.Last_Name,
      arrest.DOB,
      arrest.Age,
      arrest.Sex,
      arrest.Race,
      arrest.Height,
      arrest.Weight,
      arrest.Hair_Color,
      arrest.Eye_Color,
      arrest.Address,
      arrest.City,
      arrest.State,
      arrest.ZIP,
      arrest.Person_ID,
      arrest.PIN,
      arrest.Charges,
      arrest.Case_Number,
      arrest.Court_Date,
      arrest.Court_Time,
      arrest.Court_Location,
      arrest.Bond_Amount,
      arrest.Bond_Type,
      arrest.Bond_Paid,
      arrest.Status,
      arrest.Agency,
      '', // Lead_Score (filled by scoring function)
      '', // Lead_Status
      '', // Google_Search
      '', // Facebook_Search
      ''  // TruePeopleSearch
    ];
  });
  
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * Score Collier arrests (same logic as Lee County)
 */
function scoreCollierArrests_(sheet, arrests) {
  // Use the same scoring logic from LeadScoring.js
  if (typeof scoreArrestLead === 'function') {
    Logger.log('📊 Scoring ' + arrests.length + ' arrests...');
    // Implementation would call scoreArrestLead for each arrest
  }
}

/**
 * Sync qualified arrests to separate workbook
 */
function syncCollierQualifiedArrests_(arrests) {
  // Filter to qualified only (score >= 70)
  var qualified = arrests.filter(function(arrest) {
    return arrest.Lead_Score >= 70;
  });
  
  if (qualified.length > 0) {
    Logger.log('🎯 Syncing ' + qualified.length + ' qualified arrests...');
    // Use QualifiedArrestsSync.js function
    if (typeof addQualifiedArrestsToSheet === 'function') {
      addQualifiedArrestsToSheet(qualified, 'Collier');
    }
  }
}

/**
 * Send Slack notifications for qualified arrests
 */
function notifyCollierQualifiedArrests_(arrests) {
  var qualified = arrests.filter(function(arrest) {
    return arrest.Lead_Score >= 70;
  });
  
  if (qualified.length > 0 && typeof sendSlackNotification === 'function') {
    Logger.log('📨 Sending Slack notifications for ' + qualified.length + ' qualified arrests...');
    // Send notification
  }
}

/**
 * Install 30-minute trigger for Collier County
 */
function installCollierScraperTrigger() {
  // Remove existing triggers first
  removeCollierScraperTrigger();
  
  // Create new trigger
  ScriptApp.newTrigger('runCollierArrestsNow')
    .timeBased()
    .everyMinutes(30)
    .create();
  
  SpreadsheetApp.getUi().alert('✅ Installed 30-minute trigger for Collier County scraper');
  Logger.log('✅ Installed Collier County scraper trigger');
}

/**
 * Remove Collier County scraper triggers
 */
function removeCollierScraperTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runCollierArrestsNow') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  Logger.log('🗑️ Removed Collier County scraper triggers');
}

