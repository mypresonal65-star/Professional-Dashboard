// Auth Routes - Login, Key Generation, Google OAuth
const express = require('express');
const router = express.Router();
const db = require('../utils/cloudflareD1');
const {
  generateKey,
  generateDeviceToken,
  generateSessionToken,
  getExpiryDate,
  isExpired
} = require('../utils/keyGenerator');
const { getAuthUrl, getTokens } = require('../utils/youtubeApi');
const crypto = require('crypto');

// ─────────────────────────────────────────────
// POST /api/auth/login
// Body: { gmail, key, deviceFingerprint }
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { gmail, key, deviceFingerprint } = req.body;

    if (!gmail) {
      return res.status(400).json({ success: false, message: 'Gmail required' });
    }

    const normalizedGmail = gmail.toLowerCase().trim();

    // Check if special access user (no key needed)
    const specialUser = await db.queryFirst(
      'SELECT * FROM users WHERE gmail = ? AND special_access = 1',
      [normalizedGmail]
    );

    let expiresAt;
    let isSpecial = false;

    if (specialUser) {
      isSpecial = true;
      // Special users get 30 days access
      expiresAt = getExpiryDate(30);
    } else {
      // Regular key-based login
      if (!key) {
        return res.status(400).json({ success: false, message: 'Access key required' });
      }

      const cleanKey = key.toUpperCase().trim();
      
      // Find the key in database
      const accessKey = await db.queryFirst(
        'SELECT * FROM access_keys WHERE key_value = ? AND gmail = ? AND used = 0',
        [cleanKey, normalizedGmail]
      );

      if (!accessKey) {
        // Check if key exists but used
        const usedKey = await db.queryFirst(
          'SELECT * FROM access_keys WHERE key_value = ? AND used = 1',
          [cleanKey]
        );
        if (usedKey) {
          return res.status(400).json({ success: false, message: 'This key has already been used' });
        }
        return res.status(400).json({ success: false, message: 'Invalid key or Gmail mismatch' });
      }

      // Check if key is expired
      if (isExpired(accessKey.expires_at)) {
        return res.status(400).json({ success: false, message: 'This key has expired' });
      }

      // Mark key as used
      await db.execute(
        'UPDATE access_keys SET used = 1, used_at = ? WHERE id = ?',
        [new Date().toISOString(), accessKey.id]
      );

      expiresAt = getExpiryDate(2); // 2 days access
    }

    // Generate device token & session token
    const deviceToken = generateDeviceToken();
    const sessionToken = generateSessionToken(normalizedGmail, deviceToken);

    // Invalidate old sessions (single device enforcement)
    const oldSessions = await db.query(
      'SELECT id FROM sessions WHERE gmail = ?',
      [normalizedGmail]
    );

    if (oldSessions.length > 0) {
      await db.execute(
        'DELETE FROM sessions WHERE gmail = ?',
        [normalizedGmail]
      );
    }

    // Create new session
    await db.execute(
      `INSERT INTO sessions (gmail, device_token, device_fingerprint, last_active, expires_at, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        normalizedGmail,
        deviceToken,
        deviceFingerprint || 'unknown',
        new Date().toISOString(),
        expiresAt,
        new Date().toISOString()
      ]
    );

    // Log login
    await db.execute(
      'INSERT OR IGNORE INTO users (gmail, special_access, created_at) VALUES (?, 0, ?)',
      [normalizedGmail, new Date().toISOString()]
    );

    res.json({
      success: true,
      token: sessionToken,
      gmail: normalizedGmail,
      expiresAt,
      isSpecial
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/generate-key
// Body: { gmail }
// ─────────────────────────────────────────────
router.post('/generate-key', async (req, res) => {
  try {
    const { gmail } = req.body;

    if (!gmail) {
      return res.status(400).json({ success: false, message: 'Gmail required' });
    }

    const normalizedGmail = gmail.toLowerCase().trim();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check daily generation limit (max 3 per day)
    const todayLog = await db.queryFirst(
      'SELECT count FROM key_generation_log WHERE gmail = ? AND date = ?',
      [normalizedGmail, today]
    );

    const currentCount = todayLog ? todayLog.count : 0;

    if (currentCount >= 3) {
      const nextReset = new Date();
      nextReset.setDate(nextReset.getDate() + 1);
      nextReset.setHours(0, 0, 0, 0);
      
      return res.status(429).json({
        success: false,
        message: 'Daily key generation limit reached (3/day)',
        resetAt: nextReset.toISOString(),
        remaining: 0
      });
    }

    // Generate new key
    const newKey = generateKey();
    const keyExpiresAt = getExpiryDate(7); // Key valid for 7 days to use

    // Store key in database (linked to gmail)
    await db.execute(
      `INSERT INTO access_keys (key_value, gmail, used, created_at, expires_at) 
       VALUES (?, ?, 0, ?, ?)`,
      [newKey, normalizedGmail, new Date().toISOString(), keyExpiresAt]
    );

    // Update generation log
    if (todayLog) {
      await db.execute(
        'UPDATE key_generation_log SET count = count + 1 WHERE gmail = ? AND date = ?',
        [normalizedGmail, today]
      );
    } else {
      await db.execute(
        'INSERT INTO key_generation_log (gmail, date, count) VALUES (?, ?, 1)',
        [normalizedGmail, today]
      );
    }

    res.json({
      success: true,
      key: newKey,
      remaining: 2 - currentCount,
      expiresAt: keyExpiresAt,
      message: 'Key generated! Use it within 7 days.'
    });

  } catch (error) {
    console.error('Key generation error:', error);
    res.status(500).json({ success: false, message: 'Server error during key generation' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { verifySessionToken } = require('../utils/keyGenerator');
      const decoded = verifySessionToken(token);
      if (decoded) {
        await db.execute(
          'DELETE FROM sessions WHERE gmail = ? AND device_token = ?',
          [decoded.gmail, decoded.deviceToken]
        );
      }
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Logout error' });
  }
});

// ─────────────────────────────────────────────
// GET /api/auth/verify
// ─────────────────────────────────────────────
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.json({ valid: false });

    const { verifySessionToken } = require('../utils/keyGenerator');
    const decoded = verifySessionToken(token);
    if (!decoded) return res.json({ valid: false });

    const session = await db.queryFirst(
      'SELECT * FROM sessions WHERE gmail = ? AND device_token = ?',
      [decoded.gmail, decoded.deviceToken]
    );

    if (!session || isExpired(session.expires_at)) {
      return res.json({ valid: false, expired: true });
    }

    res.json({
      valid: true,
      gmail: decoded.gmail,
      expiresAt: session.expires_at,
      timeRemaining: new Date(session.expires_at) - new Date()
    });
  } catch (error) {
    res.json({ valid: false });
  }
});

// ─────────────────────────────────────────────
// Admin Login
// POST /api/auth/admin-login
// Body: { password }
// ─────────────────────────────────────────────
router.post('/admin-login', async (req, res) => {
  try {
    const { password } = req.body;
    
    const adminConfig = await db.queryFirst(
      "SELECT value FROM admin_config WHERE key = 'admin_password'",
      []
    );

    if (!adminConfig || adminConfig.value !== password) {
      return res.status(403).json({ success: false, message: 'Invalid admin password' });
    }

    // Generate admin token
    const adminToken = crypto.randomBytes(32).toString('hex');
    
    // Store admin token temporarily (24 hours)
    await db.execute(
      "INSERT OR REPLACE INTO admin_config (key, value) VALUES ('admin_token', ?)",
      [adminToken]
    );

    res.json({ success: true, adminToken });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// YouTube OAuth
// ─────────────────────────────────────────────
router.get('/youtube', (req, res) => {
  const authUrl = getAuthUrl();
  res.json({ success: true, authUrl });
});

router.get('/youtube/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/dashboard.html?yt_error=no_code');

    const tokens = await getTokens(code);
    // Return tokens to frontend via URL params (in production use secure storage)
    const encodedToken = Buffer.from(JSON.stringify(tokens)).toString('base64');
    res.redirect(`/dashboard.html?yt_tokens=${encodedToken}`);
  } catch (error) {
    console.error('YouTube callback error:', error);
    res.redirect('/dashboard.html?yt_error=auth_failed');
  }
});

module.exports = router;
