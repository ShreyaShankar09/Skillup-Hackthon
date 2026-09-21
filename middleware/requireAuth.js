// middleware/requireAuth.js — Verifies the bearer token and pins req.userId.
// Every per-user route sits behind this, so a controller can never accidentally
// read another account's rows: they all filter on req.userId.

const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const { JWT_SECRET } = require('../config/auth');

module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Confirm the account still exists — a deleted user's token stays
    // cryptographically valid until it expires otherwise.
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ success: false, error: 'Account no longer exists.' });
    req.userId = user.id;
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      error: expired ? 'Session expired — please sign in again.' : 'Invalid session token.',
    });
  }
};
