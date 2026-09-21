// config/auth.js — Shared auth configuration.
//
// JWT_SECRET resolution order:
//   1. process.env.JWT_SECRET (from .env) — the normal, recommended path.
//   2. Development only: a random secret generated once and persisted to
//      .jwt_secret (git-ignored), so sessions survive restarts WITHOUT ever
//      falling back to a hardcoded string that anyone reading the repo could
//      use to forge tokens.
//   3. Production with no secret set: refuse to start.

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const SECRET_FILE = path.join(__dirname, '..', '.jwt_secret');
const MIN_LEN     = 32;
const KNOWN_WEAK  = new Set(['skillup-dev-secret-change-me', 'changeme', 'secret', 'your-secret-here']);
const isProd      = process.env.NODE_ENV === 'production';

function resolveSecret() {
  const fromEnv = (process.env.JWT_SECRET || '').trim();

  if (fromEnv) {
    if (KNOWN_WEAK.has(fromEnv) || fromEnv.length < MIN_LEN) {
      const msg = `[auth] JWT_SECRET is too weak (need ${MIN_LEN}+ random chars, not a placeholder).`;
      if (isProd) { console.error(`${msg} Refusing to start.`); process.exit(1); }
      console.warn(`${msg} Generate one: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
    }
    return fromEnv;
  }

  if (isProd) {
    console.error('[auth] FATAL: JWT_SECRET must be set in production.');
    process.exit(1);
  }

  try {
    const saved = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (saved.length >= MIN_LEN) return saved;
  } catch (_) { /* first run — generate below */ }

  const generated = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
    console.warn('[auth] JWT_SECRET not set — generated a random dev secret and saved it to .jwt_secret. Set JWT_SECRET in .env for deployments.');
  } catch (e) {
    console.warn('[auth] JWT_SECRET not set and .jwt_secret could not be written — using a per-process secret (sessions reset on restart).');
  }
  return generated;
}

const JWT_SECRET = resolveSecret();

module.exports = { JWT_SECRET, TOKEN_TTL: '7d' };
