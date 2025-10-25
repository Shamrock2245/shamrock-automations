# 🍀 Slack Integration Setup

## Quick Setup (5 Minutes)

### Step 1: Deploy the Code
```bash
cd /Users/brendan/Desktop/shamrock-automations
git pull origin main
clasp push
```

### Step 2: Open Apps Script Editor
1. Open your Google Spreadsheet
2. Go to: **Extensions → Apps Script**
3. Find the file: `setup_slack.js`

### Step 3: Run the Setup Function
1. In the Apps Script editor, click the function dropdown
2. Select: `quickSetupSlack`
3. Replace the function call with your credentials:

```javascript
quickSetupSlack(
  'YOUR_WEBHOOK_URL_HERE',
  'YOUR_OAUTH_TOKEN_HERE',
  '#new-arrests-lee-county'
);
```

4. Click **Run** ▶️
5. Authorize the script if prompted

### Step 4: Check Slack
You should see a test message in your channel!

---

## Alternative: Menu-Based Setup

1. Refresh your spreadsheet
2. Menu: **🍀 Shamrock Automation → 📨 SignNow & Slack → ⚙️ Setup Slack Integration**
3. Follow the prompts to enter your credentials

---

## What You'll Get

### Automatic Notifications for Every Qualified Arrest

Each notification includes:
- 🔥 Alert header
- 👤 Defendant info (name, DOB, address)
- 🎯 Lead score
- ⚖️ Charges
- 💰 Bond amount and type
- 📅 Court date and time
- 🔍 Quick search links (Google, Facebook, TruePeopleSearch)
- 📊 Link to Qualified Arrests sheet

### Example Message:
```
🔥 NEW QUALIFIED LEAD - ACTION REQUIRED

John Smith
📋 Booking #: 2025-001234
🎯 Lead Score: 85/100 (Hot)

⚖️ Charges:
  • DUI WITH PROPERTY DAMAGE
  • DRIVING WHILE LICENSE SUSPENDED

💰 Bond: Cash $5,000
📅 Court: 2025-11-15 at 9:00 AM

🔍 Quick Actions:
• Google Search | Facebook Search | TruePeopleSearch

📊 View in Qualified Arrests Sheet
```

---

## When Notifications Are Sent

- ✅ **Automatically** - When scraper finds qualified arrests (score >= 70)
- ✅ **Real-time** - Immediately after sync
- ✅ **Individual** - One message per qualified arrest
- ✅ **Throttled** - 1 second delay between messages

---

## Testing

### Test Connection
Menu: **📨 SignNow & Slack → 📊 Send Test Slack Message**

### Test Full Workflow
1. Run scraper: **🚔 Arrest Scraper → ▶️ Run Lee County Scraper**
2. Wait for completion
3. Check Slack for notifications

---

## Security

Your credentials are stored in **Google Script Properties** (encrypted), not in code files. They won't appear in GitHub or be visible to others.

---

## Troubleshooting

**No messages?**
- Check webhook URL is correct
- Verify channel exists
- Run test message function

**Duplicates?**
- Check for multiple triggers
- Menu: **⚙️ System Management → 📋 List Active Triggers**

---

## Need Your Credentials?

You provided them earlier:
- Webhook URL: `https://hooks.slack.com/services/T09N...`
- OAuth Token: `xoxb-9768...`
- Channel: `#new-arrests-lee-county`

(Check your Slack app settings if you need to regenerate them)

