/**
 * EduStream Pro – Login Page JS
 * Handles: login, key generation, admin login, particles
 */

const API = '';  // Empty = same origin; change to backend URL if different

// ─── Toast System ──────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ─── Error Display ─────────────────────────────────────
function showError(message) {
  const el = document.getElementById('error-msg');
  const txt = document.getElementById('error-text');
  txt.textContent = message;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 5000);
}

// ─── Device Fingerprint ────────────────────────────────
function getDeviceFingerprint() {
  const nav = window.navigator;
  const screen = window.screen;
  const fp = `${nav.userAgent}|${screen.width}x${screen.height}|${nav.language}|${nav.platform}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  // Simple hash
  let hash = 0;
  for (let i = 0; i < fp.length; i++) {
    hash = ((hash << 5) - hash) + fp.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ─── Key Formatting (auto-add dashes) ─────────────────
function formatKeyInput(input) {
  let val = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const parts = [];
  for (let i = 0; i < val.length && i < 16; i += 4) {
    parts.push(val.substring(i, i + 4));
  }
  input.value = parts.join('-');
}

// ─── Limit Dots UI ────────────────────────────────────
function updateLimitDots(used, max = 3) {
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) {
      dot.classList.toggle('used', i <= used);
    }
  }
  const remaining = max - used;
  const text = document.getElementById('limit-text');
  if (text) {
    if (remaining === 0) {
      text.textContent = 'Daily limit reached (resets at midnight)';
      text.style.color = 'var(--danger)';
    } else {
      text.textContent = `${remaining} key${remaining !== 1 ? 's' : ''} remaining today`;
      text.style.color = '';
    }
  }
}

// ─── Particles Animation ───────────────────────────────
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.width = particle.style.height = `${Math.random() * 3 + 1}px`;
    particle.style.animationDuration = `${Math.random() * 15 + 10}s`;
    particle.style.animationDelay = `${Math.random() * 10}s`;
    particle.style.opacity = Math.random() * 0.5;
    container.appendChild(particle);
  }
}

// ─── Check if already logged in ───────────────────────
async function checkExistingSession() {
  const token = localStorage.getItem('edustream_token');
  if (!token) return;

  try {
    const res = await fetch(`${API}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.valid) {
      window.location.href = '/dashboard.html';
    } else {
      localStorage.removeItem('edustream_token');
    }
  } catch {
    // Server not available, clear token
    localStorage.removeItem('edustream_token');
  }
}

// ─── Get Today's Key Generation Count ─────────────────
async function fetchKeyGenerationCount(gmail) {
  if (!gmail || !gmail.includes('@')) return;

  try {
    // We'll just display 0/3 initially; actual count updates after generate attempt
    updateLimitDots(0);
  } catch {}
}

// ─── Main Login Handler ────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();

  const gmailInput = document.getElementById('gmail-input');
  const keyInput = document.getElementById('key-input');
  const btnLogin = document.getElementById('btn-login');

  const gmail = gmailInput.value.trim();
  const key = keyInput.value.trim();

  if (!gmail) {
    showError('Please enter your Gmail address');
    gmailInput.focus();
    return;
  }

  if (!gmail.toLowerCase().endsWith('@gmail.com') && !gmail.includes('@')) {
    showError('Please enter a valid Gmail address');
    return;
  }

  // Show loading
  btnLogin.classList.add('loading');
  btnLogin.disabled = true;

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gmail: gmail.toLowerCase(),
        key: key || undefined,
        deviceFingerprint: getDeviceFingerprint()
      })
    });

    const data = await res.json();

    if (data.success) {
      // Save session token
      localStorage.setItem('edustream_token', data.token);
      localStorage.setItem('edustream_gmail', data.gmail);
      localStorage.setItem('edustream_expires', data.expiresAt);

      showToast('Welcome! Redirecting to dashboard...', 'success');

      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1000);
    } else {
      showError(data.message || 'Login failed. Check your credentials.');
      btnLogin.classList.remove('loading');
      btnLogin.disabled = false;
    }
  } catch (err) {
    console.error('Login error:', err);
    showError('Could not connect to server. Please try again.');
    btnLogin.classList.remove('loading');
    btnLogin.disabled = false;
  }
}

// ─── Key Generation Handler ────────────────────────────
async function handleGenerateKey() {
  const gmailInput = document.getElementById('gmail-input');
  const gmail = gmailInput.value.trim();

  if (!gmail || !gmail.includes('@')) {
    showError('Enter your Gmail first to generate a key');
    gmailInput.focus();
    return;
  }

  const btn = document.getElementById('btn-generate-key');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

  try {
    const res = await fetch(`${API}/api/auth/generate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmail: gmail.toLowerCase() })
    });

    const data = await res.json();

    if (data.success) {
      // Show generated key
      const keyDisplay = document.getElementById('key-display');
      const keyValueDisplay = document.getElementById('key-value-display');
      keyValueDisplay.textContent = data.key;
      keyDisplay.classList.add('visible');

      // Auto-fill the key input
      document.getElementById('key-input').value = data.key;

      const used = 3 - (data.remaining || 0);
      updateLimitDots(used);

      showToast(`Key generated! ${data.remaining} remaining today. Valid for 7 days.`, 'success');
    } else {
      if (data.remaining === 0) {
        showError('Daily limit reached! You can generate 3 keys per day.');
        updateLimitDots(3);
      } else {
        showError(data.message || 'Key generation failed');
      }
    }
  } catch (err) {
    showError('Server error. Please try again later.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Key';
  }
}

// ─── Copy Key ─────────────────────────────────────────
function handleCopyKey() {
  const key = document.getElementById('key-value-display').textContent;
  if (key && key !== '----') {
    navigator.clipboard.writeText(key).then(() => {
      showToast('Key copied to clipboard!', 'success', 2000);
    });
  }
}

// ─── Admin Login Modal ─────────────────────────────────
function showAdminModal() {
  document.getElementById('admin-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('admin-password-input').focus(), 100);
}

function hideAdminModal() {
  document.getElementById('admin-modal').style.display = 'none';
}

async function handleAdminLogin() {
  const password = document.getElementById('admin-password-input').value;
  const btn = document.getElementById('btn-admin-login-submit');

  if (!password) return;

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem('edustream_admin_token', data.adminToken);
      showToast('Admin login successful!', 'success');
      setTimeout(() => {
        window.location.href = '/admin.html';
      }, 800);
    } else {
      showToast('Invalid admin password', 'error');
      document.getElementById('admin-password-input').value = '';
      document.getElementById('admin-password-input').focus();
    }
  } catch {
    showToast('Server error', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ─── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Hide page loader
  const loader = document.getElementById('page-loader');

  createParticles();

  // Check if already logged in
  await checkExistingSession();

  // Hide loader
  loader.classList.add('hidden');
  setTimeout(() => loader.remove(), 500);

  // Form events
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('btn-generate-key').addEventListener('click', handleGenerateKey);
  document.getElementById('btn-copy-key').addEventListener('click', handleCopyKey);

  // Key input formatting
  const keyInput = document.getElementById('key-input');
  keyInput.addEventListener('input', () => formatKeyInput(keyInput));
  keyInput.addEventListener('paste', () => setTimeout(() => formatKeyInput(keyInput), 10));

  // Auto-fill key from display when user focuses key input
  document.getElementById('gmail-input').addEventListener('blur', (e) => {
    if (e.target.value) fetchKeyGenerationCount(e.target.value);
  });

  // Admin modal
  document.getElementById('btn-show-admin').addEventListener('click', showAdminModal);
  document.getElementById('btn-close-admin-modal').addEventListener('click', hideAdminModal);
  document.getElementById('btn-admin-login-submit').addEventListener('click', handleAdminLogin);
  document.getElementById('admin-password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdminLogin();
  });

  // Close modal on overlay click
  document.getElementById('admin-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('admin-modal')) hideAdminModal();
  });

  // Live toggle for admin checkbox label
  document.getElementById('btn-admin-login-submit').textContent = 'Login as Admin';
});
