// services/ai.js — Minimal Groq (OpenAI-compatible) completion helper.
// Returns { text, live }. live is false ONLY when no AI_API_KEY is configured;
// real API failures throw so callers can surface them instead of faking a reply.

const AI_MODEL = () => process.env.AI_MODEL || 'groq/compound-mini';

exports.isConfigured = () => Boolean(process.env.AI_API_KEY);

exports.complete = async (messages, { timeoutMs = 30000 } = {}) => {
  const key = process.env.AI_API_KEY;
  if (!key) return { text: '', live: false };
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: AI_MODEL(), messages }),
  });
  if (!r.ok) throw new Error(`Groq API returned ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty reply from model');
  return { text, live: true };
};
