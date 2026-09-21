// controllers/gamification.controller.js — Leaderboard and badges.

const { db } = require('../config/db');
const progress = require('../services/progress');

// ── GET /api/leaderboard ──────────────────────────────────────────────────────
// Real accounts are merged with the seeded demo rivals and ranked together, so
// the signed-in user's row actually moves as they earn points.
exports.getLeaderboard = (req, res) => {
  try {
    const real = db.prepare(`
      SELECT u.id, u.name, p.avatarInit, p.level, p.points, p.dayStreak
      FROM users u JOIN user_profile p ON p.user_id = u.id
    `).all().map(r => ({
      name: r.name,
      init: r.avatarInit || r.name.slice(0, 2).toUpperCase(),
      col: '#2f81f7',
      level: r.level,
      pts: r.points,
      badges: progress.badgesEarned(r.id),
      streak: r.dayStreak,
      me: r.id === req.userId,
    }));

    const demo = db.prepare('SELECT * FROM demo_leaderboard').all().map(r => ({
      name: r.name, init: r.init, col: r.col, level: r.level,
      pts: r.pts, badges: r.badges, streak: r.streak, me: false,
    }));

    const data = [...real, ...demo].sort((a, b) => b.pts - a.pts);
    data.forEach((row, i) => { row.rank = i + 1; });

    console.log(`[gamification] Leaderboard: ${real.length} real + ${demo.length} demo.`);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[gamification] getLeaderboard error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/badges ────────────────────────────────────────────────────────────
exports.getBadges = (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT b.*, ub.earnedAt
      FROM badges b
      LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ?
      ORDER BY b.id
    `).all(req.userId);

    const data = rows.map(r => ({
      iconId: r.iconId, name: r.name, desc: r.desc, pts: r.pts,
      earned: !!r.earnedAt,
      edate: r.earnedAt ? r.earnedAt.slice(0, 10) : null,
    }));
    console.log(`[gamification] ${data.filter(b => b.earned).length}/${data.length} badges earned by user ${req.userId}.`);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[gamification] getBadges error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
