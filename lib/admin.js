'use strict';
// Trang quản trị /admin: đăng nhập bằng mật khẩu, thêm/sắp xếp/ẩn/xóa sample.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const COOKIE = 'bs_admin';
const SESSION_HOURS = 12;

module.exports = function adminRouter({ store, uploadDir, categories, isProd }) {
  const router = express.Router();
  const PASSWORD = process.env.ADMIN_PASSWORD || '';
  const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  if (!PASSWORD) console.warn('[admin] Chưa đặt ADMIN_PASSWORD, trang /admin sẽ bị khóa.');

  /* ---------- Phiên đăng nhập (cookie ký HMAC) ---------- */
  const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
  const makeToken = () => { const exp = String(Date.now() + SESSION_HOURS * 36e5); return `${exp}.${sign(exp)}`; };
  const readCookie = (req) => {
    const m = (req.headers.cookie || '').match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : '';
  };
  const validToken = (t) => {
    const [exp, sig] = (t || '').split('.');
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    const a = Buffer.from(sig), b = Buffer.from(sign(exp));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  const setCookie = (res, val, maxAge) => res.setHeader('Set-Cookie',
    `${COOKIE}=${encodeURIComponent(val)}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isProd ? '; Secure' : ''}`);

  const requireAuth = (req, res, next) => (validToken(readCookie(req)) ? next() : res.redirect('/admin/login'));
  // Chặn gửi form từ trang khác (CSRF): POST phải đến từ cùng origin.
  const sameOrigin = (req, res, next) => {
    const o = req.get('origin');
    if (o && new URL(o).host !== req.get('host')) return res.status(403).send('Forbidden');
    next();
  };

  // Giới hạn đăng nhập sai: 5 lần / 15 phút / IP.
  const attempts = new Map();
  const tooMany = (ip) => { const a = attempts.get(ip); return a && a.n >= 5 && Date.now() - a.t < 15 * 6e4; };
  const fail = (ip) => { const a = attempts.get(ip); attempts.set(ip, a && Date.now() - a.t < 15 * 6e4 ? { n: a.n + 1, t: a.t } : { n: 1, t: Date.now() }); };

  router.use((req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(express.urlencoded({ extended: false, limit: '20kb' }));

  router.get('/login', (req, res) => res.render('admin/login', { error: null, locked: !PASSWORD }));
  router.post('/login', sameOrigin, (req, res) => {
    const ip = req.ip;
    if (!PASSWORD) return res.render('admin/login', { error: null, locked: true });
    if (tooMany(ip)) return res.status(429).render('admin/login', { error: 'Sai quá nhiều lần. Bạn thử lại sau 15 phút nhé.', locked: false });
    const a = crypto.createHash('sha256').update(String(req.body.password || '')).digest();
    const b = crypto.createHash('sha256').update(PASSWORD).digest();
    if (!crypto.timingSafeEqual(a, b)) { fail(ip); return res.status(401).render('admin/login', { error: 'Mật khẩu chưa đúng.', locked: false }); }
    attempts.delete(ip);
    setCookie(res, makeToken(), SESSION_HOURS * 3600);
    res.redirect('/admin');
  });
  router.post('/logout', sameOrigin, (req, res) => { setCookie(res, '', 0); res.redirect('/admin/login'); });

  /* ---------- Danh sách ---------- */
  router.get('/', requireAuth, (req, res) => {
    res.render('admin/index', { items: store.all(), categories, msg: req.query.msg || '' });
  });

  /* ---------- Thêm sample ---------- */
  const upload = multer({
    storage: multer.diskStorage({ destination: path.join(uploadDir, 'tmp'), filename: (r, f, cb) => cb(null, crypto.randomBytes(8).toString('hex')) }),
    limits: { fileSize: 80 * 1024 * 1024, files: 20 },
    fileFilter: (req, f, cb) => cb(null, /^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm))$/.test(f.mimetype)),
  });
  fs.mkdirSync(path.join(uploadDir, 'tmp'), { recursive: true });

  const watermark = (w, h) => {
    const s = Math.max(14, Math.round(Math.min(w, h) * 0.028));
    return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><style>t{font:700 ${s}px Helvetica,Arial,sans-serif}</style>
      <text x="${w - s * 1.1}" y="${h - s * 1.1}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${s}" fill="#000" fill-opacity=".28" dx="1" dy="1">© Bunnie Studio</text>
      <text x="${w - s * 1.1}" y="${h - s * 1.1}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${s}" fill="#fff" fill-opacity=".6">© Bunnie Studio</text></svg>`);
  };
  async function processImage(tmpPath, base) {
    const img = sharp(tmpPath, { failOn: 'none' }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true });
    const buf = await img.toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = buf.info;
    const full = await sharp(buf.data).composite([{ input: watermark(w, h) }]).webp({ quality: 80 }).toBuffer();
    fs.writeFileSync(path.join(uploadDir, `${base}.webp`), full);
    await sharp(full).resize(720, 720, { fit: 'inside' }).webp({ quality: 76 }).toFile(path.join(uploadDir, `${base}-sm.webp`));
    return { w, h, src: `/uploads/${base}.webp`, thumb: `/uploads/${base}-sm.webp` };
  }

  // Nhận link Google Drive / YouTube → link nhúng.
  function embedFrom(url) {
    try {
      const u = new URL(url);
      const drive = u.hostname.endsWith('drive.google.com') && (u.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1] || u.searchParams.get('id');
      if (u.hostname.endsWith('drive.google.com') && drive) return { embed: `https://drive.google.com/file/d/${drive}/preview` };
      const yt = /youtu\.be$/.test(u.hostname) ? u.pathname.slice(1) : u.hostname.endsWith('youtube.com') ? (u.searchParams.get('v') || (u.pathname.match(/\/(?:shorts|embed)\/([\w-]+)/) || [])[1]) : null;
      if (yt) return { embed: `https://www.youtube-nocookie.com/embed/${yt}`, ytThumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` };
    } catch { /* bỏ qua */ }
    return null;
  }

  router.post('/add', requireAuth, sameOrigin, upload.fields([{ name: 'files', maxCount: 20 }, { name: 'cover', maxCount: 1 }]), async (req, res) => {
    const files = (req.files && req.files.files) || [];
    const cover = req.files && req.files.cover && req.files.cover[0];
    const category = categories.some((c) => c.id === req.body.category) ? req.body.category : null;
    const meta = { category, title: String(req.body.title || '').slice(0, 120), hideName: req.body.hideName === 'on', hidden: false };
    const cleanup = () => [...files, cover].filter(Boolean).forEach((f) => fs.rmSync(f.path, { force: true }));
    try {
      if (!category) throw new Error('Bạn chưa chọn nhóm sample.');
      let added = 0;
      for (const f of files) {
        const base = `samples/${category}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        if (f.mimetype.startsWith('image/')) {
          store.add({ ...meta, type: 'image', ...(await processImage(f.path, base)) }); added++;
        } else {
          const ext = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }[f.mimetype];
          fs.renameSync(f.path, path.join(uploadDir, `${base}.${ext}`));
          const item = { ...meta, type: 'video', src: `/uploads/${base}.${ext}`, w: 16, h: 9 };
          if (cover) { const c = await processImage(cover.path, base + '-cover'); Object.assign(item, { poster: c.src, w: c.w, h: c.h }); }
          store.add(item); added++;
        }
      }
      const link = String(req.body.videoUrl || '').trim();
      if (link) {
        const e = embedFrom(link);
        if (!e) throw new Error('Link video chưa đúng. Hãy dán link Google Drive hoặc YouTube.');
        const item = { ...meta, type: 'embed', embed: e.embed, w: 16, h: 9 };
        const base = `samples/${category}-${Date.now()}-cover`;
        if (cover) { const c = await processImage(cover.path, base); Object.assign(item, { poster: c.thumb, w: c.w, h: c.h }); }
        else if (e.ytThumb) item.poster = e.ytThumb;
        store.add(item); added++;
      }
      if (!added) throw new Error('Bạn chưa chọn ảnh/video hoặc dán link video.');
      cleanup();
      res.redirect(`/admin?msg=${encodeURIComponent(`Đã thêm ${added} sample.`)}#nhom-${category}`);
    } catch (err) {
      cleanup();
      res.redirect(`/admin?msg=${encodeURIComponent(err.message || 'Có lỗi khi xử lý file.')}`);
    }
  });

  /* ---------- Thao tác từng sample ---------- */
  router.post('/item/:id/:action', requireAuth, sameOrigin, (req, res) => {
    const { id, action } = req.params;
    const it = store.all().find((s) => s.id === id);
    if (!it) return res.redirect('/admin');
    if (action === 'up') store.move(id, -1);
    else if (action === 'down') store.move(id, 1);
    else if (action === 'hide') store.update(id, { hidden: !it.hidden });
    else if (action === 'delete') store.remove(id);
    else if (action === 'edit') store.update(id, { title: String(req.body.title || '').slice(0, 120), hideName: req.body.hideName === 'on' });
    res.redirect(`/admin#nhom-${it.category}`);
  });

  router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) return res.redirect(`/admin?msg=${encodeURIComponent(err.code === 'LIMIT_FILE_SIZE' ? 'File quá lớn (tối đa 80MB).' : 'Lỗi upload file.')}`);
    next(err);
  });

  return router;
};
