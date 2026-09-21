// controllers/github.controller.js — GitHub commit/PR/issue activity feed.
//
// Live data comes from the GitHub REST API when a repo is configured
// (GITHUB_REPO in .env) or supplied per-request (?repo=owner/name, which is what
// the "Connect Repository" box in the UI does). Each section — commits, pull
// requests, issues, repo header — is fetched independently, so one failing call
// (e.g. an unauthenticated 60 req/hr rate limit hitting /pulls) no longer throws
// away the ones that worked. Sections that fail fall back to the seeded rows for
// that section only, and the response says exactly which is which so the UI can
// label it honestly.

const { db } = require('../config/db');

const DEFAULT_REPO = process.env.GITHUB_REPO || '';
const TOKEN        = process.env.GITHUB_TOKEN || '';
const TTL_OK       = 5 * 60 * 1000;   // cache a fully-live result for 5 minutes
const TTL_DEGRADED = 60 * 1000;       // retry sooner when something failed
const REPO_RE      = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

const cache = new Map();              // "owner/name" -> { at, ttl, payload }

// Accepts "owner/name" or any github.com URL for a repo; returns "owner/name" or null.
function parseRepo(input) {
  if (!input) return null;
  let s = String(input).trim();
  const m = s.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i);
  if (m) s = `${m[1]}/${m[2]}`;
  s = s.replace(/\.git$/i, '');
  return REPO_RE.test(s) ? s : null;
}

const relTime = (iso) => {
  if (!iso) return 'unknown';
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} minutes ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)} hours ago`;
  return `${Math.floor(mins / 1440)} days ago`;
};

async function gh(repo, pathname) {
  const call = (useToken) => {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'SkillUp' };
    if (useToken && TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
    return fetch(`https://api.github.com/repos/${repo}${pathname}`, { headers, signal: AbortSignal.timeout(10000) });
  };
  let r = await call(true);
  // A bad/expired token shouldn't kill the feed — public repos work without one.
  if (r.status === 401 && TOKEN) r = await call(false);
  if (!r.ok) {
    let why = `GitHub ${r.status}`;
    if ((r.status === 403 || r.status === 429) && r.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(r.headers.get('x-ratelimit-reset')) * 1000;
      why = `GitHub rate limit reached${reset ? ` (resets ${new Date(reset).toLocaleTimeString()})` : ''}`;
    } else if (r.status === 404) {
      why = 'GitHub 404 — repo not found or private';
    }
    throw new Error(why);
  }
  return r.json();
}

const mapCommit = (c) => ({
  type: 'commit', iconId: 'ic-git-commit', color: 'var(--blue-dim)', icolor: 'var(--blue)',
  title: (c.commit?.message || '').split('\n')[0].slice(0, 90),
  summary: `Commit ${String(c.sha).slice(0, 7)}`,
  author: c.author?.login || c.commit?.author?.name || 'unknown',
  date: relTime(c.commit?.author?.date), badge: 'badge-blue', badgeText: 'Commit',
});
const mapPull = (p) => ({
  type: 'pr', iconId: 'ic-git-pull-request', color: 'var(--purple-dim)', icolor: 'var(--purple)',
  title: `#${p.number} ${p.title}`.slice(0, 90),
  summary: `${p.merged_at ? 'merged' : p.state} · ${p.user?.login || 'unknown'}`,
  author: p.user?.login || 'unknown',
  date: relTime(p.created_at), badge: 'badge-purple', badgeText: 'Pull Request',
});
const mapIssue = (i) => ({
  type: 'issue', iconId: 'ic-alert-circle', color: 'var(--green-dim)', icolor: 'var(--green)',
  title: `#${i.number} ${i.title}`.slice(0, 90),
  summary: `${i.state} · ${i.comments} comments`,
  author: i.user?.login || 'unknown',
  date: relTime(i.created_at), badge: 'badge-green', badgeText: 'Issue',
});

const seededRows = () => db.prepare('SELECT * FROM github_activities ORDER BY id').all();

async function buildPayload(repo) {
  const [meta, commits, pulls, issues] = await Promise.allSettled([
    gh(repo, ''),
    gh(repo, '/commits?per_page=5'),
    gh(repo, '/pulls?state=all&per_page=3'),
    gh(repo, '/issues?state=all&per_page=6'),   // extra room: this endpoint also returns PRs, which we drop
  ]);

  const seeded = seededRows();
  const sections = {};
  const items = [];
  const warnings = [];

  const take = (key, label, result, mapFn) => {
    if (result.status === 'fulfilled') {
      const rows = mapFn(result.value);
      sections[key] = { source: 'github', count: rows.length };
      items.push(...rows);
    } else {
      const fallback = seeded.filter(r => r.type === key);
      sections[key] = { source: 'seed', count: fallback.length, error: result.reason.message };
      warnings.push(`${label}: ${result.reason.message} — showing demo data for this section.`);
      items.push(...fallback);
    }
  };
  take('commit', 'Commits',       commits, (v) => v.map(mapCommit));
  take('pr',     'Pull requests', pulls,   (v) => v.map(mapPull));
  take('issue',  'Issues',        issues,  (v) => v.filter(i => !i.pull_request).slice(0, 3).map(mapIssue));

  const liveCount = Object.values(sections).filter(s => s.source === 'github').length;
  const source = liveCount === 3 ? 'github' : liveCount === 0 ? 'seed' : 'partial';

  if (source === 'seed') {
    // Nothing worked — return the seeded feed as-is and don't pretend a repo is connected.
    return { items: seeded, source, repo: null, sections, warnings };
  }

  const repoInfo = {
    fullName: repo,
    url: `https://github.com/${repo}`,
    description: meta.status === 'fulfilled' ? (meta.value.description || '') : '',
    stars: meta.status === 'fulfilled' ? meta.value.stargazers_count : null,
    forks: meta.status === 'fulfilled' ? meta.value.forks_count : null,
    language: meta.status === 'fulfilled' ? (meta.value.language || '') : '',
  };
  return { items, source, repo: repoInfo, sections, warnings };
}

exports.parseRepo = parseRepo;
exports.ghRequest = gh;

// ── GET /api/github-activity[?repo=owner/name|url][&refresh=1] ────────────────
exports.getActivities = async (req, res) => {
  try {
    const requested = req.query.repo;
    const repo = requested ? parseRepo(requested) : parseRepo(DEFAULT_REPO);

    if (requested && !repo) {
      return res.status(400).json({ success: false, error: 'Enter a repository as "owner/name" or a github.com URL.' });
    }
    if (!repo) {
      return res.json({ success: true, data: seededRows(), source: 'seed', repo: null, sections: {}, warnings: [] });
    }

    const hit = cache.get(repo);
    if (hit && !req.query.refresh && Date.now() - hit.at < hit.ttl) {
      return res.json({ success: true, data: hit.payload.items, ...hit.payload, items: undefined, cached: true });
    }

    const payload = await buildPayload(repo);
    cache.set(repo, { at: Date.now(), ttl: payload.source === 'github' ? TTL_OK : TTL_DEGRADED, payload });
    console.log(`[github] ${repo}: ${payload.source} (${Object.entries(payload.sections).map(([k, v]) => `${k}=${v.source}`).join(', ')})`);
    payload.warnings.forEach(w => console.warn(`[github] ${w}`));
    res.json({ success: true, data: payload.items, ...payload, items: undefined });
  } catch (err) {
    console.warn(`[github] Unexpected failure (${err.message}) — serving seeded data.`);
    res.json({ success: true, data: seededRows(), source: 'seed', repo: null, sections: {}, warnings: [err.message] });
  }
};
