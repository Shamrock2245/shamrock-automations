/**
 * ============================================
 * CONFIG.gs - CENTRALIZED CONFIGURATION
 * ============================================
 * Based on IDEAL column structure
 */

var CONFIG = {
  
  // ===== GOOGLE SHEET SETTINGS =====
  SHEET_ID: '1jq1-N7sCbwSiYPLAdI2ZnxhLzym1QsOSuHPy-Gw07Qc',
  SHEET_NAME: 'shamrock-leads-leecounty', // Update if your sheet tab has a different name
  
  // ===== COLUMN MAPPINGS (Based on ideal structure) =====
  COLUMNS: {
    // Core identification fields
    TIMESTAMP: 1,              // Column A
    AGENT_NAME: 2,             // Column B
    CASE_NUMBER: 3,            // Column C - CRITICAL for matching
    
    // Defendant info
    DEFENDANT_FIRST: 4,        // Column D
    DEFENDANT_LAST: 5,         // Column E
    DEFENDANT_NAME: 6,         // Column F - CRITICAL for matching
    DEFENDANT_DOB: 7,          // Column G
    DEFENDANT_ADDRESS: 8,      // Column H
    DEFENDANT_CITY: 9,         // Column I
    DEFENDANT_STATE: 10,       // Column J
    DEFENDANT_ZIP: 11,         // Column K
    DEFENDANT_PHONE: 12,       // Column L - CRITICAL for reminders
    DEFENDANT_EMAIL: 13,       // Column M - CRITICAL for reminders
    
    // Indemnitor info
    INDEMNITOR_1_NAME: 14,     // Column N
    INDEMNITOR_1_PHONE: 15,    // Column O
    INDEMNITOR_1_EMAIL: 16,    // Column P - CRITICAL for reminders
    INDEMNITOR_2_NAME: 17,     // Column Q
    INDEMNITOR_2_PHONE: 18,    // Column R
    INDEMNITOR_2_EMAIL: 19,    // Column S
    
    // Charges
    CHARGE_1: 20,              // Column T
    CHARGE_2: 21,              // Column U
    CHARGE_3: 22,              // Column V
    
    // Financial info
    BOND_AMOUNT: 23,           // Column W
    PREMIUM_AMOUNT: 24,        // Column X
    PAYMENT_TYPE: 25,          // Column Y
    AMOUNT_PAID: 26,           // Column Z
    BALANCE_DUE: 27,           // Column AA
    PAYMENT_PLAN_TYPE: 28,     // Column AB
    NEXT_PAYMENT_DUE: 29,      // Column AC
    
    // Court date info (AUTO-FILLED by Module 1)
    COURT_DATE: 30,            // Column AD
    COURT_TIME: 31,            // Column AE
    COURT_LOCATION: 32,        // Column AF
    HEARING_TYPE: 33,          // Column AG
    CALENDAR_EVENT_ID: 34,     // Column AH
    REMINDER_7D: 35,           // Column AI
    REMINDER_3D: 36,           // Column AJ
    REMINDER_1D: 37,           // Column AK
    COURT_EMAIL_ID: 38,        // Column AL
    COURT_LAST_UPDATED: 39,    // Column AM
    
    // SignNow / Document tracking
    SIGNNOW_DOC_GROUP_ID: 40,  // Column AN
    SIGNNOW_INVITE_LINK: 41,   // Column AO
    DOCUMENT_STATUS: 42,       // Column AP
    NOTES: 43                  // Column AQ
  },
  
  // ===== EMAIL SEARCH SETTINGS =====
  // Adjust these based on actual clerk emails you receive
  EMAIL_SEARCH_QUERIES: [
    'from:clerk@leeclerk.org subject:(court OR hearing OR appearance)',
    'from:clerkofcourt@ca.cjis20.org',
    'subject:"Notice of Hearing"',
    'subject:"Court Date Notification"',
    'subject:"Notice of Court Appearance"'
  ],
  
  // ===== BUSINESS HOURS SETTINGS =====
  BUSINESS_HOURS: {
    START: 8,                  // 8 AM
    END: 18,                   // 6 PM
    TIMEZONE: 'America/New_York', // Florida EST
    WORK_DAYS: [1, 2, 3, 4, 5]   // Monday through Friday
  },
  
  // ===== REMINDER SCHEDULE =====
  REMINDER_DAYS: [7, 3, 1],    // Send at 7 days, 3 days, 1 day before court
  REMINDER_TIME: 9,            // Send reminders at 9 AM
  
  // ===== SLACK CHANNELS =====
  SLACK_CHANNELS: {
    COURT_DATES: '#court-dates',
    ERRORS: '#court-dates'     // Can separate later if desired
  },
  
  // ===== COMPANY INFO =====
  COMPANY: {
    NAME: 'Shamrock Bail Bonds',
    PHONE: '(239) XXX-XXXX',   // 🎯 UPDATE THIS WITH YOUR REAL PHONE
    EMAIL: 'admin@shamrockbailbonds.biz',
    ADDRESS: 'Fort Myers, FL'  // Optional
  }
};

/**
 * Helper function to get Script Properties
 */
function getScriptProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// ===== ARRESTS (Lee County) =====
CONFIG.ARRESTS = {
  SHEET_ID: '1jq1-N7sCbwSiYPLAdI2ZnxhLzym1QsOSuHPy-Gw07Qc', // shamrock-leads-leecounty
  TAB_NAME: 'Lee_County_Arrests',                         // target tab (will auto-create)
  TIMEZONE: 'America/New_York',

  ENDPOINTS: {
    BASE: 'https://www.sheriffleefl.org',
    AJAX: '/wp-admin/admin-ajax.php',
    PUBLIC_API: '/public-api/bookings'  // prefer if present; falls back to AJAX
  },

  // scrape window & limits
  DAYS_BACK: 3,
  MAX_ENRICH: 120,
  DETAIL_DELAY_MS: 300,

  // basic alerting (Slack recommended)
  ALERTS: {
    ENABLED: true,
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/XXX/YYY/ZZZ', // put your real webhook
    MAX_POST: 12,                      // max new arrests to post per run
    FAMILY_SEARCH_LINKS: true,         // include helper links in Slack
    KEY_CHARGES: ['DUI','DOMESTIC','BATTERY','THEFT'] // bold these in alerts
  }
};