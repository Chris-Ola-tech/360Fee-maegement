// ============================================================
//  360 ACADEMY — AUTH (Login Page)
// ============================================================

let currentRole = 'admin';

function onSupabaseReady() {
  checkExistingSession();
  loadLoginStats();
}

async function checkExistingSession() {
  const db = getDB();
  if (!db) return;
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    const role = localStorage.getItem('zt_role');
    if (role === 'admin')        window.location.href = 'admin.html';
    else if (role === 'student') window.location.href = 'student.html';
  }
}

async function loadLoginStats() {
  const db = getDB();
  if (!db) return;
  try {
    const { data: students } = await db.from('students').select('id, vip_active');
    if (students) {
      document.getElementById('loginStatStudents').textContent = students.length;
      document.getElementById('loginStatVIP').textContent = students.filter(s => s.vip_active).length;
    }
  } catch(e) { /* silent */ }
}

function switchRole(role, btn) {
  currentRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const adminPass  = document.getElementById('adminPassGroup');
  const studentId  = document.getElementById('studentIdGroup');
  const emailInput = document.getElementById('loginEmail');
  const emailGroup = emailInput.closest('.form-group');

  if (role === 'admin') {
    adminPass.style.display   = '';
    studentId.style.display   = 'none';
    emailGroup.style.display  = '';
    emailInput.placeholder    = 'Admin email address';
    emailInput.required       = true;                  // ← email required for admin
    document.getElementById('loginPassword').required = true;
    document.getElementById('loginSerial').required   = false;
  } else {
    adminPass.style.display   = 'none';
    studentId.style.display   = '';
    emailGroup.style.display  = 'none';
    emailInput.required       = false;                 // ← email NOT required for student
    document.getElementById('loginPassword').required = false;
    document.getElementById('loginSerial').required   = true;
    document.getElementById('loginSerial').placeholder = 'Your Login ID (e.g. STU-AB12CD)';
  }

  document.getElementById('loginError').style.display = 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const errEl  = document.getElementById('loginError');
  const btnTxt = document.getElementById('loginBtnText');
  const spinner= document.getElementById('loginSpinner');

  errEl.style.display   = 'none';
  btnTxt.textContent    = 'Signing in...';
  spinner.style.display = '';

  const db = getDB();

  try {
    if (currentRole === 'admin') {
      const email    = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      localStorage.setItem('zt_role',  'admin');
      localStorage.setItem('zt_email', email);
      window.location.href = 'admin.html';

    } else {
      const loginId = document.getElementById('loginSerial').value.trim().toUpperCase();
      if (!loginId) throw new Error('Please enter your Login ID.');

      const { data: students, error } = await db
        .from('students')
        .select('*')
        .eq('login_id', loginId)
        .limit(1);

      if (error) throw new Error(error.message);
      if (!students || students.length === 0)
        throw new Error('No student found with that Login ID. Please contact your admin.');

      const student = students[0];
      localStorage.setItem('zt_role',       'student');
      localStorage.setItem('zt_student_id', student.id);
      window.location.href = 'student.html';
    }

  } catch(err) {
    errEl.textContent   = err.message;
    errEl.style.display = '';
  } finally {
    btnTxt.textContent    = 'Sign In';
    spinner.style.display = 'none';
  }
}

function logout() {
  const db = getDB();
  if (db) db.auth.signOut();
  localStorage.removeItem('zt_role');
  localStorage.removeItem('zt_student_id');
  localStorage.removeItem('zt_email');
  window.location.href = './index.html';
}

// ============================================================
//  360 ACADEMY — COOKIES & WELCOME  (cookies.js)
// ============================================================

const COOKIE_KEY   = '360academy_cookies_accepted';
const WELCOME_KEY  = '360academy_welcomed_';   // + role appended

// ── Cookie Banner ────────────────────────────────────────────
function initCookieBanner() {
  // Don't show if already answered
  if (localStorage.getItem(COOKIE_KEY)) return;

  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.id = 'cookieBanner';
  banner.innerHTML = `
    <div class="cookie-banner-text">
      <strong>🍪 We use cookies</strong>
      This website uses cookies and local storage to keep you logged in
      and remember your preferences. By continuing to use 360 Academy,
      you agree to our use of cookies.
    </div>
    <div class="cookie-banner-actions">
      <button class="cookie-decline-btn" onclick="declineCookies()">Decline</button>
      <button class="cookie-accept-btn"  onclick="acceptCookies()">Accept & Continue</button>
    </div>
  `;
  document.body.appendChild(banner);
}

function acceptCookies() {
  localStorage.setItem(COOKIE_KEY, 'accepted');
  _dismissBanner();
}

function declineCookies() {
  localStorage.setItem(COOKIE_KEY, 'declined');
  _dismissBanner();
}

function _dismissBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  banner.style.transition  = 'transform 0.3s ease, opacity 0.3s ease';
  banner.style.transform   = 'translateY(100%)';
  banner.style.opacity     = '0';
  setTimeout(() => banner.remove(), 350);
}

// ── Admin Welcome Modal ──────────────────────────────────────
function showAdminWelcome(adminName, stats) {
  // Only show once per session
  const sessionKey = WELCOME_KEY + 'admin';
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, '1');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (adminName || 'Admin').split(' ')[0];

  const overlay = document.createElement('div');
  overlay.className = 'welcome-modal-overlay';
  overlay.id = 'welcomeOverlay';
  overlay.innerHTML = `
    <div class="welcome-modal">
      <div class="welcome-modal-icon">👋</div>
      <div class="welcome-modal-title">${greeting}, ${firstName}!</div>
      <div class="welcome-modal-sub">
        Welcome back to the <strong>360 Academy</strong> admin dashboard.
        Here's a quick overview of where things stand today.
      </div>
      <div class="welcome-modal-stats">
        <div class="welcome-modal-stat">
          <div class="welcome-modal-stat-num">${stats.total || 0}</div>
          <div class="welcome-modal-stat-label">Students</div>
        </div>
        <div class="welcome-modal-stat">
          <div class="welcome-modal-stat-num">${stats.vip || 0}</div>
          <div class="welcome-modal-stat-label">VIP Active</div>
        </div>
        <div class="welcome-modal-stat">
          <div class="welcome-modal-stat-num">${stats.owing || 0}</div>
          <div class="welcome-modal-stat-label">Owing</div>
        </div>
      </div>
      <button class="welcome-modal-btn" onclick="closeWelcome()">
        Go to Dashboard →
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Also close if clicking outside the modal
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeWelcome();
  });
}

function closeWelcome() {
  const overlay = document.getElementById('welcomeOverlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.25s ease';
  overlay.style.opacity    = '0';
  setTimeout(() => overlay.remove(), 260);
}

// ── Student Welcome Banner ───────────────────────────────────
function showStudentWelcome(studentName) {
  // Only show once per session
  const sessionKey = WELCOME_KEY + 'student';
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, '1');

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (studentName || 'Student').split(' ')[0];

  const banner = document.createElement('div');
  banner.className = 'student-welcome-banner';
  banner.id = 'studentWelcomeBanner';
  banner.innerHTML = `
    <div class="student-welcome-banner-icon">🎓</div>
    <div class="student-welcome-text">
      <strong>${greeting}, ${firstName}! Welcome back.</strong>
      <span>Check your payment status and access details below.</span>
    </div>
  `;

  // Insert at the top of student content
  const content = document.getElementById('studentContent');
  if (content) {
    content.insertBefore(banner, content.firstChild);
  }

  // Auto-dismiss after 6 seconds
  setTimeout(() => {
    if (banner && banner.parentNode) {
      banner.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      banner.style.opacity    = '0';
      banner.style.transform  = 'translateY(-10px)';
      setTimeout(() => banner.remove(), 420);
    }
  }, 6000);
}

// Start cookie banner on every page
document.addEventListener('DOMContentLoaded', initCookieBanner);