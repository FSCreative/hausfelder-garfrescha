/* Haus Felder Garfrescha – Express Server */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- Daten-Verzeichnis (Railway Volume) ---------- */
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const SEED_FILE = path.join(__dirname, 'content', 'content.json');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CONTENT_FILE)) {
  fs.copyFileSync(SEED_FILE, CONTENT_FILE);
}

/* Seed-Inhalte mit gespeicherten Inhalten zusammenführen,
   damit neue Felder nach Updates automatisch verfügbar sind */
function deepMerge(base, override) {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (typeof base !== 'object' || base === null) return override !== undefined ? override : base;
  const out = {};
  for (const k of Object.keys(base)) {
    out[k] = override && k in override ? deepMerge(base[k], override[k]) : base[k];
  }
  if (override) {
    for (const k of Object.keys(override)) if (!(k in base)) out[k] = override[k];
  }
  return out;
}

function loadContent() {
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  const saved = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  return deepMerge(seed, saved);
}
function saveContent(c) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(c, null, 2));
}

/* ---------- Admin-Auth ---------- */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'garfrescha';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('hfg:' + ADMIN_PASSWORD).digest('hex');

function sign(value) {
  return value + '.' + crypto.createHmac('sha256', SECRET).update(value).digest('hex');
}
function verify(signed) {
  if (!signed) return false;
  const i = signed.lastIndexOf('.');
  if (i < 0) return false;
  const value = signed.slice(0, i);
  try {
    return crypto.timingSafeEqual(Buffer.from(sign(value)), Buffer.from(signed)) && value === 'admin';
  } catch { return false; }
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function requireAdmin(req, res, next) {
  if (verify(parseCookies(req).hfg_admin)) return next();
  res.redirect('/admin/login');
}

/* ---------- Uploads ---------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
    cb(null, Date.now() + '-' + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /image\/(jpeg|png|webp|avif|gif)/.test(file.mimetype))
});

/* ---------- Middleware ---------- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(UPLOAD_DIR));

/* ---------- Seiten ---------- */
const pages = [
  { url: '/', view: 'home', nav: 'Home' },
  { url: '/wohnung', view: 'wohnung', nav: 'Wohnung' },
  { url: '/anreise', view: 'anreise', nav: 'Anreise' },
  { url: '/sommer', view: 'sommer', nav: 'Sommer' },
  { url: '/winter', view: 'winter', nav: 'Winter' },
  { url: '/kontakt', view: 'kontakt', nav: 'Kontakt' }
];

pages.forEach(p => {
  app.get(p.url, (req, res) => {
    const c = loadContent();
    res.render(p.view, { c, page: p.url, sent: null });
  });
});

// Alte Wix-URLs weiterleiten
app.get('/anreiseinfos', (req, res) => res.redirect(301, '/anreise'));
app.get('/links', (req, res) => res.redirect(301, '/sommer'));

// Rechtsseiten
app.get('/impressum', (req, res) => res.render('impressum', { c: loadContent(), page: '/impressum' }));
app.get('/datenschutz', (req, res) => res.render('datenschutz', { c: loadContent(), page: '/datenschutz' }));

app.get('/anfrage', (req, res) => {
  const c = loadContent();
  res.render('anfrage', { c, page: '/anfrage', sent: null, error: null, form: {} });
});

/* ---------- Anfrage per SMTP ---------- */
app.post('/anfrage', async (req, res) => {
  const c = loadContent();
  const f = req.body || {};
  if (f.website) return res.redirect('/anfrage'); // Honeypot

  const required = ['name', 'email', 'anreise', 'abreise', 'personen'];
  if (required.some(k => !f[k] || !String(f[k]).trim())) {
    return res.status(400).render('anfrage', { c, page: '/anfrage', sent: false, error: 'Bitte alle Pflichtfelder ausfüllen.', form: f });
  }

  const text =
`Neue Anfrage über hausfelder-garfrescha.com

Name:     ${f.name}
E-Mail:   ${f.email}
Telefon:  ${f.telefon || '-'}
Anreise:  ${f.anreise}
Abreise:  ${f.abreise}
Personen: ${f.personen}

Nachricht:
${f.nachricht || '-'}`;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: `"Website Haus Felder" <${process.env.SMTP_USER}>`,
      to: process.env.MAIL_TO || c.site.email,
      replyTo: f.email,
      subject: `Anfrage ${f.anreise} – ${f.abreise} (${f.personen} Pers.) von ${f.name}`,
      text
    });
    res.render('anfrage', { c, page: '/anfrage', sent: true, error: null, form: {} });
  } catch (err) {
    console.error('Mailversand fehlgeschlagen:', err.message);
    res.status(500).render('anfrage', {
      c, page: '/anfrage', sent: false,
      error: 'Die Anfrage konnte leider nicht gesendet werden. Bitte kontaktiere uns direkt per E-Mail an ' + c.site.email,
      form: f
    });
  }
});

/* ---------- Admin ---------- */
app.get('/admin/login', (req, res) => {
  if (verify(parseCookies(req).hfg_admin)) return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
  if ((req.body.password || '') === ADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', `hfg_admin=${encodeURIComponent(sign('admin'))}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`);
    return res.redirect('/admin');
  }
  res.status(401).render('admin-login', { error: 'Falsches Passwort' });
});

app.get('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'hfg_admin=; Path=/; Max-Age=0');
  res.redirect('/');
});

app.get('/admin', requireAdmin, (req, res) => {
  const c = loadContent();
  res.render('admin', { c, saved: req.query.saved === '1' });
});

/* Texte speichern: Felder heißen z.B. "home.heroTitle" oder "wohnung.ausstattung" (Liste = 1 Zeile pro Eintrag) */
app.post('/admin/save', requireAdmin, (req, res) => {
  const c = loadContent();
  for (const [key, raw] of Object.entries(req.body)) {
    const segs = key.split('.');
    if (segs.length < 2) continue;
    let obj = c;
    for (let i = 0; i < segs.length - 1; i++) {
      if (typeof obj[segs[i]] !== 'object' || obj[segs[i]] === null) continue;
      obj = obj[segs[i]];
    }
    const last = segs[segs.length - 1];
    if (Array.isArray(obj[last])) {
      obj[last] = String(raw).split('\n').map(s => s.trim()).filter(Boolean);
    } else if (typeof obj[last] === 'string') {
      obj[last] = String(raw).trim();
    }
  }
  saveContent(c);
  res.redirect('/admin?saved=1');
});

/* Foto hochladen */
app.post('/admin/upload', requireAdmin, upload.single('foto'), (req, res) => {
  const gallery = req.body.gallery;
  const c = loadContent();
  if (req.file && c.galleries[gallery]) {
    c.galleries[gallery].push('/media/' + req.file.filename);
    saveContent(c);
  }
  res.redirect('/admin?saved=1#fotos');
});

/* Foto entfernen */
app.post('/admin/delete-image', requireAdmin, (req, res) => {
  const { gallery, src } = req.body;
  const c = loadContent();
  if (c.galleries[gallery]) {
    c.galleries[gallery] = c.galleries[gallery].filter(s => s !== src);
    saveContent(c);
    if (src.startsWith('/media/')) {
      const file = path.join(UPLOAD_DIR, path.basename(src));
      fs.existsSync(file) && fs.unlinkSync(file);
    }
  }
  res.redirect('/admin?saved=1#fotos');
});

/* Foto verschieben (Reihenfolge) */
app.post('/admin/move-image', requireAdmin, (req, res) => {
  const { gallery, src, dir } = req.body;
  const c = loadContent();
  const arr = c.galleries[gallery];
  if (arr) {
    const i = arr.indexOf(src);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < arr.length) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      saveContent(c);
    }
  }
  res.redirect('/admin?saved=1#fotos');
});

app.use((req, res) => {
  const c = loadContent();
  res.status(404).render('404', { c, page: '' });
});

app.listen(PORT, () => console.log(`Haus Felder Garfrescha läuft auf Port ${PORT}`));
