# Zenith Tutorial Fee Management System
## Setup Guide

---

### FILE STRUCTURE
```
zenith/
├── index.html          ← Login page (start here)
├── admin.html          ← Admin dashboard
├── student.html        ← Student portal
├── database.sql        ← Run this in Supabase SQL Editor
├── css/
│   └── style.css       ← All styles (edit colors/fonts here)
└── js/
    ├── supabase.js     ← !! EDIT THIS FIRST !! (keys + WhatsApp)
    ├── auth.js         ← Login logic
    ├── admin.js        ← Admin dashboard logic
    └── student.js      ← Student portal logic
```

---

### STEP 1 — SET UP SUPABASE

1. Go to https://supabase.com → Sign up (free)
2. Click **New Project** → Give it a name (e.g. "zenith-tutorial")
3. Set a strong database password → Create project (wait ~2 min)
4. Go to **SQL Editor** → **New Query**
5. Open `database.sql`, copy ALL the content, paste it in, click **Run**

---

### STEP 2 — GET YOUR API KEYS

1. In your Supabase project, click the **gear icon** (Settings)
2. Click **API** in the left menu
3. Copy **Project URL** (looks like: `https://abcdefgh.supabase.co`)
4. Copy **anon / public** key (long string starting with `eyJ...`)

---

### STEP 3 — EDIT js/supabase.js

Open `js/supabase.js` and replace these 3 values:

```javascript
const SUPABASE_URL      = 'https://YOUR_PROJECT_REF.supabase.co'; // ← your URL
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY_HERE';            // ← your key
const WHATSAPP_NUMBER   = '2348012345678';                         // ← your number
```

---

### STEP 4 — CREATE ADMIN ACCOUNT

1. In Supabase → **Authentication** → **Users** tab
2. Click **Add user** → Enter your email + password
3. This is what you'll use to log in as Admin

---

### STEP 5 — UPDATE BANK DETAILS

Open `js/student.js` and search for `"First Bank of Nigeria"`.
Replace the bank name, account number, and account name with your real details.

---

### STEP 6 — DEPLOY / OPEN

- **Local testing**: Just open `index.html` in any browser
- **Free hosting**: Upload all files to https://netlify.com (drag & drop)
- **GitHub Pages**: Push to GitHub, enable Pages in settings

---

### HOW STUDENTS LOG IN

When you add a student and they make **full payment**, a serial number is generated (e.g. `ZT-A3F2-7B9C`).

Students log in with:
- Their **registered email**  
- Their **serial number**

If a student has not paid in full, their serial is inactive and they cannot log in until payment is complete.

---

### KEY FEATURES SUMMARY

| Feature | How it works |
|---|---|
| 30-day cycle | Starts on full payment date |
| Late payment | New cycle starts from original due date (not payment date) |
| Temp VIP | Admin can grant access; student still shown as owing |
| Pause cycle | Admin must enter a reason; time stops counting down |
| Auto-expire | System checks every 60 seconds and removes expired VIP |
| Alerts | Dashboard warns 5 days before expiry; flags owing temp VIP students |
| Reset | Admin types "RESET" to confirm full data wipe |

---

### CUSTOMIZATION

| What to change | Where |
|---|---|
| Cycle length (30 days) | `js/supabase.js` → `CYCLE_DAYS` |
| Alert threshold (5 days) | `js/supabase.js` → `ALERT_DAYS` |
| Centre name | `js/supabase.js` → `CENTRE_NAME` |
| Colors | `css/style.css` → `:root` variables at top |
| Bank details | `js/student.js` → search "First Bank" |
| WhatsApp number | `js/supabase.js` → `WHATSAPP_NUMBER` |
