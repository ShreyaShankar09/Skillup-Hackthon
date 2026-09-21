// controllers/learning.controller.js — Learning modules & per-user progress.

const { db } = require('../config/db');
const progress = require('../services/progress');

const LEVEL_TIER = {
  'Beginner Developer': 1, 'Intermediate Developer': 2,
  'Advanced Developer': 3, 'Expert Developer': 4,
};

// Joins shared module content to this user's progress row.
function listModules(userId) {
  return db.prepare(`
    SELECT m.*, COALESCE(p.completed,0) AS completed, COALESCE(p.active,0) AS active
    FROM modules m
    LEFT JOIN module_progress p ON p.module_id = m.id AND p.user_id = ?
    ORDER BY m.id
  `).all(userId).map(r => ({
    id: r.id, icon: r.icon, title: r.title, desc: r.desc, cat: r.cat,
    diff: r.diff, time: r.time, link: r.link, minLevel: r.minLevel,
    completed: !!r.completed, active: !!r.active,
  }));
}

// ── GET /api/modules ──────────────────────────────────────────────────────────
// ?all=1 returns the full catalogue; by default the list is filtered to the
// user's assessed skill tier, which is what makes the path "personalised".
exports.getModules = (req, res) => {
  try {
    const all = req.query.all === '1';
    let data = listModules(req.userId);

    if (!all) {
      const prof = db.prepare('SELECT level FROM user_profile WHERE user_id = ?').get(req.userId);
      const tier = LEVEL_TIER[prof?.level] || 1;
      // Always keep anything already completed or active so progress never vanishes.
      data = data.filter(m => m.minLevel <= tier + 1 || m.completed || m.active);
    }
    console.log(`[learning] Returning ${data.length} modules for user ${req.userId}.`);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[learning] getModules error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── PATCH /api/modules/:id/complete ──────────────────────────────────────────
exports.completeModule = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Module id must be a positive integer.' });
  }
  try {
    const mod = db.prepare('SELECT id FROM modules WHERE id = ?').get(id);
    if (!mod) return res.status(404).json({ success: false, error: 'Module not found' });

    db.prepare(`
      INSERT INTO module_progress (user_id, module_id, completed, active)
      VALUES (?, ?, 0, 0) ON CONFLICT(user_id, module_id) DO NOTHING
    `).run(req.userId, id);

    const row = db.prepare('SELECT completed FROM module_progress WHERE user_id = ? AND module_id = ?')
      .get(req.userId, id);

    // ── Replay guard ──────────────────────────────────────────────────────────
    // Without this, re-sending the request awards 50 points every single time.
    if (row.completed) {
      console.log(`[learning] Module ${id} already complete for user ${req.userId} — no points awarded.`);
      return res.json({ success: true, data: listModules(req.userId), alreadyComplete: true, earned: [] });
    }

    db.prepare(`UPDATE module_progress SET completed = 1, active = 0, completedAt = ?
                WHERE user_id = ? AND module_id = ?`)
      .run(new Date().toISOString(), req.userId, id);

    // Activate the next incomplete module for this user.
    const next = db.prepare(`
      SELECT m.id FROM modules m
      LEFT JOIN module_progress p ON p.module_id = m.id AND p.user_id = ?
      WHERE COALESCE(p.completed,0) = 0 ORDER BY m.id LIMIT 1
    `).get(req.userId);
    if (next) {
      db.prepare(`INSERT INTO module_progress (user_id, module_id, active) VALUES (?, ?, 1)
                  ON CONFLICT(user_id, module_id) DO UPDATE SET active = 1`)
        .run(req.userId, next.id);
    }

    const earned = progress.award(req.userId, 50, 25);
    console.log(`[learning] User ${req.userId} completed module ${id}. +50 points.`);
    res.json({ success: true, data: listModules(req.userId), earned });
  } catch (err) {
    console.error('[learning] completeModule error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.listModules = listModules;
