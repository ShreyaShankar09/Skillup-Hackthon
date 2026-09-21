// controllers/assessment.controller.js — Skill test questions & submission scoring.

const { db } = require('../config/db');
const progress = require('../services/progress');

const TIERS = ['Beginner Developer', 'Intermediate Developer', 'Advanced Developer', 'Expert Developer'];

// ── GET /api/assessment/questions ─────────────────────────────────────────────
exports.getQuestions = (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM questions ORDER BY sortOrder').all().map(r => ({
      id: r.id, text: r.text, type: r.type, opts: JSON.parse(r.opts || '[]'),
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[assessment] getQuestions error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Scoring ───────────────────────────────────────────────────────────────────
// Each question stores an explicit `weights` array so a score never depends on
// options happening to be listed in ascending order of skill. Multi-select
// answers (arrays) are averaged across the chosen options instead of being
// silently discarded, which is what the old `typeof v === 'number'` filter did.
function computeSkillLevel(answers) {
  const rows = db.prepare('SELECT id, weights, type FROM questions').all();
  const byId = new Map(rows.map(r => [String(r.id), {
    weights: JSON.parse(r.weights || '[]'), type: r.type,
  }]));

  let total = 0, counted = 0;
  for (const [qid, answer] of Object.entries(answers || {})) {
    const q = byId.get(String(qid));
    if (!q || !q.weights.length) continue;
    const max = Math.max(...q.weights) || 1;

    const picks = Array.isArray(answer) ? answer : [answer];
    const scores = picks
      .map(i => (typeof i === 'number' ? q.weights[i] : undefined))
      .filter(v => typeof v === 'number');
    if (!scores.length) continue;

    // Single-choice: the chosen option's weight.
    // Multi-select: the average of the chosen options, so ticking one strong
    // answer plus "None yet" doesn't read as expert-level.
    total += (scores.reduce((a, b) => a + b, 0) / scores.length) / max;
    counted += 1;
  }

  if (!counted) return TIERS[0];
  const pct = total / counted;                      // 0 … 1
  const idx = Math.min(TIERS.length - 1, Math.floor(pct * TIERS.length));
  return TIERS[idx];
}

// ── POST /api/assessment/submit ───────────────────────────────────────────────
exports.submitAssessment = (req, res) => {
  try {
    const answers = req.body?.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ success: false, error: 'Body must include an "answers" object.' });
    }

    const skillLevel  = computeSkillLevel(answers);
    const submittedAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO assessment_results (user_id, answers, skillLevel, submittedAt) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        answers = excluded.answers, skillLevel = excluded.skillLevel, submittedAt = excluded.submittedAt
    `).run(req.userId, JSON.stringify(answers), skillLevel, submittedAt);

    // ── This is the bit that was missing ──────────────────────────────────────
    // The result now actually drives the profile, which in turn drives which
    // modules the learning path surfaces.
    db.prepare('UPDATE user_profile SET level = ? WHERE user_id = ?').run(skillLevel, req.userId);

    const earned = progress.award(req.userId, 30, 15);
    console.log(`[assessment] User ${req.userId} scored "${skillLevel}".`);
    res.json({ success: true, data: { skillLevel, submittedAt, earned } });
  } catch (err) {
    console.error('[assessment] submitAssessment error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
