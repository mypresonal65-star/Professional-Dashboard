// EduStream Pro - Main Express Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ───────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'", "'unsafe-eval'",
        "https://www.youtube.com",
        "https://s.ytimg.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://accounts.google.com"
      ],
      frameSrc: [
        "'self'",
        "https://www.youtube.com",
        "https://www.youtube-nocookie.com",
        "https://accounts.google.com"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.cloudflare.com", "https://www.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
    }
  }
}));

// ─── Rate Limiting ─────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts' }
});

// ─── General Middleware ────────────────────────────────
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Static Files ──────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── API Routes ────────────────────────────────────────
app.use('/api/auth', loginLimiter, require('./routes/auth'));
app.use('/api/admin', apiLimiter, require('./routes/admin'));
app.use('/api/videos', apiLimiter, require('./routes/videos'));

// ─── Health Check ──────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ─── SPA Fallback ──────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// ─── Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Start Server ──────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║     EduStream Pro Server Started! 🚀     ║
║  Running at: http://localhost:${PORT}        ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
