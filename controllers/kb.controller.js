// controllers/kb.controller.js — Knowledge base articles, search, views & voting.

const { db } = require('../config/db');
const ai = require('../services/ai');

const CATEGORIES = ['JavaScript', 'Python', 'Git', 'React', 'Node.js', 'General'];

const rowToKB = (r) => ({ id: r.id, q: r.q, a: r.a, cat: r.cat, views: r.views, helpful: r.helpful });

exports.getArticles = (req, res) => {
  try {
    res.json({ success: true, data: db.prepare('SELECT * FROM kb_articles ORDER BY id').all().map(rowToKB) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/kb/search?q= ─────────────────────────────────────────────────────
// Filtering moved into SQL rather than pulling every row into JS first.
exports.searchArticles = (req, res) => {
  const q = String(req.query.q || '').trim();
  try {
    const data = q
      ? db.prepare(`SELECT * FROM kb_articles
                    WHERE q LIKE '%' || ? || '%' OR a LIKE '%' || ? || '%' OR cat LIKE '%' || ? || '%'
                    ORDER BY id`).all(q, q, q).map(rowToKB)
      : db.prepare('SELECT * FROM kb_articles ORDER BY id').all().map(rowToKB);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/kb/:id/view ─────────────────────────────────────────────────────
// The views column existed and was seeded, but nothing ever incremented it.
exports.viewArticle = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Article id must be a positive integer.' });
  }
  try {
    const info = db.prepare('UPDATE kb_articles SET views = views + 1 WHERE id = ?').run(id);
    if (!info.changes) return res.status(404).json({ success: false, error: 'Article not found' });
    res.json({ success: true, data: rowToKB(db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(id)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.voteArticle = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Article id must be a positive integer.' });
  }
  try {
    const item = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ success: false, error: 'Article not found' });
    const helpful = req.body?.helpful ? item.helpful + 1 : Math.max(0, item.helpful - 1);
    db.prepare('UPDATE kb_articles SET helpful = ? WHERE id = ?').run(helpful, id);
    res.json({ success: true, data: rowToKB({ ...item, helpful }) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/kb/ask ──────────────────────────────────────────────────────────
// Body: { question, cat }. Gets a real AI answer and saves it as a shared KB
// article. With no AI_API_KEY nothing is saved and live:false is returned, so the
// UI can say so instead of adding a fake answer to the team's knowledge base.
exports.askQuestion = async (req, res) => {
  const question = String(req.body?.question || '').trim();
  const cat = CATEGORIES.includes(req.body?.cat) ? req.body.cat : 'General';
  if (question.length < 5)   return res.status(400).json({ success: false, error: 'Please enter a longer question.' });
  if (question.length > 500) return res.status(400).json({ success: false, error: 'Question must be 500 characters or fewer.' });

  if (!ai.isConfigured()) {
    return res.json({ success: true, live: false, data: null,
      message: 'Demo mode — set AI_API_KEY in .env to get real answers saved to the Knowledge Base.' });
  }
  try {
    const { text } = await ai.complete([
      { role: 'system', content:
        'You write concise developer knowledge-base answers for engineers onboarding onto a new team. ' +
        'Answer in under 150 words as plain text. Use short numbered steps where helpful and `backticks` for inline code. ' +
        'Do not use markdown headings, bold, tables or fenced code blocks.' },
      { role: 'user', content: `[${cat}] ${question}` },
    ]);
    const info = db.prepare('INSERT INTO kb_articles (q, a, cat, views, helpful) VALUES (?, ?, ?, 0, 0)')
                   .run(question, text.slice(0, 4000), cat);
    const row = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(Number(info.lastInsertRowid));
    res.json({ success: true, live: true, data: rowToKB(row) });
  } catch (err) {
    console.error('[kb] ask failed:', err.message);
    res.status(502).json({ success: false, error: 'The AI service could not answer right now. Please try again.' });
  }
};
