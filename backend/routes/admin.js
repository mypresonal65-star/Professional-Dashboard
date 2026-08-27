// Admin Routes - Full management panel APIs
const express = require('express');
const router = express.Router();
const db = require('../utils/cloudflareD1');
const { requireAdmin } = require('../middleware/authMiddleware');
const { generateKey, getExpiryDate } = require('../utils/keyGenerator');

// All admin routes require admin auth
router.use(requireAdmin);

// ═══════════════════════════════════════════
// SECTION MANAGEMENT
// ═══════════════════════════════════════════

// GET all sections
router.get('/sections', async (req, res) => {
  try {
    const sections = await db.query('SELECT * FROM sections ORDER BY order_index ASC');
    res.json({ success: true, data: sections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create section
router.post('/sections', async (req, res) => {
  try {
    const { name, order_index } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Section name required' });

    const maxOrder = await db.queryFirst('SELECT MAX(order_index) as max FROM sections');
    const order = order_index || (maxOrder?.max || 0) + 1;

    await db.execute(
      'INSERT INTO sections (name, order_index, created_at) VALUES (?, ?, ?)',
      [name, order, new Date().toISOString()]
    );

    const newSection = await db.queryFirst('SELECT * FROM sections WHERE name = ? ORDER BY id DESC LIMIT 1', [name]);
    res.json({ success: true, data: newSection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update section
router.put('/sections/:id', async (req, res) => {
  try {
    const { name, order_index } = req.body;
    await db.execute(
      'UPDATE sections SET name = ?, order_index = ? WHERE id = ?',
      [name, order_index, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE section
router.delete('/sections/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM playlists WHERE section_id = ?', [req.params.id]);
    await db.execute('DELETE FROM sections WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═══════════════════════════════════════════
// PLAYLIST MANAGEMENT
// ═══════════════════════════════════════════

// GET all playlists (optionally filtered by section)
router.get('/playlists', async (req, res) => {
  try {
    const { section_id } = req.query;
    let sql = `SELECT p.*, s.name as section_name 
               FROM playlists p 
               JOIN sections s ON p.section_id = s.id`;
    const params = [];
    
    if (section_id) {
      sql += ' WHERE p.section_id = ?';
      params.push(section_id);
    }
    sql += ' ORDER BY p.order_index ASC';

    const playlists = await db.query(sql, params);
    res.json({ success: true, data: playlists });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create playlist
router.post('/playlists', async (req, res) => {
  try {
    const { section_id, name, youtube_playlist_id, description } = req.body;
    if (!section_id || !name || !youtube_playlist_id) {
      return res.status(400).json({ success: false, message: 'section_id, name, and youtube_playlist_id required' });
    }

    const maxOrder = await db.queryFirst(
      'SELECT MAX(order_index) as max FROM playlists WHERE section_id = ?',
      [section_id]
    );
    const order = (maxOrder?.max || 0) + 1;

    await db.execute(
      `INSERT INTO playlists (section_id, name, youtube_playlist_id, description, order_index, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [section_id, name, youtube_playlist_id, description || '', order, new Date().toISOString()]
    );

    res.json({ success: true, message: 'Playlist added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update playlist
router.put('/playlists/:id', async (req, res) => {
  try {
    const { name, youtube_playlist_id, description, order_index, section_id } = req.body;
    await db.execute(
      `UPDATE playlists SET name = ?, youtube_playlist_id = ?, description = ?, 
       order_index = ?, section_id = ? WHERE id = ?`,
      [name, youtube_playlist_id, description, order_index, section_id, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE playlist
router.delete('/playlists/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM playlists WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═══════════════════════════════════════════
// LIVE STREAM MANAGEMENT
// ═══════════════════════════════════════════

// GET live stream config
router.get('/live', async (req, res) => {
  try {
    const live = await db.queryFirst('SELECT * FROM live_stream ORDER BY id DESC LIMIT 1');
    res.json({ success: true, data: live || { hls_url: '', is_active: 0, title: '' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST/PUT update live stream
router.post('/live', async (req, res) => {
  try {
    const { hls_url, is_active, title } = req.body;

    const existing = await db.queryFirst('SELECT id FROM live_stream ORDER BY id DESC LIMIT 1');
    
    if (existing) {
      await db.execute(
        'UPDATE live_stream SET hls_url = ?, is_active = ?, title = ?, updated_at = ? WHERE id = ?',
        [hls_url, is_active ? 1 : 0, title || 'Live Class', new Date().toISOString(), existing.id]
      );
    } else {
      await db.execute(
        'INSERT INTO live_stream (hls_url, is_active, title, updated_at) VALUES (?, ?, ?, ?)',
        [hls_url, is_active ? 1 : 0, title || 'Live Class', new Date().toISOString()]
      );
    }

    res.json({ success: true, message: 'Live stream updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═══════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════

// GET all users
router.get('/users', async (req, res) => {
  try {
    const users = await db.query(
      `SELECT u.*, 
        (SELECT COUNT(*) FROM access_keys ak WHERE ak.gmail = u.gmail AND ak.used = 1) as keys_used,
        (SELECT expires_at FROM sessions s WHERE s.gmail = u.gmail LIMIT 1) as session_expires
       FROM users u ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST add user / grant special access
router.post('/users', async (req, res) => {
  try {
    const { gmail, special_access } = req.body;
    if (!gmail) return res.status(400).json({ success: false, message: 'Gmail required' });

    const normalizedGmail = gmail.toLowerCase().trim();
    
    await db.execute(
      `INSERT INTO users (gmail, special_access, created_at) VALUES (?, ?, ?)
       ON CONFLICT(gmail) DO UPDATE SET special_access = excluded.special_access`,
      [normalizedGmail, special_access ? 1 : 0, new Date().toISOString()]
    );

    res.json({ success: true, message: 'User saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT toggle special access
router.put('/users/:gmail/special-access', async (req, res) => {
  try {
    const { special_access } = req.body;
    const gmail = decodeURIComponent(req.params.gmail);
    
    await db.execute(
      'UPDATE users SET special_access = ? WHERE gmail = ?',
      [special_access ? 1 : 0, gmail]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE user
router.delete('/users/:gmail', async (req, res) => {
  try {
    const gmail = decodeURIComponent(req.params.gmail);
    await db.execute('DELETE FROM users WHERE gmail = ?', [gmail]);
    await db.execute('DELETE FROM sessions WHERE gmail = ?', [gmail]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST force logout user
router.post('/users/:gmail/logout', async (req, res) => {
  try {
    const gmail = decodeURIComponent(req.params.gmail);
    await db.execute('DELETE FROM sessions WHERE gmail = ?', [gmail]);
    res.json({ success: true, message: 'User logged out' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═══════════════════════════════════════════
// KEY MANAGEMENT
// ═══════════════════════════════════════════

// GET all keys
router.get('/keys', async (req, res) => {
  try {
    const keys = await db.query(
      'SELECT * FROM access_keys ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ success: true, data: keys });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST generate key for specific gmail
router.post('/keys/generate', async (req, res) => {
  try {
    const { gmail, days } = req.body;
    if (!gmail) return res.status(400).json({ success: false, message: 'Gmail required' });

    const newKey = generateKey();
    const expiresAt = getExpiryDate(days || 7);

    await db.execute(
      `INSERT INTO access_keys (key_value, gmail, used, created_at, expires_at) VALUES (?, ?, 0, ?, ?)`,
      [newKey, gmail.toLowerCase().trim(), new Date().toISOString(), expiresAt]
    );

    res.json({ success: true, key: newKey, expiresAt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE revoke key
router.delete('/keys/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM access_keys WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST reset keys for user (delete unused keys)
router.post('/keys/reset/:gmail', async (req, res) => {
  try {
    const gmail = decodeURIComponent(req.params.gmail);
    await db.execute('DELETE FROM access_keys WHERE gmail = ? AND used = 0', [gmail]);
    res.json({ success: true, message: 'Unused keys reset for ' + gmail });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═══════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const [userCount, activeSessionCount, keyCount, sectionCount] = await Promise.all([
      db.queryFirst('SELECT COUNT(*) as count FROM users'),
      db.queryFirst('SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?', [new Date().toISOString()]),
      db.queryFirst('SELECT COUNT(*) as count FROM access_keys WHERE used = 0'),
      db.queryFirst('SELECT COUNT(*) as count FROM sections'),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers: userCount?.count || 0,
        activeSessions: activeSessionCount?.count || 0,
        unusedKeys: keyCount?.count || 0,
        totalSections: sectionCount?.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
