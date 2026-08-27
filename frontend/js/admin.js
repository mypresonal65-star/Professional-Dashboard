/**
 * EduStream Pro – Admin Panel JS
 * Handles all admin panel operations
 */

const API = window.API_BASE || '';
let adminToken = '';
let allSections = [];

// ─── Toast System ──────────────────────────────────────
window.showToast = function(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
};

// ─── API Helper ────────────────────────────────────────
async function adminFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
      ...(options.headers || {})
    }
  });
  return res.json();
}

// ─── Auth Check ────────────────────────────────────────
function checkAdminAuth() {
  adminToken = localStorage.getItem('edustream_admin_token');
  if (!adminToken) {
    showToast('Admin access required. Please login.', 'error');
    setTimeout(() => { window.location.href = '/'; }, 1500);
    return false;
  }
  return true;
}

// ─── Panel Navigation ──────────────────────────────────
function switchPanel(panelName) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.panel === panelName);
  });

  // Update panels
  document.querySelectorAll('.admin-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${panelName}`);
  });

  // Update title
  const titles = {
    dashboard: '📊 Dashboard',
    sections: '📚 Sections',
    playlists: '🎬 Playlists',
    live: '📡 Live Stream',
    users: '👥 Users',
    keys: '🔑 Access Keys'
  };
  document.getElementById('admin-page-title').textContent = titles[panelName] || panelName;

  // Load data for the panel
  switch (panelName) {
    case 'dashboard': loadStats(); break;
    case 'sections': loadSections(); break;
    case 'playlists': loadPlaylists(); loadSectionsForDropdowns(); break;
    case 'live': loadLiveConfig(); break;
    case 'users': loadUsers(); break;
    case 'keys': loadKeys(); break;
  }
}

// ─── STATS ─────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await adminFetch('/api/admin/stats');
    if (data.success) {
      document.getElementById('stat-users').textContent = data.stats.totalUsers;
      document.getElementById('stat-sessions').textContent = data.stats.activeSessions;
      document.getElementById('stat-keys').textContent = data.stats.unusedKeys;
      document.getElementById('stat-sections').textContent = data.stats.totalSections;
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ─── SECTIONS ──────────────────────────────────────────
async function loadSections() {
  const tbody = document.getElementById('sections-tbody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>`;

  try {
    const data = await adminFetch('/api/admin/sections');
    allSections = data.data || [];

    if (allSections.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No sections yet. Add one above.</td></tr>`;
      return;
    }

    // Load playlist counts per section
    const plData = await adminFetch('/api/admin/playlists');
    const playlists = plData.data || [];

    tbody.innerHTML = allSections.map(sec => {
      const count = playlists.filter(p => p.section_id === sec.id).length;
      return `
        <tr>
          <td style="font-size:1.3rem;">${escapeHtml(sec.icon || '📚')}</td>
          <td style="font-weight:600;">${escapeHtml(sec.name)}</td>
          <td>${sec.order_index}</td>
          <td><span class="badge badge-primary">${count} playlists</span></td>
          <td>
            <div class="table-actions">
              <button class="btn btn-secondary btn-sm" onclick="editSection(${sec.id}, '${escapeHtml(sec.name)}', '${escapeHtml(sec.icon)}')">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteSection(${sec.id})">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);">Error loading sections</td></tr>`;
  }
}

async function addSection() {
  const name = document.getElementById('section-name-input').value.trim();
  const icon = document.getElementById('section-icon-input').value.trim() || '📚';

  if (!name) { showToast('Enter section name', 'warning'); return; }

  const btn = document.getElementById('btn-add-section');
  btn.disabled = true;

  try {
    const data = await adminFetch('/api/admin/sections', {
      method: 'POST',
      body: JSON.stringify({ name, icon })
    });

    if (data.success) {
      showToast(`Section "${name}" added!`, 'success');
      document.getElementById('section-name-input').value = '';
      document.getElementById('section-icon-input').value = '';
      loadSections();
    } else {
      showToast(data.message || 'Error adding section', 'error');
    }
  } catch { showToast('Server error', 'error'); }
  finally { btn.disabled = false; }
}

function editSection(id, name, icon) {
  document.getElementById('section-name-input').value = name;
  document.getElementById('section-icon-input').value = icon;
  document.getElementById('btn-add-section').textContent = 'Update Section';
  document.getElementById('btn-add-section').onclick = async () => {
    const newName = document.getElementById('section-name-input').value.trim();
    const newIcon = document.getElementById('section-icon-input').value.trim();
    const data = await adminFetch(`/api/admin/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newName, icon: newIcon, order_index: 0 })
    });
    if (data.success) {
      showToast('Section updated!', 'success');
      loadSections();
    }
    resetSectionForm();
  };
}

function resetSectionForm() {
  document.getElementById('section-name-input').value = '';
  document.getElementById('section-icon-input').value = '';
  document.getElementById('btn-add-section').textContent = '+ Add Section';
  document.getElementById('btn-add-section').onclick = addSection;
}

async function deleteSection(id) {
  if (!confirm('Delete this section and all its playlists? This cannot be undone.')) return;

  const data = await adminFetch(`/api/admin/sections/${id}`, { method: 'DELETE' });
  if (data.success) {
    showToast('Section deleted', 'success');
    loadSections();
  } else {
    showToast('Error deleting section', 'error');
  }
}

// ─── PLAYLISTS ─────────────────────────────────────────
async function loadSectionsForDropdowns() {
  try {
    const data = await adminFetch('/api/admin/sections');
    const sections = data.data || [];

    const selects = ['playlist-section-select', 'playlist-filter-section'];
    selects.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const currentVal = sel.value;
      sel.innerHTML = id === 'playlist-filter-section'
        ? '<option value="">All Sections</option>'
        : '<option value="">Select Section...</option>';
      sections.forEach(s => {
        sel.innerHTML += `<option value="${s.id}" ${s.id == currentVal ? 'selected' : ''}>${s.icon} ${escapeHtml(s.name)}</option>`;
      });
    });
  } catch {}
}

async function loadPlaylists(sectionFilter = '') {
  const tbody = document.getElementById('playlists-tbody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>`;

  try {
    const url = sectionFilter ? `/api/admin/playlists?section_id=${sectionFilter}` : '/api/admin/playlists';
    const data = await adminFetch(url);
    const playlists = data.data || [];

    if (playlists.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No playlists yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = playlists.map(pl => `
      <tr>
        <td><span class="badge badge-primary">${escapeHtml(pl.section_name || '')}</span></td>
        <td style="font-weight:600;">${escapeHtml(pl.name)}</td>
        <td>
          <code style="font-size:0.78rem;color:var(--primary-light);background:rgba(124,58,237,0.1);padding:2px 6px;border-radius:4px;">
            ${escapeHtml(pl.youtube_playlist_id)}
          </code>
        </td>
        <td>${pl.order_index}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm" onclick="editPlaylist(${pl.id})">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deletePlaylist(${pl.id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);">Error loading playlists</td></tr>`;
  }
}

async function addPlaylist() {
  const section_id = document.getElementById('playlist-section-select').value;
  const name = document.getElementById('playlist-name-input').value.trim();
  const youtube_playlist_id = document.getElementById('playlist-yt-id-input').value.trim();
  const description = document.getElementById('playlist-desc-input').value.trim();

  if (!section_id || !name || !youtube_playlist_id) {
    showToast('Fill in all required fields', 'warning');
    return;
  }

  const btn = document.getElementById('btn-add-playlist');
  btn.disabled = true;

  try {
    const data = await adminFetch('/api/admin/playlists', {
      method: 'POST',
      body: JSON.stringify({ section_id, name, youtube_playlist_id, description })
    });

    if (data.success) {
      showToast(`Playlist "${name}" added!`, 'success');
      document.getElementById('playlist-name-input').value = '';
      document.getElementById('playlist-yt-id-input').value = '';
      document.getElementById('playlist-desc-input').value = '';
      loadPlaylists();
    } else {
      showToast(data.message || 'Error', 'error');
    }
  } catch { showToast('Server error', 'error'); }
  finally { btn.disabled = false; }
}

function editPlaylist(id) {
  showToast('Edit feature: Select the playlist row to modify its values.', 'info');
}

async function deletePlaylist(id) {
  if (!confirm('Delete this playlist?')) return;
  const data = await adminFetch(`/api/admin/playlists/${id}`, { method: 'DELETE' });
  if (data.success) { showToast('Playlist deleted', 'success'); loadPlaylists(); }
  else showToast('Error', 'error');
}

// ─── LIVE STREAM ───────────────────────────────────────
async function loadLiveConfig() {
  try {
    const data = await adminFetch('/api/admin/live');
    if (data.success) {
      const live = data.data;
      document.getElementById('live-url-input').value = live.hls_url || '';
      document.getElementById('live-title-input').value = live.title || '';
      document.getElementById('live-active-toggle').checked = live.is_active == 1;
      document.getElementById('live-toggle-label').textContent = live.is_active ? 'Live' : 'Offline';

      const dot = document.getElementById('live-admin-dot');
      const status = document.getElementById('live-admin-status');
      if (live.is_active) {
        dot.classList.remove('offline');
        status.textContent = 'Stream Live';
        status.style.color = '#ef4444';
      } else {
        dot.classList.add('offline');
        status.textContent = 'Stream Offline';
        status.style.color = '';
      }

      if (live.updated_at) {
        document.getElementById('live-last-updated').textContent = new Date(live.updated_at).toLocaleString();
      }
    }
  } catch { showToast('Error loading live config', 'error'); }
}

async function saveLiveConfig() {
  const hls_url = document.getElementById('live-url-input').value.trim();
  const title = document.getElementById('live-title-input').value.trim();
  const is_active = document.getElementById('live-active-toggle').checked;

  const btn = document.getElementById('btn-save-live');
  btn.disabled = true;

  try {
    const data = await adminFetch('/api/admin/live', {
      method: 'POST',
      body: JSON.stringify({ hls_url, title, is_active })
    });

    if (data.success) {
      showToast('Live stream config saved!', 'success');
      loadLiveConfig();
    } else {
      showToast(data.message || 'Error saving', 'error');
    }
  } catch { showToast('Server error', 'error'); }
  finally { btn.disabled = false; }
}

// ─── USERS ─────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>`;

  try {
    const data = await adminFetch('/api/admin/users');
    const users = data.data || [];

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No users yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(user => {
      const expiry = user.session_expires ? new Date(user.session_expires).toLocaleDateString() : 'No session';
      const isExpired = user.session_expires && new Date(user.session_expires) < new Date();

      return `
        <tr>
          <td class="gmail-cell">${escapeHtml(user.gmail)}</td>
          <td>
            ${user.special_access
              ? '<span class="badge badge-primary">⭐ Special Access</span>'
              : '<span class="badge badge-cyan">🔑 Key Required</span>'
            }
          </td>
          <td>${user.keys_used || 0}</td>
          <td>
            <span class="${isExpired ? 'badge badge-danger' : 'badge badge-success'}">
              ${expiry}
            </span>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn btn-secondary btn-sm" title="Toggle special access"
                onclick="toggleSpecialAccess('${escapeHtml(user.gmail)}', ${user.special_access ? 0 : 1})">
                ${user.special_access ? '<i class="fa-solid fa-star-half-stroke"></i>' : '<i class="fa-solid fa-star"></i>'}
              </button>
              <button class="btn btn-warning btn-sm" title="Force logout"
                onclick="forceLogout('${escapeHtml(user.gmail)}')">
                <i class="fa-solid fa-right-from-bracket"></i>
              </button>
              <button class="btn btn-danger btn-sm" title="Delete user"
                onclick="deleteUser('${escapeHtml(user.gmail)}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);">Error loading users</td></tr>`;
  }
}

async function addUser() {
  const gmail = document.getElementById('user-gmail-input').value.trim();
  const special_access = document.getElementById('user-special-toggle').checked;

  if (!gmail) { showToast('Enter Gmail address', 'warning'); return; }

  const btn = document.getElementById('btn-add-user');
  btn.disabled = true;

  try {
    const data = await adminFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ gmail, special_access })
    });

    if (data.success) {
      showToast(`User ${gmail} saved!`, 'success');
      document.getElementById('user-gmail-input').value = '';
      document.getElementById('user-special-toggle').checked = false;
      loadUsers();
    } else {
      showToast(data.message || 'Error', 'error');
    }
  } catch { showToast('Server error', 'error'); }
  finally { btn.disabled = false; }
}

async function toggleSpecialAccess(gmail, newValue) {
  const data = await adminFetch(`/api/admin/users/${encodeURIComponent(gmail)}/special-access`, {
    method: 'PUT',
    body: JSON.stringify({ special_access: newValue })
  });
  if (data.success) {
    showToast(`Special access ${newValue ? 'granted' : 'revoked'} for ${gmail}`, 'success');
    loadUsers();
  }
}

async function forceLogout(gmail) {
  if (!confirm(`Force logout ${gmail}?`)) return;
  const data = await adminFetch(`/api/admin/users/${encodeURIComponent(gmail)}/logout`, { method: 'POST' });
  if (data.success) { showToast(`${gmail} logged out`, 'success'); loadUsers(); }
}

async function deleteUser(gmail) {
  if (!confirm(`Delete user ${gmail}? This will also delete their session.`)) return;
  const data = await adminFetch(`/api/admin/users/${encodeURIComponent(gmail)}`, { method: 'DELETE' });
  if (data.success) { showToast('User deleted', 'success'); loadUsers(); }
}

// ─── KEYS ──────────────────────────────────────────────
async function loadKeys() {
  const tbody = document.getElementById('keys-tbody');
  const filter = document.getElementById('key-filter').value;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>`;

  try {
    const data = await adminFetch('/api/admin/keys');
    let keys = data.data || [];

    if (filter === 'unused') keys = keys.filter(k => !k.used);
    if (filter === 'used') keys = keys.filter(k => k.used);

    if (keys.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">No keys found.</td></tr>`;
      return;
    }

    tbody.innerHTML = keys.map(key => {
      const isExpired = new Date(key.expires_at) < new Date();
      return `
        <tr>
          <td>
            <code style="font-family:'Courier New',monospace;color:var(--primary-light);font-weight:700;letter-spacing:1px;">
              ${escapeHtml(key.key_value)}
            </code>
          </td>
          <td class="gmail-cell">${escapeHtml(key.gmail || '(any)')}</td>
          <td>
            ${key.used
              ? '<span class="badge badge-danger">Used</span>'
              : isExpired
                ? '<span class="badge badge-warning">Expired</span>'
                : '<span class="badge badge-success">Active</span>'
            }
          </td>
          <td style="font-size:0.8rem;color:var(--text-muted);">${new Date(key.created_at).toLocaleDateString()}</td>
          <td style="font-size:0.8rem;color:var(--text-muted);">${new Date(key.expires_at).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="revokeKey(${key.id})">
              <i class="fa-solid fa-ban"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger);">Error loading keys</td></tr>`;
  }
}

async function generateAdminKey() {
  const gmail = document.getElementById('key-gmail-input').value.trim();
  const days = parseInt(document.getElementById('key-days-input').value) || 7;

  const btn = document.getElementById('btn-admin-gen-key');
  btn.disabled = true;

  try {
    const data = await adminFetch('/api/admin/keys/generate', {
      method: 'POST',
      body: JSON.stringify({ gmail: gmail || undefined, days })
    });

    if (data.success) {
      document.getElementById('admin-generated-key-value').textContent = data.key;
      document.getElementById('admin-generated-key-display').style.display = 'flex';
      showToast(`Key generated: ${data.key}`, 'success');
      loadKeys();
    } else {
      showToast(data.message || 'Error generating key', 'error');
    }
  } catch { showToast('Server error', 'error'); }
  finally { btn.disabled = false; }
}

async function revokeKey(id) {
  if (!confirm('Revoke this key?')) return;
  const data = await adminFetch(`/api/admin/keys/${id}`, { method: 'DELETE' });
  if (data.success) { showToast('Key revoked', 'success'); loadKeys(); }
}

// ─── Utility ───────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(text || '')));
  return div.innerHTML;
}

// ─── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAdminAuth()) return;

  const loader = document.getElementById('page-loader');

  // Setup nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchPanel(item.dataset.panel));
  });

  // Load initial dashboard stats
  loadStats();

  // Hide loader
  setTimeout(() => {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 500);
  }, 400);

  // Button event listeners
  document.getElementById('btn-add-section').addEventListener('click', addSection);
  document.getElementById('btn-refresh-sections').addEventListener('click', loadSections);

  document.getElementById('btn-add-playlist').addEventListener('click', addPlaylist);
  document.getElementById('btn-refresh-playlists').addEventListener('click', () => {
    const filter = document.getElementById('playlist-filter-section').value;
    loadPlaylists(filter);
  });
  document.getElementById('playlist-filter-section').addEventListener('change', (e) => {
    loadPlaylists(e.target.value);
  });

  document.getElementById('btn-save-live').addEventListener('click', saveLiveConfig);
  document.getElementById('live-active-toggle').addEventListener('change', (e) => {
    document.getElementById('live-toggle-label').textContent = e.target.checked ? 'Live' : 'Offline';
  });

  document.getElementById('btn-add-user').addEventListener('click', addUser);
  document.getElementById('btn-refresh-users').addEventListener('click', loadUsers);

  document.getElementById('btn-admin-gen-key').addEventListener('click', generateAdminKey);
  document.getElementById('btn-refresh-keys').addEventListener('click', loadKeys);
  document.getElementById('key-filter').addEventListener('change', loadKeys);
  document.getElementById('btn-copy-admin-key').addEventListener('click', () => {
    const key = document.getElementById('admin-generated-key-value').textContent;
    navigator.clipboard.writeText(key).then(() => showToast('Key copied!', 'success', 2000));
  });

  document.getElementById('btn-admin-logout').addEventListener('click', () => {
    localStorage.removeItem('edustream_admin_token');
    window.location.href = '/';
  });

  // Mobile sidebar toggle
  const sidebarToggle = document.getElementById('btn-toggle-sidebar');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      document.getElementById('admin-sidebar').classList.toggle('open');
    });
  }
});
