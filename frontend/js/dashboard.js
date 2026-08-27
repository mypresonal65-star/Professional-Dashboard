/**
 * EduStream Pro – Dashboard JS
 * Handles: auth check, timer, live stream, sections, playlists, video drawer
 */

const API = window.API_BASE || '';
let currentPlaylistId = null;
let hlsPlayer = null;
let timerInterval = null;

// ─── Toast System ──────────────────────────────────────
window.showToast = function(message, type = 'info', duration = 4000) {
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
};

// ─── Auth Check & Session Validation ──────────────────
async function checkAuth() {
  const token = localStorage.getItem('edustream_token');
  if (!token) {
    window.location.href = '/';
    return null;
  }

  try {
    const res = await fetch(`${API}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.valid) {
      if (data.expired) {
        showToast('Access expired! Please use a new key.', 'warning');
      }
      localStorage.clear();
      setTimeout(() => { window.location.href = '/'; }, 1500);
      return null;
    }

    return data;
  } catch {
    // If server is down, use local storage as fallback for short period
    const expires = localStorage.getItem('edustream_expires');
    if (expires && new Date(expires) > new Date()) {
      return {
        gmail: localStorage.getItem('edustream_gmail'),
        expiresAt: expires,
        valid: true
      };
    }
    window.location.href = '/';
    return null;
  }
}

// ─── Access Timer ──────────────────────────────────────
function startAccessTimer(expiresAt) {
  const timerEl = document.getElementById('timer-value');
  const timerContainer = document.getElementById('access-timer');

  function update() {
    const now = new Date();
    const exp = new Date(expiresAt);
    const diff = exp - now;

    if (diff <= 0) {
      timerEl.textContent = 'EXPIRED';
      timerEl.parentElement.style.color = 'var(--danger)';
      clearInterval(timerInterval);
      showToast('Access expired! Redirecting to login...', 'warning');
      setTimeout(() => {
        localStorage.clear();
        window.location.href = '/';
      }, 3000);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) {
      timerEl.textContent = `${days}d ${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    } else {
      timerEl.textContent = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    }

    // Expiring soon warning (< 1 hour)
    if (diff < 3600000) {
      timerEl.classList.add('expiring-soon');
    }
  }

  update();
  timerInterval = setInterval(update, 1000);
}

// ─── User Info in Topbar ───────────────────────────────
function setupUserInfo(gmail, expiresAt) {
  const gmailEl = document.getElementById('user-gmail');
  const avatarEl = document.getElementById('user-avatar');

  if (gmailEl) gmailEl.textContent = gmail;
  if (avatarEl) avatarEl.textContent = gmail.charAt(0).toUpperCase();

  if (expiresAt) startAccessTimer(expiresAt);
}

// ─── Load Live Stream ──────────────────────────────────
async function loadLiveStream() {
  const token = localStorage.getItem('edustream_token');
  const badge = document.getElementById('live-status-badge');
  const container = document.getElementById('live-player-container');

  try {
    const res = await fetch(`${API}/api/videos/live`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.data && data.data.is_active) {
      const live = data.data;
      badge.textContent = '● LIVE';
      badge.style.display = 'inline-flex';

      // Clear offline message and create video player
      container.innerHTML = `
        <div class="video-player-container">
          <div class="video-player-wrapper">
            <video
              id="live-video-player"
              class="video-js vjs-theme-city vjs-big-play-centered"
              controls
              preload="auto"
              data-setup='{}'
            >
              <p class="vjs-no-js">Please enable JavaScript to watch this live stream.</p>
            </video>
          </div>
          <div style="padding:12px 16px;background:rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;">
            <span style="color:#ef4444;font-size:0.75rem;font-weight:700;animation:pulse 1.5s infinite;">● LIVE</span>
            <span style="font-weight:600;">${live.title || 'Live Class'}</span>
          </div>
        </div>
      `;

      // Initialize Video.js + HLS.js
      const video = document.getElementById('live-video-player');

      if (typeof Hls !== 'undefined' && Hls.isSupported() && live.hls_url) {
        const hls = new Hls();
        hls.loadSource(live.hls_url);
        hls.attachMedia(video);
        hlsPlayer = hls;

        if (typeof videojs !== 'undefined') {
          videojs(video, {
            controls: true,
            autoplay: false,
            responsive: true,
            fluid: true,
          });
        }
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari)
        video.src = live.hls_url;
      }
    } else {
      // No live stream
      badge.style.display = 'none';
    }
  } catch (err) {
    console.error('Live stream error:', err);
  }
}

// ─── Load Sections & Playlists ─────────────────────────
async function loadSections() {
  const token = localStorage.getItem('edustream_token');

  try {
    const res = await fetch(`${API}/api/videos/sections`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success) throw new Error('Failed to load sections');

    renderSections(data.data);
  } catch (err) {
    console.error('Sections load error:', err);
    document.getElementById('sections-list').innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-muted);">
        <div style="font-size:2rem;margin-bottom:8px;">⚠️</div>
        <div>Could not load content. Please refresh the page.</div>
      </div>
    `;
  }
}

// ─── Render Sections ───────────────────────────────────
function renderSections(sections) {
  const list = document.getElementById('sections-list');

  if (!sections || sections.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-muted);">
        <div style="font-size:2rem;margin-bottom:8px;">📂</div>
        <div>No content sections available yet.</div>
        <div style="font-size:0.8rem;margin-top:4px;">Check back later or contact admin.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = sections.map(section => {
    const playlistsHtml = section.playlists.length > 0
      ? section.playlists.map(pl => `
        <div class="playlist-card" data-playlist-id="${pl.youtube_playlist_id}" data-playlist-name="${escapeHtml(pl.name)}" onclick="openPlaylistDrawer('${pl.youtube_playlist_id}', '${escapeHtml(pl.name)}')">
          <div class="playlist-thumbnail">🎬</div>
          <div class="playlist-info">
            <div class="playlist-name">${escapeHtml(pl.name)}</div>
            <div class="playlist-meta">${escapeHtml(pl.description || 'YouTube Playlist')}</div>
          </div>
          <i class="playlist-arrow fa-solid fa-chevron-right"></i>
        </div>
      `).join('')
      : `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.85rem;">No playlists in this section yet.</div>`;

    return `
      <div class="section-accordion" id="section-${section.id}">
        <div class="section-accordion-header" onclick="toggleSection(${section.id})">
          <div class="section-icon">${section.icon || '📚'}</div>
          <div class="section-info">
            <div class="section-name">${escapeHtml(section.name)}</div>
            <div class="section-count">${section.playlists.length} playlist${section.playlists.length !== 1 ? 's' : ''}</div>
          </div>
          <i class="section-chevron fa-solid fa-chevron-down"></i>
        </div>
        <div class="section-accordion-body" id="body-${section.id}">
          <div class="section-body-inner">
            <!-- Section Search -->
            <div class="section-search">
              <i class="section-search-icon fa-solid fa-magnifying-glass"></i>
              <input
                type="search"
                class="section-search-input"
                placeholder="Search in ${escapeHtml(section.name)}..."
                oninput="filterSectionPlaylists(${section.id}, this.value)"
              />
            </div>
            <!-- Playlists Grid -->
            <div class="playlists-grid" id="playlists-${section.id}">
              ${playlistsHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Toggle Section ────────────────────────────────────
function toggleSection(sectionId) {
  const accordion = document.getElementById(`section-${sectionId}`);
  accordion.classList.toggle('open');
}

// ─── Filter Playlists in Section ───────────────────────
function filterSectionPlaylists(sectionId, query) {
  const grid = document.getElementById(`playlists-${sectionId}`);
  if (!grid) return;

  const cards = grid.querySelectorAll('.playlist-card');
  const q = query.toLowerCase().trim();

  cards.forEach(card => {
    const name = card.querySelector('.playlist-name')?.textContent.toLowerCase() || '';
    card.style.display = !q || name.includes(q) ? '' : 'none';
  });
}

// ─── Global Search ─────────────────────────────────────
function handleGlobalSearch(query) {
  const q = query.toLowerCase().trim();
  const allCards = document.querySelectorAll('.playlist-card');
  const allAccordions = document.querySelectorAll('.section-accordion');

  if (!q) {
    allCards.forEach(c => c.style.display = '');
    allAccordions.forEach(a => a.classList.remove('open'));
    return;
  }

  allAccordions.forEach(accordion => {
    const cards = accordion.querySelectorAll('.playlist-card');
    let hasVisible = false;

    cards.forEach(card => {
      const name = card.querySelector('.playlist-name')?.textContent.toLowerCase() || '';
      const visible = name.includes(q);
      card.style.display = visible ? '' : 'none';
      if (visible) hasVisible = true;
    });

    // Open/close accordion based on results
    if (hasVisible) {
      accordion.classList.add('open');
    } else {
      accordion.classList.remove('open');
    }
  });
}

// ─── Playlist Drawer ───────────────────────────────────
async function openPlaylistDrawer(playlistId, playlistName) {
  currentPlaylistId = playlistId;

  document.getElementById('drawer-playlist-name').textContent = playlistName;
  document.getElementById('drawer-video-list').innerHTML = `
    <div style="text-align:center;padding:30px;color:var(--text-muted);">
      <i class="fa-solid fa-spinner fa-spin"></i> Loading videos...
    </div>
  `;
  document.getElementById('video-drawer-overlay').style.display = 'flex';
  document.getElementById('drawer-video-player').style.display = 'none';
  document.getElementById('yt-auth-required').style.display = 'none';

  const token = localStorage.getItem('edustream_token');
  const ytToken = YouTube.isConnected() ? YouTube.getAccessToken() : null;

  try {
    const headers = { 'Authorization': `Bearer ${token}` };
    if (ytToken) headers['x-yt-token'] = ytToken;

    const res = await fetch(`${API}/api/videos/playlist/${playlistId}`, { headers });
    const data = await res.json();

    if (data.requiresYouTubeAuth) {
      document.getElementById('yt-auth-required').style.display = 'block';
      document.getElementById('drawer-video-list').innerHTML = '';
      document.getElementById('drawer-video-count').textContent = 'Connect YouTube to view';

      // Show embedded playlist anyway for public videos
      showEmbeddedPlaylist(playlistId);
      return;
    }

    if (data.success && data.data.length > 0) {
      renderVideoList(data.data, playlistId);
    } else {
      // Fall back to embedded playlist
      showEmbeddedPlaylist(playlistId);
    }
  } catch (err) {
    console.error('Playlist load error:', err);
    showEmbeddedPlaylist(playlistId);
  }
}

function showEmbeddedPlaylist(playlistId) {
  const embedUrl = YouTube.buildPlaylistEmbedUrl(playlistId);
  const player = document.getElementById('drawer-video-player');
  const iframe = document.getElementById('yt-iframe');

  iframe.src = embedUrl;
  player.style.display = 'block';

  document.getElementById('drawer-video-count').textContent = 'Playing from YouTube';
  document.getElementById('drawer-video-list').innerHTML = '';
}

function renderVideoList(videos, playlistId) {
  const list = document.getElementById('drawer-video-list');
  const count = document.getElementById('drawer-video-count');

  count.textContent = `${videos.length} video${videos.length !== 1 ? 's' : ''}`;

  list.innerHTML = videos.map((video, idx) => `
    <div
      class="video-item ${idx === 0 ? 'playing' : ''}"
      id="video-item-${video.videoId}"
      onclick="playVideo('${video.videoId}', ${idx})"
    >
      <div class="video-item-num">${idx + 1}</div>
      <div class="video-item-thumb">
        ${video.thumbnail
          ? `<img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy" />`
          : '🎬'
        }
      </div>
      <div class="video-item-info">
        <div class="video-item-title">${escapeHtml(video.title)}</div>
      </div>
    </div>
  `).join('');

  // Auto-play first video
  if (videos.length > 0) {
    playVideo(videos[0].videoId, 0);
  }
}

function playVideo(videoId, index) {
  const player = document.getElementById('drawer-video-player');
  const iframe = document.getElementById('yt-iframe');

  // Update playing state
  document.querySelectorAll('.video-item').forEach(el => el.classList.remove('playing'));
  const item = document.getElementById(`video-item-${videoId}`);
  if (item) item.classList.add('playing');

  iframe.src = YouTube.buildEmbedUrl(videoId, { autoplay: index > 0 ? '1' : '0' });
  player.style.display = 'block';

  // Scroll to player
  player.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeDrawer() {
  document.getElementById('video-drawer-overlay').style.display = 'none';
  // Stop video
  const iframe = document.getElementById('yt-iframe');
  if (iframe) iframe.src = '';
  currentPlaylistId = null;
}

// ─── YouTube Button ────────────────────────────────────
function updateYouTubeButton() {
  const btn = document.getElementById('btn-yt-login');
  const btnText = document.getElementById('yt-btn-text');

  if (YouTube.isConnected()) {
    btn.classList.add('connected');
    btnText.textContent = 'YouTube ✓';
    btn.title = 'YouTube connected. Click to disconnect.';
  } else {
    btn.classList.remove('connected');
    btnText.textContent = 'Connect YouTube';
    btn.title = 'Connect YouTube for private videos';
  }
}

// ─── Logout ────────────────────────────────────────────
async function handleLogout() {
  const token = localStorage.getItem('edustream_token');

  try {
    await fetch(`${API}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch {}

  localStorage.clear();
  window.location.href = '/';
}

// ─── Utility ───────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text || ''));
  return div.innerHTML;
}

// ─── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const loader = document.getElementById('page-loader');

  // Auth check
  const session = await checkAuth();
  if (!session) return;

  // Setup YouTube
  YouTube.init();

  // Setup UI
  const gmail = session.gmail || localStorage.getItem('edustream_gmail');
  const expiresAt = session.expiresAt || localStorage.getItem('edustream_expires');

  setupUserInfo(gmail, expiresAt);
  updateYouTubeButton();

  // Load content
  await Promise.all([
    loadLiveStream(),
    loadSections()
  ]);

  // Hide loader
  loader.classList.add('hidden');
  setTimeout(() => loader.remove(), 500);

  // Event Listeners
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  document.getElementById('btn-yt-login').addEventListener('click', () => {
    if (YouTube.isConnected()) {
      YouTube.disconnect();
      updateYouTubeButton();
      showToast('YouTube disconnected', 'info');
    } else {
      YouTube.startAuth();
    }
  });

  document.getElementById('btn-close-drawer').addEventListener('click', closeDrawer);
  document.getElementById('video-drawer-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('video-drawer-overlay')) closeDrawer();
  });

  // YouTube auth from drawer
  const ytAuthBtn = document.getElementById('btn-yt-auth-from-drawer');
  if (ytAuthBtn) ytAuthBtn.addEventListener('click', () => YouTube.startAuth());

  // Global search
  document.getElementById('global-search-input').addEventListener('input', (e) => {
    handleGlobalSearch(e.target.value);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Auto-refresh live status every 60 seconds
  setInterval(loadLiveStream, 60000);
});
