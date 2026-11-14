'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');
const { marked } = require('marked');
const createStore = require('./lib/samples-store');
const adminRouter = require('./lib/admin');

const ROOT = __dirname;
const CONTENT = path.join(ROOT, 'content');
const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || 'https://bunniestudio.vn';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'));
const store = createStore({ uploadDir: UPLOAD_DIR, seedFile: path.join(CONTENT, 'samples-seed.json') });

const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8'));

// Nội dung đọc lại mỗi request khi dev để sửa JSON thấy ngay; production đọc 1 lần.
const isProd = process.env.NODE_ENV === 'production';
let cache = null;
function content() {
  if (cache && isProd) return cache;
  const pricing = readJSON('pricing.json');
  const blogIndex = readJSON('blog/index.json');
  cache = {
    pricing,
    booking: readJSON('booking.json'),
    form: readJSON('brief-form.json'),
    faq: readJSON('faq.json'),
    contact: readJSON('contact.json'),
    site: readJSON('site.json'),
    samples: readJSON('samples.json'),
    rules: parseRules(fs.readFileSync(path.join(CONTENT, 'rules-source.md'), 'utf8')),
    blogIndex,
  };
  return cache;
}

// Tách file Rules thành: quy trình (6 bước) và điều khoản (7 nhóm).
function parseRules(md) {
  const [processPart, termsPart] = md.split(/^# \*\*2\./m);
  const steps = [];
  const stepRe = /\*\*BƯỚC (\d+): ([^*]+)\*\*\n([\s\S]*?)(?=\n\*\*BƯỚC|\n# |$)/g;
  let m;
  while ((m = stepRe.exec(processPart))) {
    steps.push({ n: Number(m[1]), title: m[2].trim(), html: marked.parse(m[3].replace(/^> ?/gm, '').trim()) });
  }
  const terms = [];
  const termRe = /### \*\*(\d+)\. ([^*]+)\*\*\n([\s\S]*?)(?=\n### |$)/g;
  while ((m = termRe.exec(termsPart || ''))) {
    terms.push({ n: Number(m[1]), title: m[2].trim(), html: marked.parse(m[3].replace(/^> ?/gm, '').trim()) });
  }
  return { steps, terms };
}

function readBlogPost(slug) {
  const file = path.join(CONTENT, 'blog', `${slug}.md`);
  if (!/^[a-z0-9-]+$/.test(slug) || !fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  if (fm) fm[1].split('\n').forEach((l) => { const i = l.indexOf(':'); meta[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, ''); });
  const body = raw.slice(fm ? fm[0].length : 0).replace(/\\([-.^>_])/g, '$1');
  return { ...meta, html: marked.parse(body) };
}

const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));
app.set('trust proxy', 1);
app.use(compression());
app.use(express.json({ limit: '50kb' }));

// Chặn bot huấn luyện AI ở tầng HTTP cho ảnh/video sample.
const AI_BOTS = /(GPTBot|ChatGPT-User|CCBot|ClaudeBot|Claude-Web|anthropic-ai|Google-Extended|PerplexityBot|Bytespider|Amazonbot|Applebot-Extended|FacebookBot|meta-externalagent|Diffbot|Omgilibot|ImagesiftBot|cohere-ai|YouBot)/i;
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', req.path.startsWith('/samples/') ? 'noai, noimageai, noimageindex' : 'noai, noimageai');
  if (AI_BOTS.test(req.get('user-agent') || '')) return res.status(403).send('Forbidden');
  next();
});

app.use(express.static(path.join(ROOT, 'public'), { maxAge: isProd ? '7d' : 0, extensions: ['html'] }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: isProd ? '30d' : 0, index: false, setHeaders: (res) => res.setHeader('X-Robots-Tag', 'noai, noimageai, noimageindex') }));
app.use('/admin', adminRouter({ store, uploadDir: UPLOAD_DIR, categories: readJSON('samples.json').categories.filter((k) => k.id !== 'edit-video'), isProd }));

const fmt = (n) => (n >= 1000000 ? `${(n / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr` : `${Math.round(n / 1000)}k`);
app.locals.money = (min, max) => (min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`);
app.locals.SITE_URL = SITE_URL;

app.get('/', (req, res) => res.render('index', { c: { ...content(), sampleItems: store.visible() }, page: 'home' }));

app.get('/blog', (req, res) => res.render('blog-index', { c: content(), page: 'blog' }));
app.get('/blog/:slug', (req, res, next) => {
  const post = readBlogPost(req.params.slug);
  if (!post) return next();
  res.render('blog-post', { c: content(), page: 'blog', post });
});

app.get('/robots.txt', (req, res) => {
  const bots = ['GPTBot', 'ChatGPT-User', 'CCBot', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'Google-Extended', 'PerplexityBot', 'Bytespider', 'Amazonbot', 'Applebot-Extended', 'FacebookBot', 'meta-externalagent', 'Diffbot', 'ImagesiftBot', 'cohere-ai'];
  res.type('text/plain').send(
    bots.map((b) => `User-agent: ${b}\nDisallow: /`).join('\n\n') +
      `\n\nUser-agent: Googlebot-Image\nDisallow: /samples/\n\nUser-agent: *\nDisallow: /admin\nDisallow: /samples/\nDisallow: /uploads/\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/blog', ...content().blogIndex.map((p) => `/blog/${p.slug}`)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${SITE_URL}${u}</loc></url>`).join('')}</urlset>`);
});

// ---- Lịch trống: đọc Google Sheet (CSV công khai). Cache 5 phút.
let availCache = { at: 0, data: null };
app.get('/api/availability', async (req, res) => {
  const url = process.env.AVAILABILITY_CSV_URL;
  if (!url) return res.json({ configured: false, days: {} });
  if (availCache.data && Date.now() - availCache.at < 5 * 60 * 1000) return res.json(availCache.data);
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const csv = await r.text();
    const days = {};
    const map = { 'trống': 'open', 'còn ít': 'limited', 'kín': 'full' };
    csv.split(/\r?\n/).slice(1).forEach((line) => {
      const [d, s] = line.split(',').map((x) => (x || '').replace(/^"|"$/g, '').trim());
      const mm = d && d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      const st = map[(s || '').toLowerCase()];
      if (mm && st) days[`${mm[3]}-${mm[2].padStart(2, '0')}-${mm[1].padStart(2, '0')}`] = st;
    });
    availCache = { at: Date.now(), data: { configured: true, days } };
    res.json(availCache.data);
  } catch (e) {
    res.json({ configured: false, days: {}, error: 'fetch_failed' });
  }
});

// ---- Kiểm tra link brief đã mở quyền "Bất kỳ ai có đường liên kết" chưa.
app.post('/api/check-link', async (req, res) => {
  let u;
  try { u = new URL(String(req.body.url || '')); } catch { return res.json({ ok: false, reason: 'invalid' }); }
  if (!/^https?:$/.test(u.protocol)) return res.json({ ok: false, reason: 'invalid' });
  const isGoogle = /(^|\.)google\.com$/.test(u.hostname);
  if (!isGoogle) return res.json({ ok: true, reason: 'not_google' });
  try {
    const sheet = u.pathname.match(/\/spreadsheets\/d\/([\w-]+)/);
    const doc = u.pathname.match(/\/document\/d\/([\w-]+)/);
    const target = sheet ? `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv`
      : doc ? `https://docs.google.com/document/d/${doc[1]}/export?format=txt` : u.toString();
    const r = await fetch(target, { redirect: 'manual' });
    const loc = r.headers.get('location') || '';
    const isPrivate = /accounts\.google\.com|ServiceLogin/.test(loc) || r.status === 401 || r.status === 403 || r.status === 404;
    res.json({ ok: !isPrivate, reason: isPrivate ? 'private' : 'public' });
  } catch {
    res.json({ ok: true, reason: 'unchecked' });
  }
});

// ---- Nhận thông tin khách: chuyển tới Google Apps Script (ghi Sheet + gửi email).
app.post('/api/contact', async (req, res) => {
  const b = req.body || {};
  const phone = String(b.phone || '').replace(/[^\d+]/g, '');
  if (!/^\+?\d{9,12}$/.test(phone)) return res.status(400).json({ ok: false, error: 'phone' });
  const entry = {
    at: new Date().toISOString(),
    phone,
    briefUrl: String(b.briefUrl || '').slice(0, 500),
    summary: String(b.summary || '').slice(0, 2000),
  };
  const hook = process.env.APPS_SCRIPT_URL;
  try {
    if (hook) {
      await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
    } else {
      fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
      fs.appendFileSync(path.join(ROOT, 'data', 'submissions.jsonl'), JSON.stringify(entry) + '\n');
    }
    res.json({ ok: true });
  } catch {
    res.status(502).json({ ok: false, error: 'forward' });
  }
});

app.use((req, res) => res.status(404).render('404', { c: content(), page: '404' }));

app.listen(PORT, () => console.log(`Bunnie Studio đang chạy tại http://localhost:${PORT}`));
