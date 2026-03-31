// ============================================================
//  360 ACADEMY — ADMIN DASHBOARD  (admin.js)
// ============================================================

let allStudents   = [];
let allPayments   = [];
let currentFilter = 'all';
let searchTerm    = '';

function onSupabaseReady() {
  guardAdmin();
}

async function guardAdmin() {
  const role = localStorage.getItem('zt_role');
  if (role !== 'admin') { window.location.href = './index.html'; return; }
  const name = localStorage.getItem('zt_admin_name') || 'Admin';
  document.getElementById('adminNameDisplay').textContent = name;
  await loadAll();
  await runAutoExpire();
}

function logout() {
  localStorage.clear();
  window.location.href = './index.html';
}

// ── Load everything ──────────────────────────────────────────
async function loadAll() {
  const db = getDB();
  const [{ data: students }, { data: payments }] = await Promise.all([
    db.from('students').select('*').order('name'),
    db.from('payments').select('*').order('payment_date', { ascending: false })
  ]);
  allStudents = students || [];
  allPayments = payments || [];

  updateStats();
  renderStudentsTable();
  renderPaymentsTable();
  renderVIPGrid();
  renderAlerts();
  renderRecentPayments();
}

// ── Auto-expire ──────────────────────────────────────────────
async function runAutoExpire() {
  const db  = getDB();
  const now = new Date();
  const toExpire = allStudents.filter(s => {
    if (!s.vip_active || s.paused || !s.cycle_start) return false;
    const due = new Date(new Date(s.cycle_start).getTime() + CYCLE_DAYS * 86400000);
    return now >= due;
  });
  for (const s of toExpire) {
    await db.from('students').update({
      vip_active: false,
      temp_vip:   false,
      serial:     null
    }).eq('id', s.id);
  }
  if (toExpire.length) await loadAll();
}

// ── Stats ────────────────────────────────────────────────────
function updateStats() {
  const total  = allStudents.length;
  const paid   = allStudents.filter(s => s.balance <= 0).length;
  const owing  = allStudents.filter(s => s.balance > 0).length;
  const vip    = allStudents.filter(s => s.vip_active).length;
  const revCol = allStudents.reduce((a, s) => a + (s.amount_paid || 0), 0);
  const revOwe = allStudents.reduce((a, s) => a + (s.balance    || 0), 0);

  document.getElementById('statTotal').textContent        = total;
  document.getElementById('statPaid').textContent         = paid;
  document.getElementById('statOwing').textContent        = owing;
  document.getElementById('statVIP').textContent          = vip;
  document.getElementById('statRevCollected').textContent = formatNaira(revCol);
  document.getElementById('statRevOwing').textContent     = formatNaira(revOwe);
}

// ── Recent Payments ──────────────────────────────────────────
function renderRecentPayments() {
  const tbody = document.getElementById('recentPaymentsBody');
  const last5 = allPayments.slice(0, 5);
  if (!last5.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No payments yet.</td></tr>';
    return;
  }
  tbody.innerHTML = last5.map(p => {
    const st = allStudents.find(s => s.id === p.student_id);
    return `<tr>
      <td>${st ? st.name : '—'}</td>
      <td>${formatNaira(p.amount)}</td>
      <td>${fmtDate(p.payment_date)}</td>
      <td>${p.method || '—'}</td>
      <td><span class="badge badge-green">Recorded</span></td>
    </tr>`;
  }).join('');
}

// ── Students Table ───────────────────────────────────────────
function renderStudentsTable() {
  const tbody = document.getElementById('studentsTableBody');
  let list = [...allStudents];

  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    list = list.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.class?.toLowerCase().includes(q) ||
      s.serial?.toLowerCase().includes(q) ||
      s.login_id?.toLowerCase().includes(q)
    );
  }

  if (currentFilter === 'paid')    list = list.filter(s => s.balance <= 0);
  if (currentFilter === 'partial') list = list.filter(s => s.balance > 0);
  if (currentFilter === 'vip')     list = list.filter(s => s.vip_active);
  if (currentFilter === 'expired') {
    list = list.filter(s => {
      const c = calcCycle(s);
      return c.expired && !s.vip_active;
    });
  }

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No students found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(s => {
    const cycle = calcCycle(s);

    // Show expiry date for ALL students who have a cycle_start
    let expText = '—';
    if (s.cycle_start) {
      if (cycle.expired && !s.vip_active) {
        expText = '<span class="badge badge-red">Cycle Ended</span>';
      } else {
        expText = fmtDate(cycle.due);
      }
    }

    return `<tr>
      <td><strong>${s.name}</strong><br><small style="color:var(--text-muted)">${s.login_id || '—'}</small></td>
      <td>${s.class || '—'}</td>
      <td>${formatNaira(s.total_fee)}</td>
      <td>${formatNaira(s.amount_paid)}</td>
      <td class="${s.balance > 0 ? 'text-red' : 'text-green'}">${formatNaira(s.balance)}</td>
      <td>${getStatusBadge(s)}</td>
      <td>${s.vip_active ? '<span class="badge badge-gold">✓ VIP</span>' : (s.temp_vip ? '<span class="badge badge-orange">Temp</span>' : '—')}</td>
      <td>${expText}</td>
      <td class="actions-cell">
        <button class="btn-xs btn-blue"  onclick="viewStudent('${s.id}')">View</button>
        <button class="btn-xs btn-green" onclick="openRecordPayment('${s.id}')">Pay</button>
        <button class="btn-xs btn-grey"  onclick="openEditStudent('${s.id}')">Edit</button>
        <button class="btn-xs btn-red"   onclick="deleteStudent('${s.id}')">Del</button>
      </td>
    </tr>`;
  }).join('');
}

function getStatusBadge(s) {
  const cycle = calcCycle(s);
  if (s.paused) return '<span class="badge badge-orange">Paused</span>';
  if (cycle.expired && !s.vip_active && s.cycle_start) return '<span class="badge badge-red">Cycle Ended</span>';
  if (s.balance <= 0) return '<span class="badge badge-green">Paid</span>';
  return '<span class="badge badge-orange">Owing</span>';
}

function filterStudents() {
  searchTerm = document.getElementById('studentSearch').value;
  renderStudentsTable();
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderStudentsTable();
}

// ── Payments Table ───────────────────────────────────────────
function renderPaymentsTable() {
  const tbody = document.getElementById('paymentsTableBody');
  if (!allPayments.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No payments recorded.</td></tr>';
    return;
  }
  tbody.innerHTML = allPayments.map(p => {
    const st = allStudents.find(s => s.id === p.student_id);
    return `<tr>
      <td>${st ? st.name : '—'}</td>
      <td>${formatNaira(p.amount)}</td>
      <td>${p.method || '—'}</td>
      <td>${fmtDate(p.payment_date)}</td>
      <td>${p.serial_at_time || '—'}</td>
    </tr>`;
  }).join('');
}

// ── VIP Grid ─────────────────────────────────────────────────
function renderVIPGrid() {
  const grid = document.getElementById('vipGrid');
  const vipStudents = allStudents.filter(s => s.vip_active);

  grid.innerHTML = `
    <div class="vip-search-bar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="vipSearchInput" placeholder="Search by serial number (e.g. 001)…" oninput="filterVIP()"/>
    </div>
    <div id="vipCardsContainer"></div>
  `;
  renderVIPCards(vipStudents);
}

function filterVIP() {
  const q = document.getElementById('vipSearchInput')?.value?.toLowerCase() || '';
  const vipStudents = allStudents.filter(s => {
    if (!s.vip_active) return false;
    if (!q) return true;
    return s.serial?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q);
  });
  renderVIPCards(vipStudents);
}

function renderVIPCards(list) {
  const container = document.getElementById('vipCardsContainer');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">No VIP students found.</div>';
    return;
  }
  container.innerHTML = `<div class="vip-cards-grid">${list.map(s => {
    const cycle = calcCycle(s);
    const pctClass = cycle.pct > 40 ? '' : cycle.pct > 15 ? 'warn' : 'danger';
    return `
      <div class="vip-card">
        <div class="vip-card-top">
          <div class="vip-avatar">${s.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}</div>
          <div class="vip-card-info">
            <div class="vip-card-name">${s.name}</div>
            <div class="vip-card-class">${s.class || 'No class'}</div>
            ${s.serial ? `<div class="vip-serial-badge">#${s.serial}</div>` : ''}
            ${s.temp_vip ? '<span class="badge badge-orange" style="font-size:0.7rem;margin-top:4px">Temporary</span>' : ''}
          </div>
        </div>
        <div class="vip-timer">
          <div class="vip-days">${cycle.daysLeft} <span>days left</span></div>
          <div class="timer-bar-wrap"><div class="timer-bar ${pctClass}" style="width:${cycle.pct}%"></div></div>
          <div class="vip-dates">
            <span>Started ${fmtDate(s.cycle_start)}</span>
            <span>Expires ${fmtDate(cycle.due)}</span>
          </div>
        </div>
        <div class="vip-card-actions">
          <button class="btn-xs btn-blue" onclick="viewStudent('${s.id}')">View</button>
          ${s.temp_vip ? `<button class="btn-xs btn-red" onclick="removeTempVIP('${s.id}')">Remove Temp VIP</button>` : ''}
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ── Alerts ───────────────────────────────────────────────────
function renderAlerts() {
  const now = new Date();
  // Only alert for VIP students with ≤ ALERT_DAYS remaining
  const alerts = allStudents.filter(s => {
    if (!s.vip_active || !s.cycle_start || s.paused) return false;
    const due = new Date(new Date(s.cycle_start).getTime() + CYCLE_DAYS * 86400000);
    const daysLeft = Math.ceil((due - now) / 86400000);
    return daysLeft >= 0 && daysLeft <= ALERT_DAYS;
  });

  const badge = document.getElementById('alertBadge');
  if (badge) badge.textContent = alerts.length;

  const alertsHtml = alerts.length ? alerts.map(s => {
    const cycle   = calcCycle(s);
    const urgency = cycle.pct < 15 ? 'alert-danger' : 'alert-warning';
    return `
      <div class="alert-item ${urgency}">
        <svg class="alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div class="alert-body">
          <div class="alert-title">${s.name} — ${cycle.daysLeft} day${cycle.daysLeft !== 1 ? 's' : ''} remaining</div>
          <div class="alert-desc">VIP cycle expires ${fmtDate(cycle.due)}. ${s.balance > 0 ? `Balance owing: ${formatNaira(s.balance)}` : 'Full payment received.'}</div>
        </div>
        <button class="btn-xs btn-blue" onclick="openRecordPayment('${s.id}')">Record Pay</button>
      </div>`;
  }).join('') : '<div class="empty-state">No urgent alerts. All VIP cycles have more than 5 days remaining.</div>';

  document.getElementById('alertsList').innerHTML = alertsHtml;
  document.getElementById('dashAlerts').innerHTML = alertsHtml;
}

// ── Add Student ──────────────────────────────────────────────
async function addStudent() {
  const db       = getDB();
  const name     = document.getElementById('newName').value.trim();
  const cls      = document.getElementById('newClass').value.trim();
  const totalFee = parseFloat(document.getElementById('newTotalFee').value) || 0;
  const amtPaid  = parseFloat(document.getElementById('newAmountPaid').value) || 0;
  const email    = document.getElementById('newEmail').value.trim();
  const method   = document.getElementById('newPayMethod').value;
  const notes    = document.getElementById('newNotes').value.trim();
  const errEl    = document.getElementById('addStudentError');

  if (!name)        { showErr(errEl, 'Name is required.'); return; }
  if (totalFee <= 0){ showErr(errEl, 'Total fee must be greater than 0.'); return; }
  errEl.style.display = 'none';

  const balance  = Math.max(0, totalFee - amtPaid);
  const fullPaid = balance <= 0;

  // ALL students get a login_id
  const login_id = 'STU-' + Math.random().toString(36).substr(2, 6).toUpperCase();

  // Serial ONLY for fully paid students
  let serial = null;
  if (fullPaid) {
    const existing = allStudents.filter(s => s.serial).map(s => parseInt(s.serial)).filter(n => !isNaN(n));
    const nextNum  = existing.length ? Math.max(...existing) + 1 : 1;
    serial = String(nextNum).padStart(3, '0');
  }

  const today = new Date().toISOString().split('T')[0];

  const studentObj = {
    name,
    class:        cls,
    total_fee:    totalFee,
    amount_paid:  amtPaid,
    balance,
    email:        email || null,
    login_id,
    serial,
    status:       fullPaid ? 'paid' : 'partial',
    vip_active:   fullPaid,
    temp_vip:     false,
    // ── KEY FIX: ALL students get cycle_start from day of registration ──
    cycle_start:  today,
    month_number: 1,
    notes:        notes || null,
    paused:       false,
    pause_reason: null
  };

  const { data: newStudent, error } = await db.from('students').insert([studentObj]).select().single();
  if (error) { showErr(errEl, 'Error adding student: ' + error.message); return; }

  if (amtPaid > 0) {
    await db.from('payments').insert([{
      student_id:    newStudent.id,
      amount:        amtPaid,
      method,
      payment_date:  today,
      serial_at_time: serial || null,
      month_number:  1
    }]);
  }

  closeModal('addStudentModal');
  resetAddForm();
  showToast(`${name} added! Login ID: ${login_id}${serial ? ' | Serial: ' + serial : ''}`, 'success');
  await loadAll();
}

function resetAddForm() {
  ['newName','newClass','newTotalFee','newAmountPaid','newEmail','newNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ── Record Payment ───────────────────────────────────────────
function openRecordPayment(studentId) {
  const s = allStudents.find(x => x.id === studentId);
  if (!s) return;
  document.getElementById('payStudentId').value = studentId;
  document.getElementById('payDate').value       = new Date().toISOString().split('T')[0];
  document.getElementById('payAmount').value     = '';
  document.getElementById('payStudentInfo').innerHTML = `
    <div class="pay-student-info-box">
      <strong>${s.name}</strong>
      <span>Balance: <b class="text-red">${formatNaira(s.balance)}</b></span>
      <span>Login ID: <b>${s.login_id || '—'}</b></span>
      ${s.serial ? `<span>Serial: <b>#${s.serial}</b></span>` : ''}
    </div>`;
  document.getElementById('recordPayError').style.display = 'none';
  openModal('recordPaymentModal');
}

async function recordPayment() {
  const db        = getDB();
  const studentId = document.getElementById('payStudentId').value;
  const amount    = parseFloat(document.getElementById('payAmount').value) || 0;
  const method    = document.getElementById('payMethod').value;
  const payDate   = document.getElementById('payDate').value;
  const errEl     = document.getElementById('recordPayError');

  if (amount <= 0) { showErr(errEl, 'Amount must be greater than 0.'); return; }

  const s = allStudents.find(x => x.id === studentId);
  if (!s) return;

  const newPaid    = (s.amount_paid || 0) + amount;
  const newBalance = Math.max(0, (s.total_fee || 0) - newPaid);
  const fullPaid   = newBalance <= 0;

  let updates = { amount_paid: newPaid, balance: newBalance };

  if (fullPaid && !s.serial) {
    // First time reaching full payment → assign serial + activate VIP
    const existing = allStudents.filter(x => x.serial).map(x => parseInt(x.serial)).filter(n => !isNaN(n));
    const nextNum  = existing.length ? Math.max(...existing) + 1 : 1;
    updates.serial     = String(nextNum).padStart(3, '0');
    updates.vip_active = true;
    updates.status     = 'paid';

    // LATE PAYMENT RULE: cycle_start stays as original registration date
    // (already set when student was added — don't change it)
    // If somehow not set, fall back to today
    if (!s.cycle_start) {
      updates.cycle_start = payDate || new Date().toISOString().split('T')[0];
    }
  } else if (fullPaid && s.serial) {
    updates.status = 'paid';
  } else {
    updates.status = 'partial';
  }

  const { error } = await db.from('students').update(updates).eq('id', studentId);
  if (error) { showErr(errEl, 'Error recording payment: ' + error.message); return; }

  await db.from('payments').insert([{
    student_id:    studentId,
    amount,
    method,
    payment_date:  payDate,
    serial_at_time: updates.serial || s.serial || null,
    month_number:  s.month_number || 1
  }]);

  closeModal('recordPaymentModal');
  const msg = fullPaid && !s.serial
    ? `Payment recorded! Serial #${updates.serial} assigned. VIP activated.`
    : 'Payment recorded successfully.';
  showToast(msg, 'success');
  await loadAll();
}

// ── Register New Month ───────────────────────────────────────
async function registerNewMonth(studentId) {
  const db = getDB();
  const s  = allStudents.find(x => x.id === studentId);
  if (!s) return;

  const cycle    = calcCycle(s);
  // New cycle starts from original due date
  const newStart = cycle.due
    ? new Date(cycle.due).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const newMonth = (s.month_number || 1) + 1;

  const { error } = await db.from('students').update({
    amount_paid:  0,
    balance:      s.total_fee,
    status:       'partial',
    vip_active:   false,
    serial:       null,
    cycle_start:  newStart,
    month_number: newMonth
  }).eq('id', s.id);

  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  showToast(`Month ${newMonth} registered. Cycle starts ${fmtDate(newStart)}. Awaiting payment.`, 'success');
  closeModal('viewStudentModal');
  await loadAll();
}

// ── Temp VIP ─────────────────────────────────────────────────
async function grantTempVIP(studentId) {
  const db    = getDB();
  const today = new Date().toISOString().split('T')[0];
  const { error } = await db.from('students').update({
    temp_vip:    true,
    vip_active:  true,
    cycle_start: today
  }).eq('id', studentId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Temporary VIP access granted.', 'success');
  closeModal('viewStudentModal');
  await loadAll();
}

async function removeTempVIP(studentId) {
  if (!confirm('Remove temporary VIP access for this student?')) return;
  const db = getDB();
  const { error } = await db.from('students').update({
    temp_vip:   false,
    vip_active: false,
    cycle_start: null
  }).eq('id', studentId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Temporary VIP access removed.', 'success');
  await loadAll();
}

// ── View Student Modal ───────────────────────────────────────
function viewStudent(studentId) {
  const s = allStudents.find(x => x.id === studentId);
  if (!s) return;

  const cycle       = calcCycle(s);
  const stuPayments = allPayments.filter(p => p.student_id === studentId);
  const cycleExpired = s.cycle_start && cycle.expired && !s.vip_active;
  const fullyPaid    = s.balance <= 0;

  let timerHtml = '';
  if (s.paused) {
    timerHtml = `<div class="pause-banner" style="margin:16px 0">
      <strong>Cycle Paused</strong> — ${s.pause_reason || ''}
    </div>`;
  } else if (s.cycle_start && !cycle.expired) {
    // Show timer for ALL students who have a cycle — paid or owing
    const pctClass = cycle.pct > 40 ? '' : cycle.pct > 15 ? 'warn' : 'danger';
    timerHtml = `
      <div style="margin:12px 0;padding:14px;background:var(--off-white);border-radius:var(--radius-sm);border:1px solid var(--border)">
        <div class="info-row"><span>Cycle Start</span><strong>${fmtDate(s.cycle_start)}</strong></div>
        <div class="info-row"><span>Due Date</span><strong>${fmtDate(cycle.due)}</strong></div>
        <div class="info-row"><span>Days Left</span><strong>${cycle.daysLeft} days</strong></div>
        <div style="margin-top:10px">
          <div class="timer-bar-wrap"><div class="timer-bar ${pctClass}" style="width:${cycle.pct}%"></div></div>
        </div>
        ${!s.vip_active ? `<div style="margin-top:8px;font-size:0.78rem;color:var(--orange)">⚠️ VIP access activates after full payment is completed.</div>` : ''}
      </div>`;
  } else if (cycleExpired) {
    timerHtml = `<div class="alert-item alert-danger" style="margin:12px 0">
      Cycle ended on ${fmtDate(cycle.due)}.
      ${fullyPaid ? '<em>Student can register a new month.</em>' : '<em>Payment required to continue.</em>'}
    </div>`;
  }

  const histHtml = stuPayments.length ? `
    <div style="margin-top:16px"><strong>Payment History</strong>
    <table class="data-table" style="margin-top:8px">
      <thead><tr><th>Amount</th><th>Method</th><th>Date</th><th>Serial</th></tr></thead>
      <tbody>
        ${stuPayments.map(p => `<tr>
          <td>${formatNaira(p.amount)}</td>
          <td>${p.method || '—'}</td>
          <td>${fmtDate(p.payment_date)}</td>
          <td>${p.serial_at_time || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>` : '';

  document.getElementById('viewStudentBody').innerHTML = `
    <div class="info-grid">
      <div class="info-row"><span>Name</span><strong>${s.name}</strong></div>
      <div class="info-row"><span>Class</span><strong>${s.class || '—'}</strong></div>
      <div class="info-row"><span>Login ID</span><strong>${s.login_id || '—'}</strong></div>
      <div class="info-row"><span>Serial (VIP)</span><strong>${s.serial ? '#' + s.serial : 'Not assigned'}</strong></div>
      <div class="info-row"><span>Email</span><strong>${s.email || '—'}</strong></div>
      <div class="info-row"><span>Total Fee</span><strong>${formatNaira(s.total_fee)}</strong></div>
      <div class="info-row"><span>Amount Paid</span><strong>${formatNaira(s.amount_paid)}</strong></div>
      <div class="info-row"><span>Balance</span><strong class="${s.balance > 0 ? 'text-red' : 'text-green'}">${formatNaira(s.balance)}</strong></div>
      <div class="info-row"><span>Month #</span><strong>${s.month_number || 1}</strong></div>
      <div class="info-row"><span>Status</span>${getStatusBadge(s)}</div>
    </div>
    ${timerHtml}
    ${histHtml}
  `;

  document.getElementById('viewPayBtn').onclick   = () => { closeModal('viewStudentModal'); openRecordPayment(studentId); };
  document.getElementById('viewPauseBtn').onclick = () => openPauseModal(studentId);
  document.getElementById('viewVIPBtn').textContent = s.temp_vip ? 'Remove Temp VIP' : 'Grant Temp VIP';
  document.getElementById('viewVIPBtn').onclick     = s.temp_vip
    ? () => { removeTempVIP(studentId); closeModal('viewStudentModal'); }
    : () => grantTempVIP(studentId);

  const footer   = document.querySelector('#viewStudentModal .modal-footer');
  const existing = document.getElementById('regNewMonthBtn');
  if (existing) existing.remove();
  if (cycleExpired) {
    const btn       = document.createElement('button');
    btn.id          = 'regNewMonthBtn';
    btn.className   = 'btn-primary';
    btn.textContent = `Register Month ${(s.month_number || 1) + 1}`;
    btn.onclick     = () => registerNewMonth(studentId);
    footer.insertBefore(btn, footer.firstChild);
  }

  openModal('viewStudentModal');
}

// ── Pause / Resume ───────────────────────────────────────────
function openPauseModal(studentId) {
  const s = allStudents.find(x => x.id === studentId);
  if (!s) return;
  document.getElementById('pauseStudentId').value = studentId;
  document.getElementById('pauseReason').value    = '';
  document.getElementById('pauseError').style.display = 'none';

  const btn = document.querySelector('#pauseModal .btn-warning');
  if (s.paused) {
    btn.textContent = 'Resume Cycle';
    btn.onclick     = executeResume;
  } else {
    btn.textContent = 'Pause Cycle';
    btn.onclick     = executePause;
  }
  openModal('pauseModal');
}

async function executePause() {
  const db        = getDB();
  const studentId = document.getElementById('pauseStudentId').value;
  const reason    = document.getElementById('pauseReason').value.trim();
  const errEl     = document.getElementById('pauseError');
  if (!reason) { showErr(errEl, 'Please enter a reason.'); return; }
  await db.from('students').update({ paused: true, pause_reason: reason, paused_at: new Date().toISOString() }).eq('id', studentId);
  closeModal('pauseModal');
  showToast('Cycle paused.', 'success');
  await loadAll();
}

async function executeResume() {
  const db        = getDB();
  const studentId = document.getElementById('pauseStudentId').value;
  await db.from('students').update({ paused: false, pause_reason: null, paused_at: null }).eq('id', studentId);
  closeModal('pauseModal');
  showToast('Cycle resumed.', 'success');
  await loadAll();
}

// ── Edit Student ─────────────────────────────────────────────
function openEditStudent(studentId) {
  const s = allStudents.find(x => x.id === studentId);
  if (!s) return;
  document.getElementById('editStudentId').value = studentId;
  document.getElementById('editName').value      = s.name || '';
  document.getElementById('editClass').value     = s.class || '';
  document.getElementById('editTotalFee').value  = s.total_fee || '';
  document.getElementById('editNotes').value     = s.notes || '';
  document.getElementById('editStudentError').style.display = 'none';
  openModal('editStudentModal');
}

async function saveEditStudent() {
  const db        = getDB();
  const studentId = document.getElementById('editStudentId').value;
  const name      = document.getElementById('editName').value.trim();
  const cls       = document.getElementById('editClass').value.trim();
  const totalFee  = parseFloat(document.getElementById('editTotalFee').value) || 0;
  const notes     = document.getElementById('editNotes').value.trim();
  const errEl     = document.getElementById('editStudentError');

  if (!name) { showErr(errEl, 'Name is required.'); return; }

  const s          = allStudents.find(x => x.id === studentId);
  const newBalance = Math.max(0, totalFee - (s?.amount_paid || 0));

  const { error } = await db.from('students').update({ name, class: cls, total_fee: totalFee, balance: newBalance, notes }).eq('id', studentId);
  if (error) { showErr(errEl, 'Error: ' + error.message); return; }

  closeModal('editStudentModal');
  showToast('Student updated.', 'success');
  await loadAll();
}

// ── Delete Student ───────────────────────────────────────────
async function deleteStudent(studentId) {
  if (!confirm('Delete this student and all their payment records?')) return;
  const db = getDB();
  await db.from('payments').delete().eq('student_id', studentId);
  await db.from('students').delete().eq('id', studentId);
  showToast('Student deleted.', 'success');
  await loadAll();
}

// ── Settings ─────────────────────────────────────────────────
function saveSettings() {
  localStorage.setItem('zt_centre_name', document.getElementById('centreName').value);
  localStorage.setItem('zt_default_fee', document.getElementById('defaultFee').value);
  localStorage.setItem('zt_whatsapp',    document.getElementById('whatsappNum').value);
  showToast('Settings saved.', 'success');
}

// ── Reset System ─────────────────────────────────────────────
function confirmReset() { openModal('resetModal'); }

async function executeReset() {
  const input = document.getElementById('resetConfirmInput').value.trim();
  if (input !== 'RESET') { showToast('Type RESET to confirm.', 'error'); return; }

  const db = getDB();
  await db.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  closeModal('resetModal');
  showToast('System reset complete. All data cleared.', 'success');
  document.getElementById('recentPaymentsBody').innerHTML = '<tr><td colspan="5" class="empty-row">No payments yet.</td></tr>';
  await loadAll();
}

// ── Sidebar / Navigation ─────────────────────────────────────
function showSection(name, clickedEl) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  if (clickedEl) clickedEl.classList.add('active');

  const titles = { dashboard:'Dashboard', students:'Students', payments:'Payments', vip:'VIP / Active', alerts:'Alerts', settings:'Settings' };
  document.getElementById('topbarTitle').textContent = titles[name] || name;

  if (window.innerWidth < 768) closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

function showErr(el, msg) {
  el.textContent   = msg;
  el.style.display = 'block';
}