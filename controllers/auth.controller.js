// controllers/auth.controller.js — Signup, login, and "who am I".
// Passwords are hashed with bcrypt; sessions are stateless JWTs.

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { db } = require('../config/db');
const { JWT_SECRET, TOKEN_TTL } = require('../config/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every new account gets its own profile row, its own copy of the onboarding
// checklist and module list (all at zero), and a welcome notification.
function bootstrapUser(userId, name) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  db.prepare(`
    INSERT INTO user_profile (user_id, avatarInit, level, cohort, points, dayStreak)
    VALUES (?, ?, 'Beginner Developer', 'SkillUp Cohort 2026', 0, 0)
  `).run(userId, initials);

  const modules = db.prepare('SELECT id FROM modules ORDER BY id').all();
  modules.forEach((m, i) => {
    db.prepare('INSERT INTO module_progress (user_id, module_id, completed, active) VALUES (?, ?, 0, ?)')
      .run(userId, m.id, i === 0 ? 1 : 0);
  });

  for (const item of db.prepare('SELECT id FROM onboard_items').all()) {
    db.prepare('INSERT INTO onboard_progress (user_id, item_id, done) VALUES (?, ?, 0)')
      .run(userId, item.id);
  }

  for (const t of db.prepare('SELECT * FROM notification_templates ORDER BY id').all()) {
    db.prepare('INSERT INTO notifications (user_id, title, msg, type, read, time) VALUES (?, ?, ?, ?, 0, ?)')
      .run(userId, t.title, t.msg, t.type, t.time);
  }
  console.log(`[auth] Bootstrapped user ${userId} (${modules.length} modules).`);
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
exports.signup = async (req, res) => {
  try {
    const name     = String(req.body?.name || '').trim();
    const email    = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    if (name.length < 2)        return res.status(400).json({ success: false, error: 'Name must be at least 2 characters.' });
    if (!EMAIL_RE.test(email))  return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    if (password.length < 8)    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });

    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    if (exists) return res.status(409).json({ success: false, error: 'An account with that email already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const info = db.prepare('INSERT INTO users (name, email, passwordHash, createdAt) VALUES (?, ?, ?, ?)')
      .run(name, email, passwordHash, new Date().toISOString());
    const userId = Number(info.lastInsertRowid);

    bootstrapUser(userId, name);

    const user = { id: userId, name, email };
    console.log(`[auth] New account: ${email} (id=${userId})`);
    res.status(201).json({ success: true, data: { token: issueToken(user), user } });
  } catch (err) {
    console.error('[auth] signup error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const email    = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    // Same message and roughly the same work either way, so the response can't
    // be used to discover which emails are registered.
    const ok = row ? await bcrypt.compare(password, row.passwordHash) : false;
    if (!row || !ok) {
      console.warn(`[auth] Failed login for "${email}".`);
      return res.status(401).json({ success: false, error: 'Incorrect email or password.' });
    }

    // Self-heal any account created before a later seed added new content.
    if (!db.prepare('SELECT 1 FROM user_profile WHERE user_id = ?').get(row.id)) {
      bootstrapUser(row.id, row.name);
    }

    const user = { id: row.id, name: row.name, email: row.email };
    console.log(`[auth] Login: ${email} (id=${row.id})`);
    res.json({ success: true, data: { token: issueToken(user), user } });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
exports.me = (req, res) => {
  const row = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.userId);
  if (!row) return res.status(404).json({ success: false, error: 'User not found.' });
  res.json({ success: true, data: row });
};

exports.bootstrapUser = bootstrapUser;
