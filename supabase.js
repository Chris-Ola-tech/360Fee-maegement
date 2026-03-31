// ============================================================
//  360 ACADEMY — SUPABASE CONFIG
// ============================================================

const SUPABASE_URL      = 'https://ogqrkkruouinkbqxvpwl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncXJra3J1b3VpbmticXh2cHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTQyMzUsImV4cCI6MjA5MDQ3MDIzNX0.__zifToJQNd5NuHDt48CqGn8_lLWaAYMAOy9YuX7120';

const WHATSAPP_NUMBER = '2349035930050';
const CYCLE_DAYS      = 30;
const ALERT_DAYS      = 5;
const CENTRE_NAME     = '360 ACADEMY';

// ============================================================
//  SUPABASE INITIALISATION — Reliable version
//  Instead of dynamically injecting a script tag (which is
//  unreliable), we wait for the DOM to be fully ready, then
//  load Supabase, retry if it fails, and only call
//  onSupabaseReady() once we CONFIRM the client works.
// ============================================================

let _initAttempts = 0;
const _MAX_ATTEMPTS = 5;

function _loadSupabase() {
  // If already loaded and working, just fire the callback
  if (window._supabase) {
    if (typeof onSupabaseReady === 'function') onSupabaseReady();
    return;
  }

  // If the supabase global is already available (script already in page)
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    _initClient();
    return;
  }

  // Otherwise inject the script
  _initAttempts++;
  if (_initAttempts > _MAX_ATTEMPTS) {
    console.error('Supabase failed to load after ' + _MAX_ATTEMPTS + ' attempts.');
    _showLoadError();
    return;
  }

  // Remove any previous failed script tags
  const old = document.getElementById('supabase-cdn');
  if (old) old.remove();

  const script    = document.createElement('script');
  script.id       = 'supabase-cdn';
  script.src      = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload   = () => {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      _initClient();
    } else {
      // Loaded but supabase global not available yet — wait a tick
      setTimeout(_loadSupabase, 300);
    }
  };
  script.onerror  = () => {
    console.warn('Supabase CDN load failed, retrying... attempt ' + _initAttempts);
    setTimeout(_loadSupabase, 1000 * _initAttempts); // back-off retry
  };
  document.head.appendChild(script);
}

function _initClient() {
  try {
    window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession:    true,
        autoRefreshToken:  true,
        detectSessionInUrl: false
      }
    });

    // Verify the client actually works with a lightweight ping
    window._supabase.from('students').select('id').limit(1).then(({ error }) => {
      if (error && error.message && error.message.includes('fetch')) {
        // Network issue — retry
        console.warn('Supabase ping failed, retrying...');
        window._supabase = null;
        setTimeout(_loadSupabase, 1500);
      } else {
        // All good — fire the ready callback
        console.log('Supabase client ready ✓');
        if (typeof onSupabaseReady === 'function') onSupabaseReady();
      }
    });
  } catch (e) {
    console.error('Supabase init error:', e);
    window._supabase = null;
    setTimeout(_loadSupabase, 1500);
  }
}

function _showLoadError() {
  // Show a user-friendly message if Supabase never loads
  const containers = ['studentContent', 'adminContent'];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#6b7280">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin-bottom:12px">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style="font-size:1rem;font-weight:600;color:#1a1f2e;margin-bottom:6px">Connection Failed</div>
          <div style="font-size:0.85rem">Unable to connect to the database. Please check your internet connection and refresh the page.</div>
          <button onclick="location.reload()" style="margin-top:16px;padding:10px 20px;background:#0d1b2a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.9rem">
            Refresh Page
          </button>
        </div>`;
    }
  });
}

// Start loading when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _loadSupabase);
} else {
  // DOM already ready — but give a tiny tick so page scripts finish parsing
  setTimeout(_loadSupabase, 0);
}

// ============================================================
//  HELPER: Get the Supabase client
// ============================================================
function getDB() {
  if (!window._supabase) {
    console.error('Supabase not initialised yet');
    return null;
  }
  return window._supabase;
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
// ============================================================
function calcCycle(student) {
  if (student.paused) return { daysLeft: '—', pct: 0, expired: false, paused: true, due: null };
  if (!student.cycle_start) return { daysLeft: 0, pct: 0, expired: true, paused: false, due: null };
  const start    = new Date(student.cycle_start);
  const due      = new Date(start.getTime() + CYCLE_DAYS * 86400000);
  const now      = new Date();
  const msLeft   = due - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
  const pct      = Math.max(0, Math.min(100, Math.round((msLeft / (CYCLE_DAYS * 86400000)) * 100)));
  return { daysLeft, pct, expired: daysLeft === 0, due, paused: false };
}

// ============================================================
//  HELPER: Toast notification
// ============================================================
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast show ' + type;
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

// ============================================================
//  HELPER: Generate serial (kept for compatibility)
// ============================================================
function generateSerial() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'ZT-';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  s += '-';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}