/**
 * EduStream Pro – YouTube OAuth Helper
 * Handles YouTube authentication and private video access
 */

const YT_STORAGE_KEY = 'edustream_yt_tokens';

// ─── YouTube Token Management ──────────────────────────
const YouTube = {
  tokens: null,

  init() {
    // Load tokens from storage
    const stored = localStorage.getItem(YT_STORAGE_KEY);
    if (stored) {
      try {
        this.tokens = JSON.parse(stored);
      } catch {
        this.tokens = null;
      }
    }

    // Check for tokens in URL (after OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const ytTokens = urlParams.get('yt_tokens');
    const ytError = urlParams.get('yt_error');

    if (ytTokens) {
      try {
        this.tokens = JSON.parse(atob(ytTokens));
        localStorage.setItem(YT_STORAGE_KEY, JSON.stringify(this.tokens));
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        window.showToast && window.showToast('YouTube connected! You can now watch private videos.', 'success');
      } catch {
        console.error('Failed to parse YouTube tokens');
      }
    }

    if (ytError) {
      window.history.replaceState({}, '', window.location.pathname);
      window.showToast && window.showToast('YouTube connection failed. Please try again.', 'error');
    }
  },

  isConnected() {
    return this.tokens && this.tokens.access_token;
  },

  getAccessToken() {
    return this.tokens?.access_token || null;
  },

  async startAuth() {
    try {
      const API = window.API_BASE || '';
      const token = localStorage.getItem('edustream_token');

      const res = await fetch(`${API}/api/auth/youtube`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        window.showToast && window.showToast('Could not initiate YouTube auth', 'error');
      }
    } catch (err) {
      console.error('YT auth start error:', err);
      window.showToast && window.showToast('Server error during YouTube auth', 'error');
    }
  },

  disconnect() {
    this.tokens = null;
    localStorage.removeItem(YT_STORAGE_KEY);
  },

  // Build YouTube embed URL (supports private videos with OAuth)
  buildEmbedUrl(videoId, options = {}) {
    const params = new URLSearchParams({
      autoplay: options.autoplay ? '1' : '0',
      rel: '0',
      modestbranding: '1',
      enablejsapi: '1',
      origin: window.location.origin,
      ...options
    });

    // For private videos, we use the youtube-nocookie.com embed
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  },

  // Build playlist embed URL
  buildPlaylistEmbedUrl(playlistId, videoIndex = 0) {
    const params = new URLSearchParams({
      list: playlistId,
      index: videoIndex + 1,
      autoplay: '0',
      rel: '0',
      modestbranding: '1',
      enablejsapi: '1',
      origin: window.location.origin
    });
    return `https://www.youtube-nocookie.com/embed/videoseries?${params.toString()}`;
  }
};

// Export globally
window.YouTube = YouTube;
