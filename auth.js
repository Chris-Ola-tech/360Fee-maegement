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