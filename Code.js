/**
 * ============================================
 * CONFIG.gs - CENTRALIZED CONFIGURATION
 * ============================================
 * This file stores all settings for Module 1.
 * If you need to change something, do it here!
 */

var CONFIG = {
  
  // ===== GOOGLE SHEET SETTINGS =====
  SHEET_ID: '1jq1-N7sCbwSiYPLAdI2ZnxhLzym1QsOSuHPy-Gw07Qc', // Your existing sheet ID
  SHEET_NAME: 'shamrock-leads-leecounty', // Name of the tab with bond data
  
  // Column numbers (A=1, B=2, C=3, etc.) - CHANGE THESE TO MATCH YOUR SHEET
  COLUMNS: {
    CASE_NUMBER: 3,        // Column C - Change if yours is different
    DEFENDANT_NAME: 4,     // Column D
    DEFENDANT_EMAIL: 5,    // Column E
    DEFENDANT_PHONE: 6,    // Column F
    INDEMNITOR_EMAIL: 13,  // Column M - may have multiple, comma-separated
    
    // New court date columns (these should match what you created earlier)
    COURT_DATE: 27,        // Column AA (27th column)
    COURT_TIME: 28,        // Column AB
    COURT_LOCATION: 29,    // Column AC
    HEARING_TYPE: 30,      // Column AD
    CALENDAR_EVENT_ID: 31, // Column AE
    REMINDER_7D: 32,       // Column AF
    REMINDER_3D: 33,       // Column AG
    REMINDER_1D: 34,       // Column AH
    COURT_EMAIL_ID: 35,    // Column AI
    COURT_LAST_UPDATED: 36 // Column AJ
  },
  
  // ===== EMAIL SEARCH SETTINGS =====
  // These are the patterns the script uses to find court date emails
  EMAIL_SEARCH_QUERIES: [
    'from:clerk@leeclerk.org subject:(court OR hearing OR appearance)',
    'from:clerkofcourt@ca.cjis20.org',
    'subject:"Notice of Hearing"',
    'subject:"Court Date Notification"'
    // Add more patterns as you discover them
  ],
  
  // ===== BUSINESS HOURS SETTINGS =====
  BUSINESS_HOURS: {
    START: 8,  // 8 AM
    END: 18,   // 8 PM (18:00 in 24-hour format)
    TIMEZONE: 'America/New_York', // Florida timezone
    WORK_DAYS: [1, 2, 3, 4, 5] // Monday=1, Tuesday=2, ..., Friday=5
  },
  
  // ===== REMINDER SCHEDULE =====
  // How many days before court date to send reminders
  REMINDER_DAYS: [7, 3, 1], // 7 days, 3 days, 1 day before
  REMINDER_TIME: 9, // Send reminders at 9 AM
  
  // ===== SLACK CHANNELS =====
  SLACK_CHANNELS: {
    COURT_DATES: '#court-dates',
    ERRORS: '#court-dates' // Can change to separate error channel later
  },
  
  // ===== COMPANY INFO (for email signatures) =====
  COMPANY: {
    NAME: 'Shamrock Bail Bonds',
    PHONE: '(239) XXX-XXXX', // Fill in your actual phone
    EMAIL: 'admin@shamrockbailbonds.biz',
    ADDRESS: 'Your address here' // Optional
  }
};

/**
 * Helper function to get Script Properties
 * (This keeps sensitive data out of the code)
 */
function getScriptProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}
