// controllers/projectExplorer.controller.js — File tree inspection & AI explanation data.
//
// GET  /api/explorer            — seeded demo tree + canned explanations (unchanged).
// GET  /api/explorer/repo       — REAL file tree for a GitHub repo (Git Trees API).
// POST /api/explorer/explain    — REAL per-file AI explanation, generated from the
//                                  file's actual content (GitHub Contents API + Groq).
//
// Both real-data endpoints reuse github.controller's repo parsing / GitHub request
// helper so behavior (token fallback, rate-limit messages, "owner/name or URL"
// parsing) stays identical to the GitHub Activity tab.

const { db } = require('../config/db');
const github = require('./github.controller');
const ai = require('../services/ai');

const treeCache = new Map();     // "owner/name" -> { at, tree, branch, truncated }
const explainCache = new Map();  // "owner/name|branch|path" -> { at, data }
const TTL_TREE = 5 * 60 * 1000;
const TTL_EXPLAIN = 30 * 60 * 1000;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage',
  'venv', '.venv', '__pycache__', '.cache', 'vendor', '.turbo',
]);
const SKIP_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'bmp', 'svg', 'woff', 'woff2',
  'ttf', 'eot', 'mp4', 'mp3', 'wav', 'pdf', 'zip', 'tar', 'gz', 'exe', 'dll',
  'so', 'db', 'sqlite', 'sqlite3', 'lock', 'bin', 'wasm',
]);
// Only files with one of these extensions get sent to the AI — everything
// else (binaries, lockfiles, images) gets a plain "not source code" note.
const TEXT_EXTS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'java', 'go', 'rb', 'php',
  'c', 'cpp', 'h', 'hpp', 'cs', 'rs', 'swift', 'kt', 'kts', 'json', 'md',
  'mdx', 'yml', 'yaml', 'html', 'css', 'scss', 'sass', 'less', 'sql', 'sh',
  'bash', 'env', 'txt', 'xml', 'vue', 'svelte', 'toml', 'ini', 'graphql',
  'proto', 'dockerfile',
]);
const MAX_ENTRIES = 400;       // cap so huge monorepos still render a usable tree
const MAX_FILE_BYTES = 300000; // skip anything this big (generated bundles, etc.)
const MAX_PROMPT_CHARS = 6000; // ~1.5-2k tokens — keeps each explanation cheap & fast

const extOf = (name) => {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
};

// Turns a flat list of {path} blobs into the nested {type,name,path,level,children}
// shape the frontend tree renderer expects.
function buildTree(paths) {
  const root = [];
  const dirChildren = new Map([['', root]]);

  function ensureDir(dirPath) {
    if (dirChildren.has(dirPath)) return dirChildren.get(dirPath);
    const parent = dirPath.includes('/') ? dirPath.slice(0, dirPath.lastIndexOf('/')) : '';
    const parentChildren = ensureDir(parent);
    const name = dirPath.split('/').pop();
    const level = dirPath.split('/').length - 1;
    const node = { type: 'folder', name, path: dirPath, level, open: level === 0, children: [] };
    parentChildren.push(node);
    dirChildren.set(dirPath, node.children);
    return node.children;
  }

  for (const p of paths) {
    const parts = p.path.split('/');
    const name = parts[parts.length - 1];
    const dir = parts.slice(0, -1).join('/');
    const children = ensureDir(dir);
    children.push({ type: 'file', name, path: p.path, level: parts.length - 1, ext: extOf(name) });
  }

  (function sortRec(nodes) {
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1));
    nodes.forEach((n) => n.children && sortRec(n.children));
  })(root);

  return root;
}

// ── GET /api/explorer/repo?repo=owner/name|url[&refresh=1] ────────────────────
exports.getRepoTree = async (req, res) => {
  try {
    const repo = github.parseRepo(req.query.repo);
    if (!repo) {
      return res.status(400).json({ success: false, error: 'Enter a repository as "owner/name" or a github.com URL.' });
    }

    const hit = treeCache.get(repo);
    if (hit && !req.query.refresh && Date.now() - hit.at < TTL_TREE) {
      return res.json({ success: true, data: { fileTree: hit.tree, repo, branch: hit.branch, truncated: hit.truncated }, cached: true });
    }

    const meta = await github.ghRequest(repo, '');
    const branch = meta.default_branch || 'main';
    const treeResp = await github.ghRequest(repo, `/git/trees/${encodeURIComponent(branch)}?recursive=1`);

    if (treeResp.truncated) {
      console.warn(`[explorer] ${repo}: GitHub itself truncated the tree response (very large repo).`);
    }

    const blobs = (treeResp.tree || []).filter((e) => e.type === 'blob');
    const filtered = blobs.filter((e) => {
      const parts = e.path.split('/');
      if (parts.some((seg) => SKIP_DIRS.has(seg))) return false;
      if (SKIP_EXTS.has(extOf(parts[parts.length - 1]))) return false;
      if (e.size && e.size > MAX_FILE_BYTES) return false;
      return true;
    });

    const truncated = filtered.length > MAX_ENTRIES;
    const limited = filtered.slice(0, MAX_ENTRIES).map((e) => ({ path: e.path }));
    const fileTree = buildTree(limited);

    treeCache.set(repo, { at: Date.now(), tree: fileTree, branch, truncated });
    console.log(`[explorer] Built real tree for ${repo}@${branch}: ${limited.length} files${truncated ? ' (truncated, showing first ' + MAX_ENTRIES + ')' : ''}.`);
    res.json({ success: true, data: { fileTree, repo, branch, truncated } });
  } catch (err) {
    console.error('[explorer] getRepoTree error:', err.message);
    res.status(502).json({ success: false, error: err.message });
  }
};

// ── POST /api/explorer/explain  { repo, path, branch? } ───────────────────────
// Fetches the file's real content from GitHub and asks the AI to explain THAT —
// not a canned description. Truncates long files and caches results so re-opening
// a file (or two users opening the same repo) doesn't re-spend tokens.
exports.explainFile = async (req, res) => {
  try {
    const { repo: rawRepo, path, branch: reqBranch } = req.body || {};
    const repo = github.parseRepo(rawRepo);
    if (!repo || !path) {
      return res.status(400).json({ success: false, error: 'repo and path are required.' });
    }

    const branch = reqBranch || treeCache.get(repo)?.branch;
    const cacheKey = `${repo}|${branch || ''}|${path}`;
    const hit = explainCache.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL_EXPLAIN) {
      return res.json({ success: true, data: hit.data, cached: true });
    }

    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const qs = branch ? `?ref=${encodeURIComponent(branch)}` : '';
    const file = await github.ghRequest(repo, `/contents/${encodedPath}${qs}`);
    if (Array.isArray(file) || !file || !file.content) {
      throw new Error('That path is not a readable file.');
    }

    const ext = extOf(path);
    const buf = Buffer.from(file.content, file.encoding === 'base64' ? 'base64' : 'utf8');

    if (!TEXT_EXTS.has(ext) || buf.length === 0) {
      const data = { explanation: `This is a .${ext || 'binary'} file, not source code — there's nothing for the AI to analyze here.`, live: false };
      explainCache.set(cacheKey, { at: Date.now(), data });
      return res.json({ success: true, data });
    }

    let content = buf.toString('utf8');
    const wasTruncated = content.length > MAX_PROMPT_CHARS;
    if (wasTruncated) content = content.slice(0, MAX_PROMPT_CHARS);

    if (!ai.isConfigured()) {
      const data = { explanation: '[Demo mode — no AI_API_KEY set] Add AI_API_KEY to .env to get real explanations generated from this file\'s actual content.', live: false };
      explainCache.set(cacheKey, { at: Date.now(), data });
      return res.json({ success: true, data });
    }

    const messages = [
      {
        role: 'system',
        content:
          'You are a senior engineer explaining an unfamiliar codebase to a new teammate. ' +
          'Given one file\'s path and content, explain in 3-5 short sentences what it does, ' +
          'its likely role in the project, and anything notable about how it\'s written. ' +
          'Be specific to the actual code shown — never generic. No markdown headers or bullet lists.',
      },
      { role: 'user', content: `File: ${path}${wasTruncated ? ' (truncated — showing the first part of the file)' : ''}\n\n${content}` },
    ];

    let data;
    try {
      const { text, live } = await ai.complete(messages, { timeoutMs: 25000 });
      data = { explanation: text || 'No explanation returned.', live };
    } catch (aiErr) {
      console.error('[explorer] AI call failed:', aiErr.message);
      data = { explanation: `[Live AI call failed] ${aiErr.message}`, live: false };
    }

    explainCache.set(cacheKey, { at: Date.now(), data });
    console.log(`[explorer] Explained ${repo}/${path} (live=${data.live}).`);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[explorer] explainFile error:', err.message);
    res.status(502).json({ success: false, error: err.message });
  }
};

// ── GET /api/explorer ──────────────────────────────────────────────────────────
exports.getExplorer = (req, res) => {
  console.log('[explorer] GET /api/explorer');
  try {
    const row = db.prepare('SELECT * FROM explorer WHERE id = 1').get();
    if (!row) {
      console.warn('[explorer] No explorer row found — run: node scripts/seed.js');
      return res.status(404).json({ success: false, error: 'Explorer data not found. Run: node scripts/seed.js' });
    }
    const data = {
      fileTree:         JSON.parse(row.fileTree),
      fileExplanations: JSON.parse(row.fileExplanations),
    };
    console.log(`[explorer] Returning file tree with ${data.fileTree.length} root node(s).`);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[explorer] getExplorer error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
