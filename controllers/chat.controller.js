// controllers/chat.controller.js — AI chat logic + per-user history persistence.
// Uses the Groq API (OpenAI-compatible). Falls back to demo mode with no key.

const { db } = require('../config/db');
const progress = require('../services/progress');

const AI_API_KEY   = process.env.AI_API_KEY;
const AI_MODEL     = process.env.AI_MODEL || 'groq/compound-mini';
const MAX_CHARS    = 4000;   // reject anything longer — protects the token bill
const CONTEXT_TURNS = 10;    // how many prior messages to replay to the model

const SYSTEM_PROMPT =
  'You are a helpful AI coding assistant for developers onboarding onto a new team. ' +
  'Be concise, use fenced code blocks, and prefer concrete examples over theory.';

// ── Internal: call Groq ───────────────────────────────────────────────────────
// Returns { reply, live } — live is only ever true for an actual model response,
// never for the demo placeholder. (BUG FIX: this used to return a bare string,
// so callers had no way to distinguish "real reply" from "no key configured",
// and every demo-mode message got tagged "LIVE AI" in the UI.)
async function getAIReply(userId, message) {
  if (!AI_API_KEY) {
    return {
      reply: '[Demo mode — no AI_API_KEY set] This is a placeholder reply. Add AI_API_KEY to .env to enable real responses.',
      live: false,
    };
  }

  // ── Conversation memory ─────────────────────────────────────────────────────
  // The old version sent ONLY the current message, so follow-ups like
  // "what about the second one?" were meaningless to the model.
  const history = db.prepare(`
    SELECT role, content FROM chat_history
    WHERE user_id = ? ORDER BY id DESC LIMIT ?
  `).all(userId, CONTEXT_TURNS).reverse();

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map(h => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.content })),
    { role: 'user', content: message },
  ];

  console.log(`[chat] Groq call: model=${AI_MODEL}, ${messages.length} messages.`);

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30000);
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({ model: AI_MODEL, messages }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Groq API returned ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    return { reply: data.choices?.[0]?.message?.content || '(empty reply from model)', live: true };
  } finally {
    clearTimeout(timeout);
  }
}

// ── GET /api/chat/history?limit=&before= ──────────────────────────────────────
// Paginated: the table grows without bound, so returning all of it forever was
// only fine while the demo was one conversation long.
exports.getHistory = (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
    const rows = db.prepare(`
      SELECT id, role, content, createdAt FROM chat_history
      WHERE user_id = ? AND id < ? ORDER BY id DESC LIMIT ?
    `).all(req.userId, before, limit).reverse();
    res.json({ success: true, data: rows, hasMore: rows.length === limit });
  } catch (err) {
    console.error('[chat] getHistory error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE /api/chat/history ──────────────────────────────────────────────────
exports.clearHistory = (req, res) => {
  try {
    db.prepare('DELETE FROM chat_history WHERE user_id = ?').run(req.userId);
    res.json({ success: true, data: { cleared: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/chat ────────────────────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
  try {
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Request body must include a non-empty "message" string.' });
    }
    if (message.length > MAX_CHARS) {
      return res.status(413).json({ success: false, error: `Message too long (max ${MAX_CHARS} characters).` });
    }

    // History is read BEFORE the new message is stored, so it isn't duplicated.
    let reply, live;
    try {
      ({ reply, live } = await getAIReply(req.userId, message.trim()));
    } catch (aiErr) {
      console.error('[chat] AI call failed:', aiErr.message);
      reply = `[Live AI call failed] ${aiErr.message}`;
      live = false;
    }

    const now = new Date().toISOString();
    const ins = db.prepare('INSERT INTO chat_history (user_id, role, content, createdAt) VALUES (?, ?, ?, ?)');
    ins.run(req.userId, 'user', message.trim(), now);
    ins.run(req.userId, 'ai', reply, now);

    const earned = progress.award(req.userId, 2, 5);
    res.json({ success: true, data: { reply, live, earned } });
  } catch (err) {
    console.error('[chat] sendMessage error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
