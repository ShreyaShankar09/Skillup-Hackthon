// controllers/profile.controller.js — User profile & settings read/update.

const { db } = require('../config/db');
const progress = require('../services/progress');

function readProfile(userId) {
  const r = db.prepare(`
    SELECT u.name, u.email, p.*
    FROM users u JOIN user_profile p ON p.user_id = u.id
    WHERE u.id = ?
  `).get(userId);
  if (!r) return null;
  return {
    name: r.name, email: r.email, avatarInit: r.avatarInit,
    level: r.level, cohort: r.cohort, points: r.points,
    modulesCompleted: progress.modulesCompleted(userId),
    dayStreak: progress.recomputeStreak(userId),
    badgesEarned: progress.badgesEarned(userId),
    darkMode: !!r.darkMode, emailReminders: !!r.emailReminders,
    streakReminders: !!r.streakReminders, achievementAlerts: !!r.achievementAlerts,
  };
}

// ── GET /api/profile ──────────────────────────────────────────────────────────
exports.getProfile = (req, res) => {
  try {
    const data = readProfile(req.userId);
    if (!data) return res.status(404).json({ success: false, error: 'Profile not found.' });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[profile] getProfile error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── PUT /api/profile ──────────────────────────────────────────────────────────
// Note the allow-list: points, level and streak are NOT writable from here.
// Letting the client PUT its own points would undo every guard elsewhere.
const BOOL_FIELDS = ['darkMode', 'emailReminders', 'streakReminders', 'achievementAlerts'];

exports.updateProfile = (req, res) => {
  try {
    const body = req.body || {};
    const cur = db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(req.userId);
    if (!cur) return res.status(404).json({ success: false, error: 'Profile not found.' });

    if (typeof body.name === 'string' && body.name.trim()) {
      if (body.name.trim().length > 60) {
        return res.status(400).json({ success: false, error: 'Name must be 60 characters or fewer.' });
      }
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(body.name.trim(), req.userId);
    }
    if (typeof body.avatarInit === 'string' && body.avatarInit.trim()) {
      db.prepare('UPDATE user_profile SET avatarInit = ? WHERE user_id = ?')
        .run(body.avatarInit.trim().slice(0, 2).toUpperCase(), req.userId);
    }
    for (const f of BOOL_FIELDS) {
      if (body[f] !== undefined) {
        db.prepare(`UPDATE user_profile SET ${f} = ? WHERE user_id = ?`).run(body[f] ? 1 : 0, req.userId);
      }
    }
    res.json({ success: true, data: readProfile(req.userId) });
  } catch (err) {
    console.error('[profile] updateProfile error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
