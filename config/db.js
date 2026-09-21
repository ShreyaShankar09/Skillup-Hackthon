// config/db.js — SQLite connection via Node's built-in node:sqlite module.
// Requires Node.js 22.5+. Run `node -v` to verify your version.
//
// Schema is split into two kinds of table:
//   • CONTENT  — shared by everyone (modules, onboard_items, kb_articles, badges…)
//   • PER-USER — scoped by user_id (progress, points, chat, notifications…)
// That split is what makes multi-user work; never put progress on a content table.

const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'skillup.db');

console.log(`[db] Opening SQLite database at: ${DB_PATH}`);

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
-- ══ AUTH ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

-- ══ CONTENT (shared) ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY,
  icon TEXT, title TEXT, desc TEXT, cat TEXT, diff TEXT, time TEXT, link TEXT,
  -- Minimum skill tier this module is surfaced for: 1=Beginner … 4=Expert.
  minLevel INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS onboard_items (
  id TEXT PRIMARY KEY,
  title TEXT, cat TEXT, desc TEXT,
  what TEXT, why TEXT, steps TEXT, errors TEXT
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT, type TEXT, opts TEXT, sortOrder INTEGER,
  -- JSON array of skill weights, one per option (e.g. [0,1,2,3]).
  weights TEXT
);
CREATE TABLE IF NOT EXISTS kb_articles (
  id INTEGER PRIMARY KEY,
  q TEXT, a TEXT, cat TEXT, views INTEGER DEFAULT 0, helpful INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  iconId TEXT, name TEXT, desc TEXT, pts INTEGER,
  -- Machine-readable rule key, evaluated in services/badges.js
  criteria TEXT
);
CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, init TEXT, col TEXT, level TEXT, progress INTEGER, score INTEGER, streak INTEGER, status TEXT
);
CREATE TABLE IF NOT EXISTS github_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT, iconId TEXT, color TEXT, icolor TEXT, title TEXT, summary TEXT,
  author TEXT, date TEXT, badge TEXT, badgeText TEXT
);
-- Seeded rivals so a fresh single-user demo still has a populated leaderboard.
CREATE TABLE IF NOT EXISTS demo_leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, init TEXT, col TEXT, level TEXT, pts INTEGER, badges INTEGER, streak INTEGER
);
CREATE TABLE IF NOT EXISTS explorer (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  fileTree TEXT, fileExplanations TEXT
);
CREATE TABLE IF NOT EXISTS notification_templates (
  id INTEGER PRIMARY KEY,
  title TEXT, msg TEXT, type TEXT, time TEXT
);

-- ══ PER-USER ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_profile (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatarInit TEXT, level TEXT DEFAULT 'Beginner Developer', cohort TEXT,
  points INTEGER DEFAULT 0, dayStreak INTEGER DEFAULT 0,
  darkMode INTEGER DEFAULT 1, emailReminders INTEGER DEFAULT 1,
  streakReminders INTEGER DEFAULT 1, achievementAlerts INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS module_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  completed INTEGER DEFAULT 0, active INTEGER DEFAULT 0, completedAt TEXT,
  PRIMARY KEY (user_id, module_id)
);
CREATE TABLE IF NOT EXISTS onboard_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES onboard_items(id) ON DELETE CASCADE,
  done INTEGER DEFAULT 0, doneAt TEXT,
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS user_badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earnedAt TEXT NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);
CREATE TABLE IF NOT EXISTS assessment_results (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answers TEXT, skillLevel TEXT, submittedAt TEXT
);
CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT, content TEXT, createdAt TEXT
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT, msg TEXT, type TEXT, read INTEGER DEFAULT 0, time TEXT
);
-- Drives both the dashboard heatmap and the day-streak calculation.
CREATE TABLE IF NOT EXISTS activity_log (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  minutes INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_chat_user   ON chat_history (user_id, id);
CREATE INDEX IF NOT EXISTS idx_notif_user  ON notifications (user_id, id);
CREATE INDEX IF NOT EXISTS idx_actlog_user ON activity_log (user_id, day);
`);

console.log('[db] Schema ready.');

module.exports = { db };
