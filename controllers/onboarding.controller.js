// controllers/onboarding.controller.js — Checklist items & per-user completion.

const { db } = require('../config/db');
const progress = require('../services/progress');

const POINTS_PER_ITEM = 20;

function listItems(userId) {
  return db.prepare(`
    SELECT o.*, COALESCE(p.done,0) AS done
    FROM onboard_items o
    LEFT JOIN onboard_progress p ON p.item_id = o.id AND p.user_id = ?
    ORDER BY o.id
  `).all(userId).map(r => ({
    id: r.id, title: r.title, cat: r.cat, done: !!r.done, desc: r.desc,
    what: r.what, why: r.why,
    steps: JSON.parse(r.steps || '[]'), errors: JSON.parse(r.errors || '[]'),
  }));
}

// ── GET /api/onboarding ───────────────────────────────────────────────────────
exports.getItems = (req, res) => {
  try {
    res.json({ success: true, data: listItems(req.userId) });
  } catch (err) {
    console.error('[onboarding] getItems error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── PATCH /api/onboarding/:id/toggle ─────────────────────────────────────────
exports.toggleItem = (req, res) => {
  const { id } = req.params;
  try {
    const item = db.prepare('SELECT id FROM onboard_items WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ success: false, error: 'Onboarding item not found' });

    db.prepare(`INSERT INTO onboard_progress (user_id, item_id, done) VALUES (?, ?, 0)
                ON CONFLICT(user_id, item_id) DO NOTHING`).run(req.userId, id);

    const cur = db.prepare('SELECT done FROM onboard_progress WHERE user_id = ? AND item_id = ?')
      .get(req.userId, id);
    const nowDone = cur.done ? 0 : 1;

    db.prepare('UPDATE onboard_progress SET done = ?, doneAt = ? WHERE user_id = ? AND item_id = ?')
      .run(nowDone, nowDone ? new Date().toISOString() : null, req.userId, id);

    let earned = [];
    if (nowDone) {
      earned = progress.award(req.userId, POINTS_PER_ITEM, 10);
    } else {
      // ── Symmetry ────────────────────────────────────────────────────────────
      // The old code granted points on tick but never took them back on untick,
      // so toggling a checkbox was an infinite points machine.
      progress.addPoints(req.userId, -POINTS_PER_ITEM);
    }

    console.log(`[onboarding] User ${req.userId} set item ${id} done=${nowDone}.`);
    res.json({ success: true, data: listItems(req.userId).find(i => i.id === id), earned });
  } catch (err) {
    console.error('[onboarding] toggleItem error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
