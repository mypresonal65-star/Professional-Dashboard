// Videos Routes - Sections, Playlists, Live Stream for users
const express = require('express');
const router = express.Router();
const db = require('../utils/cloudflareD1');
const { requireAuth } = require('../middleware/authMiddleware');
const { getPlaylistItems } = require('../utils/youtubeApi');

// ─────────────────────────────────────────────
// GET /api/videos/sections - All sections with playlists
// ─────────────────────────────────────────────
router.get('/sections', requireAuth, async (req, res) => {
  try {
    const sections = await db.query(
      'SELECT * FROM sections ORDER BY order_index ASC'
    );

    const playlists = await db.query(
      'SELECT * FROM playlists ORDER BY section_id, order_index ASC'
    );

    // Group playlists under sections
    const sectionsWithPlaylists = sections.map(section => ({
      ...section,
      playlists: playlists.filter(p => p.section_id === section.id)
    }));

    res.json({ success: true, data: sectionsWithPlaylists });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/videos/live - Live stream info
// ─────────────────────────────────────────────
router.get('/live', requireAuth, async (req, res) => {
  try {
    const live = await db.queryFirst(
      'SELECT * FROM live_stream ORDER BY id DESC LIMIT 1'
    );

    if (!live || !live.is_active) {
      return res.json({ success: true, data: null, message: 'No active live stream' });
    }

    res.json({ success: true, data: live });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/videos/playlist/:playlistId - YT playlist items
// ─────────────────────────────────────────────
router.get('/playlist/:playlistId', requireAuth, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const accessToken = req.headers['x-yt-token'];

    if (!accessToken) {
      // Return just the playlist info without items (user needs to auth with YT)
      const playlist = await db.queryFirst(
        'SELECT * FROM playlists WHERE youtube_playlist_id = ?',
        [playlistId]
      );
      return res.json({
        success: true,
        data: [],
        requiresYouTubeAuth: true,
        playlist
      });
    }

    const items = await getPlaylistItems(playlistId, accessToken);
    
    res.json({
      success: true,
      data: items.map(item => ({
        videoId: item.contentDetails?.videoId,
        title: item.snippet?.title,
        description: item.snippet?.description,
        thumbnail: item.snippet?.thumbnails?.medium?.url,
        position: item.snippet?.position
      }))
    });
  } catch (error) {
    console.error('Playlist fetch error:', error);
    res.status(500).json({ success: false, message: 'Could not fetch playlist' });
  }
});

// ─────────────────────────────────────────────
// GET /api/videos/search - Search across playlists
// ─────────────────────────────────────────────
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { q, section_id } = req.query;
    
    if (!q) return res.json({ success: true, data: [] });

    let sql = `SELECT p.*, s.name as section_name 
               FROM playlists p 
               JOIN sections s ON p.section_id = s.id 
               WHERE p.name LIKE ?`;
    const params = [`%${q}%`];

    if (section_id) {
      sql += ' AND p.section_id = ?';
      params.push(section_id);
    }

    const results = await db.query(sql, params);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
