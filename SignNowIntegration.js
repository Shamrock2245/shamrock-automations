/**
 * ============================================
 * SIGNNOW INTEGRATION
 * ============================================
 * Automates document creation and signature collection via SignNow API
 */

var SIGNNOW_CONFIG = {
  // API Configuration
  API_BASE_URL: 'https://api.signnow.com',
  ACCESS_TOKEN: '', // Set this in CONFIG.js or via menu
  
  // Template Configuration
  TEMPLATE_ID: '', // Your SignNow template document ID
  
  // Webhook Configuration (optional - for status updates)
  WEBHOOK_URL: '', // Your webhook URL to receive signature completion events
  
  // Default settings
  SEND_EMAIL: true,
  REQUIRE_ALL_SIGNATURES: true
};

/**
 * Send bond application to SignNow
 */
function sendToSignNow(formData) {
  if (!SIGNNOW_CONFIG.ACCESS_TOKEN) {
    throw new Error('SignNow access token not configured. Please set it in CONFIG.js or via menu.');
  }
  
  if (!SIGNNOW_CONFIG.TEMPLATE_ID) {
    throw new Error('SignNow template ID not configured. Please set it in CONFIG.js or via menu.');
  }
  
  Logger.log('📄 Creating SignNow document from template...');
  
  try {
    // Step 1: Create document from template
    var documentId = createDocumentFromTemplate(SIGNNOW_CONFIG.TEMPLATE_ID, formData);
    Logger.log('✅ Document created: ' + documentId);
    
    // Step 2: Fill in the fields
    fillDocumentFields(documentId, formData);
    Logger.log('✅ Fields populated');
    
    // Step 3: Add signers
    var inviteId = sendInviteToSigners(documentId, formData);
    Logger.log('✅ Invite sent: ' + inviteId);
    
    // Step 4: Update spreadsheet with SignNow info
    updateSpreadsheetWithSignNowInfo(formData.bookingNumber, documentId, inviteId);
    
    return {
      success: true,
      documentId: documentId,
      inviteId: inviteId,
      message: 'Document sent to SignNow successfully'
    };
    
  } catch (error) {
    Logger.log('❌ SignNow error: ' + error.message);
    throw error;
  }
}

/**
 * Create a new document from template
 */
function createDocumentFromTemplate(templateId, formData) {
  var url = SIGNNOW_CONFIG.API_BASE_URL + '/template/' + templateId + '/copy';
  
  var payload = {
    document_name: 'Bond Application - ' + formData.defendantFullName + ' - ' + new Date().toISOString().split('T')[0]
  };
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + SIGNNOW_CONFIG.ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  
  if (code !== 200) {
    throw new Error('Failed to create document from template. Status: ' + code + ', Response: ' + response.getContentText());
  }
  
  var result = JSON.parse(response.getContentText());
  return result.id;
}

/**
 * Fill document fields with form data
 */
function fillDocumentFields(documentId, formData) {
  var url = SIGNNOW_CONFIG.API_BASE_URL + '/document/' + documentId;
  
  // Map form data to SignNow field names (using Mapping.js)
  var fieldData = mapFormDataToSignNowFields(formData);
  
  var payload = {
    fields: fieldData
  };
  
  var options = {
    method: 'put',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + SIGNNOW_CONFIG.ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  
  if (code !== 200) {
    throw new Error('Failed to fill document fields. Status: ' + code + ', Response: ' + response.getContentText());
  }
}

/**
 * Send signing invite to defendant, indemnitor, and agent
 */
function sendInviteToSigners(documentId, formData) {
  var url = SIGNNOW_CONFIG.API_BASE_URL + '/document/' + documentId + '/invite';
  
  var invites = [];
  
  // Defendant (if email provided)
  if (formData.defendantEmail) {
    invites.push({
      email: formData.defendantEmail,
      role_id: '',
      role: 'Defendant',
      order: 1,
      authentication_type: 'password',
      password: generateSimplePassword(),
      expiration_days: 30,
      reminder: 2
    });
  }
  
  // Indemnitor
  if (formData.indemnitorEmail) {
    invites.push({
      email: formData.indemnitorEmail,
      role_id: '',
      role: 'Indemnitor',
      order: 2,
      authentication_type: 'password',
      password: generateSimplePassword(),
      expiration_days: 30,
      reminder: 2
    });
  }
  
  // Agent (you)
  var agentEmail = Session.getActiveUser().getEmail();
  invites.push({
    email: agentEmail,
    role_id: '',
    role: 'Agent',
    order: 3,
    authentication_type: 'none',
    expiration_days: 30,
    reminder: 2
  });
  
  var payload = {
    to: invites,
    from: agentEmail,
    subject: 'Shamrock Bail Bonds - Signature Required',
    message: 'Please review and sign the attached bond application documents.'
  };
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + SIGNNOW_CONFIG.ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  
  if (code !== 200) {
    throw new Error('Failed to send invite. Status: ' + code + ', Response: ' + response.getContentText());
  }
  
  var result = JSON.parse(response.getContentText());
  return result.id || documentId;
}

/**
 * Map form data to SignNow field names
 */
function mapFormDataToSignNowFields(formData) {
  // Load field mapping from Mapping.js
  var fieldMap = getFieldsMap ? getFieldsMap() : {};
  
  var fields = [];
  
  // Defendant fields
  if (fieldMap.defendant_full_name) fields.push({ name: fieldMap.defendant_full_name, value: formData.defendantFullName || '' });
  if (fieldMap.defendant_dob) fields.push({ name: fieldMap.defendant_dob, value: formData.defendantDOB || '' });
  if (fieldMap.defendant_ssn) fields.push({ name: fieldMap.defendant_ssn, value: formData.defendantSSN || '' });
  if (fieldMap.defendant_dl) fields.push({ name: fieldMap.defendant_dl, value: formData.defendantDL || '' });
  if (fieldMap.defendant_address) fields.push({ name: fieldMap.defendant_address, value: formData.defendantStreetAddress || '' });
  if (fieldMap.defendant_city) fields.push({ name: fieldMap.defendant_city, value: formData.defendantCity || '' });
  if (fieldMap.defendant_state) fields.push({ name: fieldMap.defendant_state, value: formData.defendantDLState || '' });
  if (fieldMap.defendant_zip) fields.push({ name: fieldMap.defendant_zip, value: formData.defendantZip || '' });
  
  // Indemnitor fields
  if (fieldMap.indemnitor_full_name) fields.push({ name: fieldMap.indemnitor_full_name, value: formData.indemnitorFullName || '' });
  if (fieldMap.indemnitor_relationship) fields.push({ name: fieldMap.indemnitor_relationship, value: formData.indemnitorRelationship || '' });
  if (fieldMap.indemnitor_phone) fields.push({ name: fieldMap.indemnitor_phone, value: formData.indemnitorPhone || '' });
  if (fieldMap.indemnitor_email) fields.push({ name: fieldMap.indemnitor_email, value: formData.indemnitorEmail || '' });
  if (fieldMap.indemnitor_dob) fields.push({ name: fieldMap.indemnitor_dob, value: formData.indemnitorDOB || '' });
  if (fieldMap.indemnitor_address) fields.push({ name: fieldMap.indemnitor_address, value: formData.indemnitorStreetAddress || '' });
  if (fieldMap.indemnitor_city) fields.push({ name: fieldMap.indemnitor_city, value: formData.indemnitorCity || '' });
  if (fieldMap.indemnitor_state) fields.push({ name: fieldMap.indemnitor_state, value: formData.indemnitorState || '' });
  if (fieldMap.indemnitor_zip) fields.push({ name: fieldMap.indemnitor_zip, value: formData.indemnitorZip || '' });
  
  // Charges - handle multiple charges
  if (formData.charges && formData.charges.length > 0) {
    formData.charges.forEach(function(charge, index) {
      var num = index + 1;
      if (fieldMap['charge' + num + '_description']) {
        fields.push({ name: fieldMap['charge' + num + '_description'], value: charge.description || '' });
      }
      if (fieldMap['charge' + num + '_bond_amount']) {
        fields.push({ name: fieldMap['charge' + num + '_bond_amount'], value: charge.bondAmount || '' });
      }
      if (fieldMap['charge' + num + '_premium']) {
        fields.push({ name: fieldMap['charge' + num + '_premium'], value: charge.premium || '' });
      }
      if (fieldMap['charge' + num + '_case_number']) {
        fields.push({ name: fieldMap['charge' + num + '_case_number'], value: charge.caseNumber || '' });
      }
    });
  }
  
  // Totals
  if (fieldMap.total_bond) fields.push({ name: fieldMap.total_bond, value: formData.totalBond || '' });
  if (fieldMap.total_premium) fields.push({ name: fieldMap.total_premium, value: formData.totalPremium || '' });
  
  return fields;
}

/**
 * Update spreadsheet with SignNow document info
 */
function updateSpreadsheetWithSignNowInfo(bookingNumber, documentId, inviteId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Lee_County_Arrests');
  
  if (!sheet) return;
  
  // Find the row with this booking number
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var bookingCol = headers.indexOf('Booking_Number');
  
  if (bookingCol === -1) return;
  
  // Find or create SignNow columns
  var docIdCol = headers.indexOf('SignNow_Document_ID');
  var inviteCol = headers.indexOf('SignNow_Invite_ID');
  var statusCol = headers.indexOf('SignNow_Status');
  var sentCol = headers.indexOf('SignNow_Sent_Date');
  
  if (docIdCol === -1) {
    sheet.insertColumnAfter(sheet.getLastColumn());
    docIdCol = sheet.getLastColumn() - 1;
    sheet.getRange(1, docIdCol + 1).setValue('SignNow_Document_ID');
  }
  if (inviteCol === -1) {
    sheet.insertColumnAfter(sheet.getLastColumn());
    inviteCol = sheet.getLastColumn() - 1;
    sheet.getRange(1, inviteCol + 1).setValue('SignNow_Invite_ID');
  }
  if (statusCol === -1) {
    sheet.insertColumnAfter(sheet.getLastColumn());
    statusCol = sheet.getLastColumn() - 1;
    sheet.getRange(1, statusCol + 1).setValue('SignNow_Status');
  }
  if (sentCol === -1) {
    sheet.insertColumnAfter(sheet.getLastColumn());
    sentCol = sheet.getLastColumn() - 1;
    sheet.getRange(1, sentCol + 1).setValue('SignNow_Sent_Date');
  }
  
  // Find the row
  for (var i = 1; i < data.length; i++) {
    if (data[i][bookingCol] === bookingNumber) {
      sheet.getRange(i + 1, docIdCol + 1).setValue(documentId);
      sheet.getRange(i + 1, inviteCol + 1).setValue(inviteId);
      sheet.getRange(i + 1, statusCol + 1).setValue('Sent');
      sheet.getRange(i + 1, sentCol + 1).setValue(new Date());
      break;
    }
  }
}

/**
 * Generate a simple password for document access
 */
function generateSimplePassword() {
  var chars = '0123456789';
  var password = '';
  for (var i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Configure SignNow credentials via menu
 */
function configureSignNow() {
  var ui = SpreadsheetApp.getUi();
  
  var tokenResponse = ui.prompt(
    'SignNow Configuration',
    'Enter your SignNow Access Token:\n\n(Get this from https://app.signnow.com/webapp/settings/api)',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (tokenResponse.getSelectedButton() === ui.Button.OK) {
    var token = tokenResponse.getResponseText().trim();
    if (token) {
      SIGNNOW_CONFIG.ACCESS_TOKEN = token;
      PropertiesService.getScriptProperties().setProperty('SIGNNOW_ACCESS_TOKEN', token);
      
      var templateResponse = ui.prompt(
        'SignNow Configuration',
        'Enter your SignNow Template Document ID:\n\n(Find this in the template URL)',
        ui.ButtonSet.OK_CANCEL
      );
      
      if (templateResponse.getSelectedButton() === ui.Button.OK) {
        var templateId = templateResponse.getResponseText().trim();
        if (templateId) {
          SIGNNOW_CONFIG.TEMPLATE_ID = templateId;
          PropertiesService.getScriptProperties().setProperty('SIGNNOW_TEMPLATE_ID', templateId);
          ui.alert('✅ SignNow configured successfully!');
        }
      }
    }
  }
}

/**
 * Load SignNow credentials from properties
 */
function loadSignNowCredentials() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('SIGNNOW_ACCESS_TOKEN');
  var templateId = props.getProperty('SIGNNOW_TEMPLATE_ID');
  
  if (token) SIGNNOW_CONFIG.ACCESS_TOKEN = token;
  if (templateId) SIGNNOW_CONFIG.TEMPLATE_ID = templateId;
}

// Load credentials on script load
loadSignNowCredentials();

/**
 * Test SignNow connection
 */
function testSignNowConnection() {
  if (!SIGNNOW_CONFIG.ACCESS_TOKEN) {
    SpreadsheetApp.getUi().alert('❌ SignNow access token not configured');
    return;
  }
  
  try {
    var url = SIGNNOW_CONFIG.API_BASE_URL + '/user';
    var options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + SIGNNOW_CONFIG.ACCESS_TOKEN
      },
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    
    if (code === 200) {
      var user = JSON.parse(response.getContentText());
      SpreadsheetApp.getUi().alert('✅ SignNow connection successful!\n\nUser: ' + user.email);
    } else {
      SpreadsheetApp.getUi().alert('❌ SignNow connection failed\n\nStatus: ' + code + '\nResponse: ' + response.getContentText());
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + error.message);
  }
}

