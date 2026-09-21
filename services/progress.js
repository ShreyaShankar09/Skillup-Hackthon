// services/progress.js — The single place where points, streaks, activity and
// badges are mutated. Controllers call these helpers instead of writing their
// own UPDATE statements, so the rules stay consistent and can't drift apart.

const { db } = require('../config/db');

const today = () => new Date().toISOString().slice(0, 10);

// ── Points ────────────────────────────────────────────────────────────────────
// Clamped at zero so un-toggling a task can never drive a user negative.
function addPoints(userId, delta) {
  db.prepare('UPDATE user_profile SET points = MAX(0, points + ?) WHERE user_id = ?')
    .run(delta, userId);
}

// ── Activity + streak ────────────────────────────────────────────────────────
// Every scoring action logs a few minutes against today. The streak is then
// DERIVED by walking backwards from today — never stored as a bare counter,
// which is what made the old dayStreak field permanently stuck at its seed value.
function logActivity(userId, minutes = 10) {
  db.prepare(`
    INSERT INTO activity_log (user_id, day, minutes) VALUES (?, ?, ?)
    ON CONFLICT(user_id, day) DO UPDATE SET minutes = minutes + excluded.minutes
  `).run(userId, today(), minutes);
  recomputeStreak(userId);
}

function recomputeStreak(userId) {
  const days = db.prepare(
    'SELECT day FROM activity_log WHERE user_id = ? AND minutes > 0 ORDER BY day DESC'
  ).all(userId).map(r => r.day);

  const set = new Set(days);
  let streak = 0;
  const cursor = new Date();

  // A streak stays alive if the user was active today OR yesterday (so it
  // doesn't break the moment midnight passes before they log in).
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(cursor.toISOString().slice(0, 10))) {
      db.prepare('UPDATE user_profile SET dayStreak = 0 WHERE user_id = ?').run(userId);
      return 0;
    }
  }
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  db.prepare('UPDATE user_profile SET dayStreak = ? WHERE user_id = ?').run(streak, userId);
  return streak;
}

// Last 7 days of minutes, oldest first — feeds the dashboard heatmap.
function heatmap(userId) {
  const data = [], labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = db.prepare('SELECT minutes FROM activity_log WHERE user_id = ? AND day = ?')
      .get(userId, key);
    data.push(row ? row.minutes : 0);
    labels.push(['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]);
  }
  return { heatData: data, heatDays: labels };
}

// ── Derived counters ──────────────────────────────────────────────────────────
// Counted from the progress tables rather than kept as incrementing columns,
// so they can never drift out of sync with reality.
const modulesCompleted = (userId) => db.prepare(
  'SELECT COUNT(*) AS n FROM module_progress WHERE user_id = ? AND completed = 1'
).get(userId).n;

const onboardingDone = (userId) => db.prepare(
  'SELECT COUNT(*) AS n FROM onboard_progress WHERE user_id = ? AND done = 1'
).get(userId).n;

const badgesEarned = (userId) => db.prepare(
  'SELECT COUNT(*) AS n FROM user_badges WHERE user_id = ?'
).get(userId).n;

// ── Badge engine ──────────────────────────────────────────────────────────────
// Each badge row carries a `criteria` key; the matching predicate below decides
// whether the user has met it. Add a badge by adding a row + a predicate here.
const RULES = {
  first_onboard:    (u) => onboardingDone(u) >= 1,
  onboard_half:     (u) => onboardingDone(u) >= 3,
  onboard_all:      (u) => {
    const total = db.prepare('SELECT COUNT(*) AS n FROM onboard_items').get().n;
    return total > 0 && onboardingDone(u) >= total;
  },
  first_module:     (u) => modulesCompleted(u) >= 1,
  three_modules:    (u) => modulesCompleted(u) >= 3,
  all_modules:      (u) => {
    const total = db.prepare('SELECT COUNT(*) AS n FROM modules').get().n;
    return total > 0 && modulesCompleted(u) >= total;
  },
  streak_3:         (u) => recomputeStreak(u) >= 3,
  streak_7:         (u) => recomputeStreak(u) >= 7,
  assessment_done:  (u) => !!db.prepare('SELECT 1 FROM assessment_results WHERE user_id = ?').get(u),
  chat_10:          (u) => db.prepare(
    "SELECT COUNT(*) AS n FROM chat_history WHERE user_id = ? AND role = 'user'"
  ).get(u).n >= 10,
};

// Evaluates every unearned badge and awards the ones now satisfied.
// Returns the newly-earned badges so the caller can raise notifications.
function checkBadges(userId) {
  const unearned = db.prepare(`
    SELECT b.* FROM badges b
    WHERE NOT EXISTS (
      SELECT 1 FROM user_badges ub WHERE ub.badge_id = b.id AND ub.user_id = ?
    )
  `).all(userId);

  const newlyEarned = [];
  for (const badge of unearned) {
    const rule = RULES[badge.criteria];
    if (!rule) continue;
    let met = false;
    try { met = rule(userId); } catch { met = false; }
    if (!met) continue;

    db.prepare('INSERT INTO user_badges (user_id, badge_id, earnedAt) VALUES (?, ?, ?)')
      .run(userId, badge.id, new Date().toISOString());
    addPoints(userId, badge.pts || 0);
    db.prepare(`
      INSERT INTO notifications (user_id, title, msg, type, read, time)
      VALUES (?, 'Badge Earned', ?, 'badge', 0, ?)
    `).run(userId, `You earned the "${badge.name}" badge — ${badge.desc}. +${badge.pts} points.`, 'Just now');
    newlyEarned.push({ name: badge.name, pts: badge.pts, iconId: badge.iconId });
  }
  if (newlyEarned.length) {
    console.log(`[progress] User ${userId} earned ${newlyEarned.length} badge(s):`,
      newlyEarned.map(b => b.name).join(', '));
  }
  return newlyEarned;
}

// Convenience wrapper: the standard "user did something worth points" flow.
function award(userId, points, minutes = 10) {
  addPoints(userId, points);
  logActivity(userId, minutes);
  return checkBadges(userId);
}

module.exports = {
  today, addPoints, logActivity, recomputeStreak, heatmap,
  modulesCompleted, onboardingDone, badgesEarned, checkBadges, award,
};
