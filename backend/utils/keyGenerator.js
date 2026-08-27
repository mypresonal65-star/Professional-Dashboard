// Key Generator Utility
const crypto = require('crypto');

/**
 * Generate a secure access key
 * Format: XXXX-XXXX-XXXX-XXXX (alphanumeric)
 */
function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  let key = '';
  const segments = 4;
  const segmentLength = 4;

  for (let s = 0; s < segments; s++) {
    if (s > 0) key += '-';
    for (let i = 0; i < segmentLength; i++) {
      const randomByte = crypto.randomBytes(1)[0];
      key += chars[randomByte % chars.length];
    }
  }

  return key;
}

/**
 * Generate a unique device token for session management
 */
function generateDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a JWT-like session token
 */
function generateSessionToken(gmail, deviceToken) {
  const payload = Buffer.from(JSON.stringify({
    gmail,
    deviceToken,
    iat: Date.now()
  })).toString('base64');
  
  const secret = process.env.JWT_SECRET || 'edustream-secret-key-change-this';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');
  
  return `${payload}.${signature}`;
}

/**
 * Verify a session token
 */
function verifySessionToken(token) {
  try {
    const [payload, signature] = token.split('.');
    const secret = process.env.JWT_SECRET || 'edustream-secret-key-change-this';
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
    
    if (signature !== expectedSig) return null;
    
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  } catch {
    return null;
  }
}

/**
 * Calculate expiry date (2 days from now)
 */
function getExpiryDate(days = 2) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Check if date is expired
 */
function isExpired(dateString) {
  return new Date(dateString) < new Date();
}

module.exports = {
  generateKey,
  generateDeviceToken,
  generateSessionToken,
  verifySessionToken,
  getExpiryDate,
  isExpired
};
