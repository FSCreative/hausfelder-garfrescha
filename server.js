/* Haus Felder Garfrescha – Express Server
   Inhalte bearbeitet die Inhaberin im FS Creative Websitebuilder (/website),
   erreichbar per Single-Sign-On aus VALUERO Partner (oder EDITOR_PASSWORT).
   Siehe README.md → „Websitebuilder“. */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { mountBuilder, ladeKonfiguration } from 'ez-websitebuilder';
import { einfacheAnmeldung } from 'ez-websitebuilder/anmeldung.js';
import { deepMerge, flach, migrieren, istMigriert, vorlagenHilfen } from './lib/inhalte.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1); /* Railway: https hinter dem Proxy (Secure-Cookie) */

/* ---------- Daten-Verzeichnis (Railway Volume) ---------- */
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
process.env.DATA_DIR = DATA_DIR; /* Builder-Ablage (builder.json) liegt ebenfalls hier */
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const SEED_FILE = path.join(__dirname, 'content', 'content.json');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CONTENT_FILE)) {
  fs.copyFileSync(SEED_FILE, CONTENT_FILE);
}

/* Seed-Inhalte mit gespeicherten Inhalten (alter Admin) zusammenführen –
   das sind die Standardwerte, über die der Websitebuilder seine Werte legt. */
function loadContent() {
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  try {
    return deepMerge(seed, JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8')));
  } catch (err) {
    console.error('content.json nicht lesbar – es gelten die Standardinhalte:', err.message);
    return seed;
  }
}
function saveContent(c) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(c, null, 2));
}

/* ---------- Websitebuilder: Ablage, einmalige Übernahme, Anmeldung ---------- */
/* Erst jetzt laden: die Ablage liest DATA_DIR beim Import (JSON-Datei DATA_DIR/builder.json,
   mit DATABASE_URL stattdessen Postgres). */
const store = await import('ez-websitebuilder/store.js');
await store.init();
let migriert = false;
try {
  await migrieren({ store, seedDatei: SEED_FILE, inhaltDatei: CONTENT_FILE });
  migriert = await istMigriert(store);
} catch (err) {
  console.error('[migration] Übernahme aus content.json fehlgeschlagen – alter Admin bleibt aktiv:', err.message);
}

const config = ladeKonfiguration(path.join(__dirname, 'site.config.json'));
/* Anmeldung: Single-Sign-On aus VALUERO Partner (EZ_ZENTRALE_URL, EZ_SITE_ID,
   EZ_SITE_KEY, Link mit ?ezz=…) und/oder EDITOR_PASSWORT unter /login. */
const anmeldung = einfacheAnmeldung({ config, name: config.name });

/* ---------- Admin-Auth (alter Admin, nur bis zur Übernahme) ---------- */
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

/* ---------- Uploads (alter Admin) ---------- */
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

/* Websitebuilder: SSO/Login, Editor (/website), APIs, /builder/… – die Seiten
   selbst rendert weiterhin EJS (seitenAusliefern: false). */
anmeldung.einbinden(app);
const builder = mountBuilder(app, {
  config,
  store,
  requireStaff: anmeldung.requireStaff,
  publicDir: path.join(__dirname, 'public'),
  seitenAusliefern: false
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(UPLOAD_DIR));

/* Daten für jede Seite: Standardinhalte (c) + Builder-Hilfen (ez).
   Nach der Übernahme ist die Builder-Ablage die einzige Quelle für Änderungen:
   Standard ist dann nur noch content/content.json aus dem Repository
   (DATA_DIR/content.json bleibt als Sicherung liegen, wird aber nicht mehr gelesen).
   Ohne Übernahme (Fehler) gilt wie bisher Seed + DATA_DIR/content.json. */
function standardInhalte() {
  return migriert ? JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) : loadContent();
}
async function seitenDaten(req, slug) {
  const c = standardInhalte();
  let felder = {};
  try { felder = await builder.felderFuer(slug); } catch (err) { console.error('Builder-Inhalte nicht lesbar:', err.message); }
  const ez = vorlagenHilfen({ standardWerte: flach(c), felder, edit: req.query.edit === '1' });
  ez.fassung = builder.fassung;
  return { c, ez };
}
const seite = (view, slug, extra = {}) => async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-cache');
    res.render(view, { ...(await seitenDaten(req, slug)), ...extra });
  } catch (err) { next(err); }
};

/* ---------- Seiten ---------- */
const pages = [
  { url: '/', view: 'home', slug: 'index' },
  { url: '/wohnung', view: 'wohnung', slug: 'wohnung' },
  { url: '/anreise', view: 'anreise', slug: 'anreise' },
  { url: '/sommer', view: 'sommer', slug: 'sommer' },
  { url: '/winter', view: 'winter', slug: 'winter' },
  { url: '/kontakt', view: 'kontakt', slug: 'kontakt' }
];

pages.forEach(p => app.get(p.url, seite(p.view, p.slug, { page: p.url, sent: null })));

// Alte Wix-URLs weiterleiten
app.get('/anreiseinfos', (req, res) => res.redirect(301, '/anreise'));
app.get('/links', (req, res) => res.redirect(301, '/sommer'));

// Rechtsseiten
app.get('/impressum', seite('impressum', 'impressum', { page: '/impressum' }));
app.get('/datenschutz', seite('datenschutz', 'datenschutz', { page: '/datenschutz' }));

app.get('/anfrage', seite('anfrage', 'anfrage', { page: '/anfrage', sent: null, error: null, form: {} }));

/* ---------- Anfrage per SMTP ---------- */
app.post('/anfrage', async (req, res, next) => {
  try {
    const daten = await seitenDaten(req, 'anfrage');
    const email = daten.ez.text('global.site.email');
    const f = req.body || {};
    if (f.website) return res.redirect('/anfrage'); // Honeypot

    const required = ['name', 'email', 'anreise', 'abreise', 'personen'];
    if (required.some(k => !f[k] || !String(f[k]).trim())) {
      return res.status(400).render('anfrage', { ...daten, page: '/anfrage', sent: false, error: 'Bitte alle Pflichtfelder ausfüllen.', form: f });
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
        to: process.env.MAIL_TO || email,
        replyTo: f.email,
        subject: `Anfrage ${f.anreise} – ${f.abreise} (${f.personen} Pers.) von ${f.name}`,
        text
      });
      res.render('anfrage', { ...daten, page: '/anfrage', sent: true, error: null, form: {} });
    } catch (err) {
      console.error('Mailversand fehlgeschlagen:', err.message);
      res.status(500).render('anfrage', {
        ...daten, page: '/anfrage', sent: false,
        error: 'Die Anfrage konnte leider nicht gesendet werden. Bitte kontaktiere uns direkt per E-Mail an ' + email,
        form: f
      });
    }
  } catch (err) { next(err); }
});

/* ---------- Alter Admin ----------
   Nach erfolgreicher Übernahme in den Websitebuilder führt /admin zum Editor
   (/website) – Änderungen im alten Admin würden sonst vom Builder überdeckt.
   Ist die Übernahme fehlgeschlagen, bleibt der alte Admin wie bisher nutzbar. */
app.use('/admin', (req, res, next) => {
  if (!migriert) return next();
  res.redirect(req.method === 'GET' ? 302 : 303, config.editor?.pfad || '/website');
});

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

app.use(async (req, res, next) => {
  try {
    res.status(404).render('404', { ...(await seitenDaten(req, '404')), page: '' });
  } catch (err) { next(err); }
});

app.listen(PORT, () => console.log(`Haus Felder Garfrescha läuft auf Port ${PORT}`));
