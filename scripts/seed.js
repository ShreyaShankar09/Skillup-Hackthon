// scripts/seed.js — Populates the SHARED CONTENT tables.
// Run after install: npm run seed
//
// Note what this does NOT do any more: it never writes progress, points or
// badges. Those are per-user rows created at signup and earned through use.
// Safe to re-run — content tables are cleared and rewritten.

const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const D = require('./seed-data');

const DB_PATH = path.join(__dirname, '..', 'skillup.db');
console.log(`[seed] Opening database at: ${DB_PATH}`);
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

// Reuse the canonical schema instead of duplicating it here — the old seed kept
// its own copy, which is exactly how the two drift apart.
require('../config/db');

// ── Modules ───────────────────────────────────────────────────────────────────
// Source rows are [id, icon, title, desc, cat, diff, time, link, completed, active].
// completed/active are dropped (they're per-user now); diff maps to minLevel.
const DIFF_TIER = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };

// The source data labels every module "intermediate", which would make the
// personalised path a no-op. Override per title so the tiers actually differ.
const MIN_LEVEL = {
  'Advanced JavaScript & ES6+': 1,
  'React.js Fundamentals':      2,
  'Node.js & Express APIs':     2,
  'MongoDB & Mongoose':         2,
  'Authentication & Security':  3,
  'Full-Stack Project':         4,
};

db.prepare('DELETE FROM modules').run();
for (const m of D.modules) {
  const [id, icon, title, desc, cat, diff, time, link] = m;
  db.prepare(`INSERT INTO modules (id,icon,title,desc,cat,diff,time,link,minLevel)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, icon, title, desc, cat, diff, time, link,
         MIN_LEVEL[title] ?? DIFF_TIER[String(diff).toLowerCase()] ?? 1);
}
console.log(`[seed] ${D.modules.length} modules.`);

// ── Onboarding items ──────────────────────────────────────────────────────────
db.prepare('DELETE FROM onboard_items').run();
for (const o of D.onboardItems) {
  const [id, title, cat, , desc, what, why, steps, errors] = o;
  db.prepare(`INSERT INTO onboard_items (id,title,cat,desc,what,why,steps,errors)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, title, cat, desc, what, why, steps, errors);
}
console.log(`[seed] ${D.onboardItems.length} onboarding items.`);

// ── Questions ─────────────────────────────────────────────────────────────────
// Explicit skill weights per option, so scoring never relies on option order.
const WEIGHTS = {
  1: [0, 1, 2, 3],        // years of experience
  2: [0, 1, 2, 3],
  3: [0, 1, 2, 3],
  // multi-select "what have you built": one weight per option, in option order.
  // "None yet" must score 0 — with the old flat [1,1,1,1] it scored maximum.
  4: [1, 2, 3, 2, 2, 0],
  5: [0, 1, 2, 3],
  6: [0, 1, 2, 3],
  7: [0, 1, 2, 3],
  8: [0, 1, 2, 3],
};
db.prepare('DELETE FROM questions').run();
D.questions.forEach((q, i) => {
  const [text, type, opts, sortOrder] = q;
  const n = JSON.parse(opts).length;
  const w = WEIGHTS[i + 1] || Array.from({ length: n }, (_, k) => k);
  db.prepare('INSERT INTO questions (text,type,opts,sortOrder,weights) VALUES (?,?,?,?,?)')
    .run(text, type, opts, sortOrder, JSON.stringify(w.slice(0, n)));
});
console.log(`[seed] ${D.questions.length} questions.`);

// ── KB articles ───────────────────────────────────────────────────────────────
db.prepare('DELETE FROM kb_articles').run();
for (const k of D.kbArticles) {
  db.prepare('INSERT INTO kb_articles (id,q,a,cat,views,helpful) VALUES (?,?,?,?,?,?)').run(...k);
}
console.log(`[seed] ${D.kbArticles.length} KB articles.`);

// ── Badges + criteria ─────────────────────────────────────────────────────────
// `criteria` is the rule key evaluated in services/progress.js. Previously the
// badges table had an `earned` flag that literally nothing ever set.
const CRITERIA = {
  'First Steps':     'first_onboard',
  'Fast Learner':    'three_modules',
  'Code Warrior':    'all_modules',
  'Streak Starter':  'streak_3',
  'Explorer':        'assessment_done',
  'Git Master':      'onboard_half',
  'Team Player':     'chat_10',
  'Legend':          'streak_7',
};
db.prepare('DELETE FROM badges').run();
for (const b of D.badges) {
  const [iconId, name, desc, pts] = b;
  db.prepare('INSERT INTO badges (iconId,name,desc,pts,criteria) VALUES (?,?,?,?,?)')
    .run(iconId, name, desc, pts, CRITERIA[name] || 'first_module');
}
console.log(`[seed] ${D.badges.length} badges with criteria.`);

// ── Notification templates (copied to each new user at signup) ────────────────
db.prepare('DELETE FROM notification_templates').run();
for (const n of D.notifications) {
  const [id, title, msg, type, , time] = n;
  db.prepare('INSERT INTO notification_templates (id,title,msg,type,time) VALUES (?,?,?,?,?)')
    .run(id, title, msg, type, time);
}

// ── Team + GitHub fallback + demo leaderboard ─────────────────────────────────
db.prepare('DELETE FROM team_members').run();
for (const t of D.teamMembers) {
  db.prepare(`INSERT INTO team_members (name,init,col,level,progress,score,streak,status)
              VALUES (?,?,?,?,?,?,?,?)`).run(...t);
}
db.prepare('DELETE FROM github_activities').run();
for (const g of D.ghActivities) {
  db.prepare(`INSERT INTO github_activities (type,iconId,color,icolor,title,summary,author,date,badge,badgeText)
              VALUES (?,?,?,?,?,?,?,?,?,?)`).run(...g);
}
db.prepare('DELETE FROM demo_leaderboard').run();
for (const l of D.leaderboard) {
  const [name, init, col, level, pts, badges, streak, me] = l;
  if (me) continue;                       // the "me" row is a real user now
  db.prepare(`INSERT INTO demo_leaderboard (name,init,col,level,pts,badges,streak)
              VALUES (?,?,?,?,?,?,?)`).run(name, init, col, level, pts, badges, streak);
}

// ── Explorer ──────────────────────────────────────────────────────────────────
db.prepare('INSERT OR REPLACE INTO explorer (id, fileTree, fileExplanations) VALUES (1, ?, ?)')
  .run(JSON.stringify(D.fileTree), JSON.stringify(D.fileExplanations));

console.log('\n✅ Content seeded. Start the server with: npm start');
console.log('   Then create an account in the app — progress is per-user.\n');
