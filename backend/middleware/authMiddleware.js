// Auth Middleware - Validate user sessions
const { verifySessionToken, isExpired } = require('../utils/keyGenerator');
const db = require('../utils/cloudflareD1');

/**
 * Middleware to verify user is authenticated
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.session_token;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const decoded = verifySessionToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid session token' });
    }

    // Check session in DB
    const session = await db.queryFirst(
      'SELECT * FROM sessions WHERE gmail = ? AND device_token = ?',
      [decoded.gmail, decoded.deviceToken]
    );

    if (!session) {
      return res.status(401).json({ success: false, message: 'Session expired or logged out from another device' });
    }

    // Check if access is still valid
    if (isExpired(session.expires_at)) {
      return res.status(401).json({ success: false, message: 'Access expired. Please use a new key.' });
    }

    // Update last active
    await db.execute(
      'UPDATE sessions SET last_active = ? WHERE id = ?',
      [new Date().toISOString(), session.id]
    );

    req.user = { gmail: decoded.gmail, deviceToken: decoded.deviceToken, sessionId: session.id };
    req.session = session;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Server error during authentication' });
  }
}

/**
 * Middleware to verify admin access
 */
async function requireAdmin(req, res, next) {
  try {
    const adminToken = req.headers['x-admin-token'] || req.cookies?.admin_token;

    if (!adminToken) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const adminConfig = await db.queryFirst(
      "SELECT value FROM admin_config WHERE key = 'admin_token'",
      []
    );

    if (!adminConfig || adminConfig.value !== adminToken) {
      return res.status(403).json({ success: false, message: 'Invalid admin token' });
    }

    req.isAdmin = true;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { requireAuth, requireAdmin };
