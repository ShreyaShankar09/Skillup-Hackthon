// server.js — SkillUp backend entry point.
// Registers middleware, initialises the SQLite DB, mounts all API routes,
// and serves the frontend from public/.

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const helmet  = require('helmet');
const http    = require('http');
const path    = require('path');

require('./config/db');
require('./config/auth');

const apiRoutes = require('./routes/index');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security headers ──────────────────────────────────────────────────────────
// CSP is relaxed for inline styles/scripts because the frontend is a single
// self-contained HTML file. Tighten this if you ever split the assets out.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      // ── This line is the fix ──────────────────────────────────────────────
      // CSP treats onclick="..." attributes as a SEPARATE directive from
      // inline <script> blocks. Helmet defaults script-src-attr to 'none',
      // which silently killed every onclick handler in the app (105 of them) —
      // buttons looked clickable but did nothing, no error, no network
      // request. script-src alone does not cover this.
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
// The frontend is now same-origin, so cross-origin access is opt-in via
// CORS_ORIGIN rather than open to everyone by default.
const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors(allowed.length
  ? { origin: allowed, credentials: true }
  : { origin: (o, cb) => cb(null, !o) }));   // same-origin / tools only

app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'SkillUp backend is running', version: '3.0.0' });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found.` });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  // Never leak a stack trace to the client in production.
  const msg = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(err.status || 500).json({ success: false, error: msg });
});

// ── Start — with EADDRINUSE retry on an incrementing port ────────────────────
const server = http.createServer(app);

let currentPort = Number(PORT);
const MAX_PORT_RETRIES = 5;
let portRetries = 0;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    if (portRetries >= MAX_PORT_RETRIES) {
      console.error(`\n❌ Ports ${PORT}-${currentPort} are all in use. Free one or set PORT in .env.\n`);
      process.exit(1);
    }
    portRetries += 1;
    currentPort += 1;
    console.warn(`\n⚠️  Port ${currentPort - 1} is in use. Retrying on ${currentPort}…\n`);
    setTimeout(() => server.listen(currentPort), 500);
  } else {
    console.error('[server] Fatal error:', err.message);
    process.exit(1);
  }
});

server.on('listening', () => {
  const base = `http://localhost:${server.address().port}`;
  console.log(`\n✅ SkillUp running on ${base}`);
  console.log(`   Open the app:  ${base}/`);
  console.log(`   Health:        ${base}/api/health`);
  console.log(`   Seed content:  npm run seed\n`);
});

server.listen(currentPort);
