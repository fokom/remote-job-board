#!/usr/bin/env node
/**
 * Local admin server for reviewing, tagging and publishing jobs.
 * No dependencies. Only listens on 127.0.0.1, so it is never exposed to the internet.
 *
 *   npm run admin        ->  http://localhost:4321
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.ADMIN_PORT || 4321);
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// ---------- file helpers ----------
function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(name, value) {
  const file = path.join(DATA, name);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const byNewest = (a, b) =>
  String(b.published_at || b.posted_at || b.fetched_at || '').localeCompare(
    String(a.published_at || a.posted_at || a.fetched_at || '')
  );

function validCategories(requested) {
  const known = new Set(readJson('categories.json', []).map((c) => c.slug));
  return [...new Set((Array.isArray(requested) ? requested : []).filter((s) => known.has(s)))];
}

function takeByIds(list, ids) {
  const wanted = new Set(ids);
  const taken = [];
  const rest = [];
  for (const item of list) (wanted.has(item.id) ? taken : rest).push(item);
  return [taken, rest];
}

const asIds = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

// ---------- python runner ----------
function runPython(args) {
  return new Promise((resolve) => {
    const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
    const script = path.join(ROOT, 'fetcher', 'fetch_jobs.py');
    const tryNext = (i) => {
      if (i >= candidates.length) {
        resolve({ ok: false, log: 'Python was not found. Install Python 3 and try again.' });
        return;
      }
      const child = spawn(candidates[i], [script, ...args], { cwd: ROOT });
      let out = '';
      let missing = false;
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (out += d));
      child.on('error', (e) => {
        if (e.code === 'ENOENT') missing = true;
        else resolve({ ok: false, log: String(e) });
      });
      child.on('close', (code) => {
        if (missing) return tryNext(i + 1);
        resolve({ ok: code === 0, log: out.trim() });
      });
    };
    tryNext(0);
  });
}

function runGit(args) {
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd: ROOT });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => resolve({ code: 1, out: String(e.message || e) }));
    child.on('close', (code) => resolve({ code, out: out.trim() }));
  });
}

// ---------- API ----------
const api = {
  'GET /api/state': () => ({
    pending: readJson('pending.json', []),
    pool: readJson('pool.json', []),
    published: readJson('published.json', []),
    categories: readJson('categories.json', []),
    sites: readJson('company_sites.json', []),
    rejectedCount: readJson('rejected.json', []).length,
  }),

  'POST /api/fetch': async (body) => {
    const args = [];
    if (body.skipSources) args.push('--skip-sources');
    if (body.skipSites) args.push('--skip-sites');
    return runPython(args);
  },

  // pending -> pool (each item brings its chosen categories)
  'POST /api/pool/add': (body) => {
    const items = Array.isArray(body.items) ? body.items : [];
    const catsById = new Map(items.map((i) => [i.id, validCategories(i.categories)]));
    const missing = [...catsById].filter(([, c]) => c.length === 0).map(([id]) => id);
    if (missing.length) return { status: 400, error: 'Pick at least one category for every job you add.', missing };
    const [moved, rest] = takeByIds(readJson('pending.json', []), [...catsById.keys()]);
    const pool = readJson('pool.json', []);
    for (const job of moved) pool.unshift({ ...job, categories: catsById.get(job.id), pooled_at: new Date().toISOString() });
    writeJson('pending.json', rest);
    writeJson('pool.json', pool);
    return { ok: true, moved: moved.length };
  },

  // pending -> rejected (remember ids so they never come back)
  'POST /api/reject': (body) => {
    const [moved, rest] = takeByIds(readJson('pending.json', []), asIds(body.ids));
    const rejected = new Set(readJson('rejected.json', []));
    moved.forEach((j) => rejected.add(j.id));
    writeJson('pending.json', rest);
    writeJson('rejected.json', [...rejected]);
    return { ok: true, moved: moved.length };
  },

  // pool -> pending (changed my mind)
  'POST /api/pool/remove': (body) => {
    const [moved, rest] = takeByIds(readJson('pool.json', []), asIds(body.ids));
    const pending = readJson('pending.json', []);
    moved.forEach((j) => pending.push(j));
    writeJson('pool.json', rest);
    writeJson('pending.json', pending);
    return { ok: true, moved: moved.length };
  },

  // edit categories (and a few fields) of a job in the pool or live
  'POST /api/update': (body) => {
    const cats = validCategories(body.categories);
    if (!cats.length) return { status: 400, error: 'Pick at least one category.' };
    for (const file of ['pool.json', 'published.json']) {
      const list = readJson(file, []);
      const job = list.find((j) => j.id === body.id);
      if (!job) continue;
      job.categories = cats;
      for (const field of ['title', 'company', 'salary', 'remote_status', 'location']) {
        if (typeof body[field] === 'string') job[field] = body[field].trim().slice(0, 200);
      }
      if (!['worldwide', 'restricted', 'unclear'].includes(job.remote_status)) job.remote_status = 'unclear';
      writeJson(file, list);
      return { ok: true };
    }
    return { status: 404, error: 'Job not found in pool or live list.' };
  },

  // pool -> published
  'POST /api/publish': (body) => {
    const pool = readJson('pool.json', []);
    const ids = body.all ? pool.map((j) => j.id) : asIds(body.ids);
    const [moved, rest] = takeByIds(pool, ids);
    const published = readJson('published.json', []);
    const now = new Date().toISOString();
    moved.forEach((j) => published.push({ ...j, published_at: now }));
    published.sort(byNewest);
    writeJson('pool.json', rest);
    writeJson('published.json', published);
    return { ok: true, moved: moved.length };
  },

  // published -> pool
  'POST /api/unpublish': (body) => {
    const [moved, rest] = takeByIds(readJson('published.json', []), asIds(body.ids));
    const pool = readJson('pool.json', []);
    moved.forEach((j) => {
      const { published_at, ...job } = j;
      pool.unshift(job);
    });
    writeJson('published.json', rest);
    writeJson('pool.json', pool);
    return { ok: true, moved: moved.length };
  },

  'POST /api/categories': (body) => {
    const name = String(body.name || '').trim().slice(0, 40);
    const slug = slugify(name);
    if (!name || !slug) return { status: 400, error: 'Give the category a name.' };
    const list = readJson('categories.json', []);
    if (list.some((c) => c.slug === slug)) return { status: 400, error: 'That category already exists.' };
    list.push({ slug, name });
    writeJson('categories.json', list);
    return { ok: true, categories: list };
  },

  'POST /api/sites': (body) => {
    const TYPES = ['auto', 'greenhouse', 'lever', 'ashby', 'workable', 'rss', 'html'];
    const sites = (Array.isArray(body.sites) ? body.sites : [])
      .map((s) => ({
        name: String(s.name || '').trim().slice(0, 80),
        url: String(s.url || '').trim(),
        type: TYPES.includes(s.type) ? s.type : 'auto',
        all_remote: !!s.all_remote,
        enabled: s.enabled !== false,
      }))
      .filter((s) => /^https?:\/\//i.test(s.url));
    writeJson('company_sites.json', sites);
    return { ok: true, sites };
  },

  // commit data/ and push so the host rebuilds the public site
  'POST /api/deploy': async () => {
    const inside = await runGit(['rev-parse', '--is-inside-work-tree']);
    if (inside.code !== 0) {
      return { ok: false, log: 'This folder is not a git repository yet. Run `git init`, add a GitHub remote, and push once; after that this button works.' };
    }
    await runGit(['add', 'data']);
    const staged = await runGit(['diff', '--cached', '--quiet']);
    if (staged.code === 0) return { ok: true, log: 'Nothing new to deploy: the data folder has no changes.' };
    const commit = await runGit(['commit', '-m', 'Update jobs ' + new Date().toISOString().slice(0, 10)]);
    if (commit.code !== 0) return { ok: false, log: commit.out };
    const push = await runGit(['push']);
    return { ok: push.code === 0, log: (commit.out + '\n' + push.out).trim() };
  },
};

// ---------- server ----------
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 5e6) {
        reject(new Error('Body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Block other websites from calling this local server through the browser.
function allowedHost(req) {
  const host = String(req.headers.host || '');
  return host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`;
}

const server = http.createServer(async (req, res) => {
  try {
    if (!allowedHost(req)) return send(res, 403, 'Forbidden');
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      const key = `${req.method} ${url.pathname}`;
      const handler = api[key];
      if (!handler) return send(res, 404, { error: 'Not found' });
      if (req.method === 'POST') {
        const origin = req.headers.origin;
        if (req.headers['x-admin'] !== '1' || (origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) {
          return send(res, 403, { error: 'Forbidden' });
        }
      }
      const body = req.method === 'POST' ? await readBody(req) : {};
      const result = await handler(body);
      const status = result && result.status ? result.status : 200;
      if (result && result.status) delete result.status;
      return send(res, status, result);
    }

    // static files
    let rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return send(res, 404, 'Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    send(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Admin running at http://localhost:${PORT}  (Ctrl+C to stop)`);
});
