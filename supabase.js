// ============================================================
//  ZENITH TUTORIAL — SUPABASE CONFIG
//  !! EDIT THESE TWO VALUES WITH YOUR OWN SUPABASE PROJECT DETAILS !!
//
//  HOW TO FIND THEM:
//  1. Go to https://supabase.com and open your project
//  2. Click "Project Settings" (gear icon) → "API"
//  3. Copy "Project URL" → paste into SUPABASE_URL below
//  4. Copy "anon / public" key → paste into SUPABASE_ANON_KEY below
// ============================================================

const SUPABASE_URL      = 'https://ogqrkkruouinkbqxvpwl.supabase.co';  // <-- REPLACE THIS
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncXJra3J1b3VpbmticXh2cHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTQyMzUsImV4cCI6MjA5MDQ3MDIzNX0.__zifToJQNd5NuHDt48CqGn8_lLWaAYMAOy9YuX7120';              // <-- REPLACE THIS

// ============================================================
//  WHATSAPP CONTACT FOR PAYMENT RECEIPT
//  Format: international number without spaces or + sign
//  Example: 2348012345678  (for +234 801 234 5678)
// ============================================================
const WHATSAPP_NUMBER = '234XXXXXXXXXX';  // <-- REPLACE WITH YOUR NUMBER

// ============================================================
//  SYSTEM SETTINGS (you can change these)
// ============================================================
const CYCLE_DAYS     = 30;   // Number of days per payment cycle
const ALERT_DAYS     = 5;    // Warn admin when X days remain
const CENTRE_NAME    = 'Zenith Tutorial Centre'; // Displayed in UI

// ============================================================
//  SUPABASE CLIENT INITIALISATION
//  Uses the official Supabase CDN build — no install needed
// ============================================================

// Load Supabase from CDN
const supabaseScript = document.createElement('script');
supabaseScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
supabaseScript.onload = () => {
  window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase client ready');
  if (typeof onSupabaseReady === 'function') onSupabaseReady();
};
document.head.appendChild(supabaseScript);

// ============================================================
//  HELPER: Get the Supabase client (call after page load)
// ============================================================
function getDB() {
  if (!window._supabase) {
    console.error('Supabase not initialised yet');
    return null;
  }
  return window._supabase;
}

// ============================================================
//  HELPER: Generate a unique serial number for VIP students
//  Format: ZT-XXXX-XXXX  (e.g. ZT-A3F2-7B9C)
// ============================================================
function generateSerial() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'ZT-';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  s += '-';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ============================================================
//  HELPER: Format a number as Nigerian Naira
// ============================================================
function formatNaira(n) {
  if (n === null || n === undefined) return '₦0';
  return '₦' + Number(n).toLocaleString('en-NG');
}

// ============================================================
//  HELPER: Calculate days remaining in a student's cycle
//  Returns { daysLeft, pct, expired, paused }
// ============================================================
function calcCycle(student) {
  if (student.paused) return { daysLeft: '—', pct: 0, expired: false, paused: true };
  if (!student.cycle_start) return { daysLeft: 0, pct: 0, expired: true, paused: false };
  const start = new Date(student.cycle_start);
  const due   = new Date(start.getTime() + CYCLE_DAYS * 86400000);
  const now   = new Date();
  const msLeft = due - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
  const pct = Math.max(0, Math.min(100, Math.round((msLeft / (CYCLE_DAYS * 86400000)) * 100)));
  return { daysLeft, pct, expired: daysLeft === 0, due, paused: false };
}

// ============================================================
//  HELPER: Status badge HTML
// ============================================================
function statusBadge(student) {
  const cycle = calcCycle(student);
  if (cycle.paused)   return '<span class="badge badge-orange">Paused</span>';
  if (cycle.expired && student.vip) return '<span class="badge badge-red">Expired</span>';
  if (student.status === 'paid')    return '<span class="badge badge-green">Paid</span>';
  return '<span class="badge badge-orange">Owing</span>';
}

// ============================================================
//  HELPER: Toast notification
// ============================================================
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ============================================================
//  HELPER: Open / close modals
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// ============================================================
//  HELPER: Toggle password visibility
// ============================================================
function togglePw() {
  const pw = document.getElementById('loginPassword');
  if (!pw) return;
  pw.type = pw.type === 'password' ? 'text' : 'password';
}

// ============================================================
//  HELPER: Format a date nicely
// ============================================================
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}
