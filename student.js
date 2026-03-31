// ============================================================
//  360 ACADEMY — STUDENT PORTAL  (student.js)
//  Fixes:
//  - ALL students can log in (login_id exists for everyone)
//  - Payment section shown to owing students with account details
//  - Serial (#001) only shown if student has completed full payment
//  - No false "expired" label — cycle doesn't expire until 30 days
//  - "Register New Month" shown when cycle ends (admin must approve)
//  - Auto-expire removes VIP + serial after 30 days
// ============================================================

let studentData = null;

function onSupabaseReady() {
  guardStudent();
}

async function guardStudent() {
  const role      = localStorage.getItem('zt_role');
  const studentId = localStorage.getItem('zt_student_id');
  if (role !== 'student' || !studentId) {
    window.location.href = './index.html'; return;
  }
  await loadStudentData(studentId);
}

function logout() {
  localStorage.removeItem('zt_role');
  localStorage.removeItem('zt_student_id');
  window.location.href = './index.html';
}

async function loadStudentData(studentId) {
  const db = getDB();
  const { data: student, error } = await db
    .from('students').select('*').eq('id', studentId).single();

  if (error || !student) {
    document.getElementById('studentContent').innerHTML =
      '<div class="empty-state">Unable to load your profile. Please contact your admin.</div>';
    return;
  }

  studentData = student;

  // Auto-expire: if VIP but cycle has ended, deactivate
  const cycle = calcCycle(student);
  if (cycle.expired && student.vip_active) {
    await db.from('students').update({
      vip_active: false,
      temp_vip:   false,
      serial:     null       // serial becomes inactive on expiry
    }).eq('id', studentId);
    student.vip_active = false;
    student.temp_vip   = false;
    student.serial     = null;
  }

  const { data: payments } = await db.from('payments').select('*')
    .eq('student_id', studentId).order('payment_date', { ascending: false });

  renderStudentDashboard(student, payments || []);
}

function renderStudentDashboard(student, payments) {
  const cycle    = calcCycle(student);
  const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const whatsapp = typeof WHATSAPP_NUMBER !== 'undefined' ? WHATSAPP_NUMBER : '';

  const timerPctClass = cycle.pct > 40 ? '' : cycle.pct > 15 ? 'warn' : 'danger';

  // ── Timer / Status Block ─────────────────────────────────────
  let timerHtml = '';

  if (student.paused) {
    timerHtml = `
      <div class="pause-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
        </svg>
        <div class="pause-banner-text">
          <strong>Your cycle is currently paused</strong>
          <span>Reason: ${student.pause_reason || 'Contact admin for details'}</span>
        </div>
      </div>`;

  } else if (student.vip_active && student.cycle_start) {
    // Active VIP — show countdown
    timerHtml = `
      <div class="s-timer-card">
        <div class="s-timer-title">Access Cycle — Month ${student.month_number || 1}</div>
        <div class="timer-days">${cycle.daysLeft}</div>
        <div class="timer-days-label">days remaining</div>
        <div style="height:12px"></div>
        <div class="timer-bar-wrap">
          <div class="timer-bar ${timerPctClass}" style="width:${cycle.pct}%"></div>
        </div>
        <div class="timer-info">
          <span>Started: ${fmtDate(student.cycle_start)}</span>
          <span>Expires: ${fmtDate(cycle.due)}</span>
        </div>
        ${cycle.daysLeft <= 5 && cycle.daysLeft > 0
          ? `<div class="alert-item alert-warning" style="margin-top:14px">
               ⚠️ Your access expires in <strong>${cycle.daysLeft} day${cycle.daysLeft !== 1 ? 's' : ''}</strong>. Please renew soon.
             </div>`
          : ''}
      </div>`;

  } else if (cycle.expired && student.cycle_start && !student.vip_active) {
    // Cycle ended — show renewal prompt (NOT "expired" — cycle expired, student didn't)
    const nextMonth = (student.month_number || 1) + 1;
    timerHtml = `
      <div class="alert-item alert-danger" style="margin-bottom:16px">
        <svg class="alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <div class="alert-title">Your 30-day cycle has ended</div>
          <div class="alert-desc">
            Your Month ${student.month_number || 1} access ended on ${fmtDate(cycle.due)}.
            Please make payment to register Month ${nextMonth} and continue your access.
          </div>
        </div>
      </div>`;

  } else if (!student.vip_active && !student.cycle_start) {
    // New student, no cycle yet
    timerHtml = `
      <div class="alert-item alert-warning" style="margin-bottom:16px">
        <svg class="alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <div class="alert-title">No active cycle</div>
          <div class="alert-desc">Complete your payment below to activate your VIP access and receive your serial number.</div>
        </div>
      </div>`;
  }

  // ── Payment Section (shown to ALL students with a balance) ───
  let payHtml = '';
  if (student.balance > 0) {
    const remaining = student.balance;
    const waMsg = encodeURIComponent(
      `Hello, I am ${student.name} (Login ID: ${student.login_id}). ` +
      `I have made a payment of ₦${remaining.toLocaleString()} for Month ${student.month_number || 1} tutorial fee. ` +
      `Please find attached my receipt.`
    );
    const waLink = `https://wa.me/${whatsapp}?text=${waMsg}`;

    payHtml = `
      <div class="s-pay-section">
        <div class="s-pay-title">💳 Payment Required — Month ${student.month_number || 1}</div>
        <div class="s-pay-desc">
          You have an outstanding balance. Make payment to the account below, then send your receipt to the admin via WhatsApp to have it recorded.
        </div>
        <div class="amount-owed-big">
          ${formatNaira(remaining)}
          <span style="font-size:0.9rem;color:var(--text-muted);font-family:DM Sans,sans-serif">outstanding</span>
        </div>
        <div class="account-details">
          <div class="acc-row"><span class="acc-label">Bank Name</span><span class="acc-value">First Bank of Nigeria</span></div>
          <div class="acc-row"><span class="acc-label">Account Number</span><span class="acc-value acc-copy" onclick="copyText('0123456789')">0123456789 <small>tap to copy</small></span></div>
          <div class="acc-row"><span class="acc-label">Account Name</span><span class="acc-value">360 Academy</span></div>
          <div class="acc-row"><span class="acc-label">Amount to Pay</span><span class="acc-value" style="color:var(--red)">${formatNaira(remaining)}</span></div>
        </div>
        <a class="btn-whatsapp" href="${waLink}" target="_blank" rel="noopener">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Send Receipt on WhatsApp
        </a>
        <p style="font-size:0.75rem;color:var(--text-muted);text-align:center;margin-top:10px">
          After sending your receipt, the admin will record your payment and update your status.
        </p>
      </div>`;
  }

  // ── Payment History ──────────────────────────────────────────
  let histHtml = '';
  if (payments.length > 0) {
    histHtml = `
      <div class="s-history-card">
        <div class="card-header"><h3>Payment History</h3></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Amount</th><th>Method</th><th>Date</th><th>Month</th></tr></thead>
            <tbody>
              ${payments.map(p => `<tr>
                <td><strong>${formatNaira(p.amount)}</strong></td>
                <td>${p.method || '—'}</td>
                <td>${fmtDate(p.payment_date)}</td>
                <td>${p.month_number ? 'Month ' + p.month_number : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Profile Header ───────────────────────────────────────────
  document.getElementById('studentContent').innerHTML = `
    <div class="s-profile-header">
      <div class="s-ph-top">
        <div class="s-ph-avatar">${initials}</div>
        <div>
          <div class="s-ph-name">${student.name}</div>
          <div class="s-ph-class">${student.class || 'No class assigned'}</div>
          <div class="s-ph-login-id">Login ID: <strong>${student.login_id || '—'}</strong></div>
          ${student.serial
            ? `<div class="s-ph-serial">VIP Serial: <strong>#${student.serial}</strong></div>`
            : `<div class="s-ph-serial-pending">Serial assigned after full payment</div>`}
        </div>
      </div>

      <div class="s-ph-badges">
        ${student.vip_active
          ? '<span class="s-vip-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> VIP Active</span>'
          : ''}
        ${student.temp_vip && student.vip_active
          ? '<span class="badge badge-orange">Temporary Access</span>'
          : ''}
        ${!student.vip_active && !student.paused
          ? '<span class="badge badge-grey">Inactive</span>'
          : ''}
      </div>

      <div class="s-stats-row" style="margin-top:20px">
        <div class="s-stat">
          <div class="s-stat-label">Total Fee</div>
          <div class="s-stat-val">${formatNaira(student.total_fee)}</div>
        </div>
        <div class="s-stat">
          <div class="s-stat-label">Amount Paid</div>
          <div class="s-stat-val paid">${formatNaira(student.amount_paid)}</div>
        </div>
        <div class="s-stat">
          <div class="s-stat-label">Balance</div>
          <div class="s-stat-val ${student.balance > 0 ? 'owing' : 'paid'}">${formatNaira(student.balance)}</div>
        </div>
      </div>
    </div>

    ${timerHtml}
    ${payHtml}
    ${histHtml}
  `;
}

// ── Utility: copy account number ─────────────────────────────
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Account number copied!', 'success'));
}