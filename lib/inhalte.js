/* ====== Haus Felder Garfrescha – Inhalte für den FS Creative Websitebuilder ============
   Verbindet die bisherigen Inhalte (content/content.json + DATA_DIR/content.json)
   mit dem Websitebuilder (ez-websitebuilder):

   - Schlüssel: Jeder Text/jedes Bild hat einen festen Schlüssel, der in den
     EJS-Vorlagen als data-ez / data-ez-img / data-ez-bg steht. Er leitet sich
     aus dem Pfad in content.json ab:
        home.introText                 -> "home.introText"            (Seite "index")
        wohnung.ausstattung[2]         -> "wohnung.ausstattung.3"     (Seite "wohnung")
        galleries.sommer[0]            -> "bild.galerie.sommer.1"     (Seite "sommer")
        site.phone / rechtliches.* / kontakt.name
                                       -> "global.site.phone" …       (alle Seiten)
   - Standardwerte: content/content.json, darüber DATA_DIR/content.json (genau
     das, was die Seite bisher gezeigt hat). Darüber liegen die im Builder
     gespeicherten Werte. Standardwerte sind reiner Text und werden escaped,
     Builder-Werte sind bereits bereinigtes HTML (sanitizeRichHtml im Builder).
   - Einmalige Übernahme (migrieren): Hat die Builder-Ablage noch keine Seiten
     und gibt es DATA_DIR/content.json, werden alle Werte, die vom Auslieferungs-
     stand (content/content.json) abweichen, in die Builder-Ablage übernommen.
     Danach wird ein Merker "_migration" gespeichert; die Übernahme läuft nie
     wieder. content.json bleibt unverändert liegen.                          */
import fs from 'node:fs';

/* ---------- Hilfen ---------- */
export const escText = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const nurText = (html) => String(html ?? '')
  .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const istLeer = (v) => nurText(v) === '';
/* Platzhalter für leere Bildplätze im Editor */
export const PLATZHALTER = '/images/platzhalter.svg';

/* Felder, die auf allen Seiten gelten (Kopf/Fuß, Kontakt, Rechtliches). */
const GLOBALE_BEREICHE = new Set(['site', 'rechtliches']);
const GLOBALE_FELDER = new Set(['kontakt.name']);

/* Pfad in content.json -> Schlüssel im Builder */
export function schluesselFuer(bereich, feld, index) {
  if (bereich === 'galleries') return `bild.galerie.${feld}.${index + 1}`;
  const basis = `${bereich}.${feld}`;
  const k = (GLOBALE_BEREICHE.has(bereich) || GLOBALE_FELDER.has(basis)) ? 'global.' + basis : basis;
  return index === undefined ? k : `${k}.${index + 1}`;
}

/* Zu welcher Builder-Seite gehört ein Schlüssel? */
export function seiteFuer(k) {
  if (k.startsWith('global.')) return '_global';
  const g = /^bild\.galerie\.([a-z0-9-]+)\./.exec(k);
  if (g) return g[1];
  const bereich = k.replace(/^bild\./, '').split('.')[0];
  return bereich === 'home' ? 'index' : bereich;
}

/* content.json -> flache Liste { schluessel: Text } (Listen mit Index ab 1) */
export function flach(inhalt) {
  const out = {};
  for (const [bereich, felder] of Object.entries(inhalt || {})) {
    if (!felder || typeof felder !== 'object') continue;
    for (const [feld, wert] of Object.entries(felder)) {
      if (Array.isArray(wert)) wert.forEach((v, i) => { out[schluesselFuer(bereich, feld, i)] = String(v ?? ''); });
      else if (typeof wert === 'string') out[schluesselFuer(bereich, feld)] = wert;
    }
  }
  return out;
}
/* Wie viele Einträge hat eine Liste (für die Übernahme gekürzter Listen)? */
function listenLaengen(inhalt) {
  const out = {};
  for (const [bereich, felder] of Object.entries(inhalt || {})) {
    for (const [feld, wert] of Object.entries(felder || {})) {
      if (Array.isArray(wert)) out[bereich === 'galleries' ? `bild.galerie.${feld}` : schluesselFuer(bereich, feld)] = wert.length;
    }
  }
  return out;
}

/* Wie bisher in server.js: Seed mit gespeicherten Inhalten zusammenführen. */
export function deepMerge(base, override) {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (typeof base !== 'object' || base === null) return override !== undefined ? override : base;
  const out = {};
  for (const k of Object.keys(base)) out[k] = override && k in override ? deepMerge(base[k], override[k]) : base[k];
  if (override) for (const k of Object.keys(override)) if (!(k in base)) out[k] = override[k];
  return out;
}

/* ---------- Einmalige Übernahme der bisherigen Inhalte ---------- */
export async function migrieren({ store, seedDatei, inhaltDatei, log = console.log }) {
  const vorhanden = await store.listPages();
  if (vorhanden.some((p) => p.slug === '_migration')) return { status: 'erledigt' };
  if (vorhanden.length) {
    log('[migration] Builder-Ablage hat bereits Seiten – keine Übernahme aus content.json.');
    return { status: 'uebersprungen' };
  }
  if (!fs.existsSync(inhaltDatei)) {
    await store.savePage('_migration', { zeit: new Date().toISOString(), quelle: 'keine', anzahl: '0' });
    return { status: 'keine-datei' };
  }
  const seed = JSON.parse(fs.readFileSync(seedDatei, 'utf8'));
  const alt = JSON.parse(fs.readFileSync(inhaltDatei, 'utf8')); /* Fehler -> Aufrufer, kein Merker */
  const bisher = deepMerge(seed, alt);         /* genau das, was die Seite bisher zeigte */
  const standard = flach(seed);
  const neu = flach(bisher);

  const jeSeite = {};
  const setzen = (k, v) => { (jeSeite[seiteFuer(k)] ||= {})[k] = v; };
  for (const [k, v] of Object.entries(neu)) {
    if (standard[k] !== v) setzen(k, k.startsWith('bild.') ? v : escText(v));
  }
  /* Gekürzte Listen/Galerien: die weggefallenen Einträge leer setzen. */
  const laengeAlt = listenLaengen(seed), laengeNeu = listenLaengen(bisher);
  for (const [basis, n] of Object.entries(laengeAlt)) {
    for (let i = (laengeNeu[basis] ?? n); i < n; i++) setzen(`${basis}.${i + 1}`, '');
  }

  let anzahl = 0;
  for (const [slug, felder] of Object.entries(jeSeite)) {
    await store.savePage(slug, felder);
    anzahl += Object.keys(felder).length;
  }
  await store.savePage('_migration', {
    zeit: new Date().toISOString(), quelle: 'DATA_DIR/content.json', anzahl: String(anzahl),
    seiten: Object.keys(jeSeite).join(',')
  });
  log(`[migration] ${anzahl} geänderte Felder aus content.json in den Websitebuilder übernommen (${Object.keys(jeSeite).join(', ') || 'keine Abweichungen'}).`);
  return { status: 'uebernommen', anzahl };
}

export async function istMigriert(store) {
  try { return (await store.listPages()).some((p) => p.slug === '_migration'); } catch { return false; }
}

/* ---------- Hilfen für die EJS-Vorlagen ----------
   standardWerte: flach(loadContent()) – reiner Text
   felder:        Builder-Werte dieser Seite (eigene + global.*) – HTML
   edit:          Seite läuft im Editor-Rahmen (?edit=1)

   WICHTIG: Im Editor-Rahmen wird nur der Standard gerendert. Die Laufzeit des
   Builders hält das ausgelieferte HTML als „Standard“ fest, legt die
   gespeicherten Werte selbst darüber und speichert nur, was vom Standard
   abweicht. Stünden die gespeicherten Werte schon im HTML, gälten sie als
   unverändert und gingen beim nächsten Speichern verloren. Gäste bekommen
   die gespeicherten Werte dagegen gleich im HTML (kein Aufblitzen, SEO). */
export function vorlagenHilfen({ standardWerte, felder, edit, extraPlaetze = 2 }) {
  const anzeige = edit ? {} : felder;
  const hat = (k) => typeof anzeige[k] === 'string';
  const versteckt = (k) => felder['versteckt.' + k] === '1';
  /* Text als HTML: Builder-Wert oder escapter Standard (oder HTML-Vorgabe aus der Vorlage) */
  const t = (k, vorgabeHtml) => (hat(k) ? anzeige[k] : (k in standardWerte ? escText(standardWerte[k]) : (vorgabeHtml ?? '')));
  const text = (k, vorgabeHtml) => nurText(t(k, vorgabeHtml));
  const bild = (k, vorgabe) => {
    const v = hat(k) && anzeige[k] ? anzeige[k] : (standardWerte[k] || vorgabe || '');
    return v || (edit ? PLATZHALTER : '');
  };
  /* Link eines Knopfes (im Editor änderbar, gespeichert als link.<schluessel>) */
  const link = (k, vorgabe) => {
    const v = String(anzeige['link.' + k] || '').trim();
    return /^(\/|#|https?:\/\/|mailto:|tel:)/i.test(v) ? v : vorgabe;
  };
  /* Höchster Index einer Liste in Standard und Builder */
  const anzahl = (basis) => {
    let n = 0;
    const re = new RegExp('^' + basis.replace(/\./g, '\\.') + '\\.(\\d+)$');
    for (const k of [...Object.keys(standardWerte), ...Object.keys(felder)]) {
      const m = re.exec(k); if (m) n = Math.max(n, Number(m[1]));
    }
    return n;
  };
  /* Listeneinträge: leere/ausgeblendete fehlen für Gäste; im Editor gibt es
     alle plus freie Plätze zum Ergänzen. */
  const liste = (basis) => {
    const n = anzahl(basis) + (edit ? extraPlaetze : 0);
    const out = [];
    for (let i = 1; i <= n; i++) {
      const k = `${basis}.${i}`;
      const html = t(k, '');
      const leer = istLeer(html);
      if (!edit && (leer || versteckt(k))) continue;
      out.push({ k, html, leer });
    }
    return out;
  };
  const galerie = (name) => {
    const basis = `bild.galerie.${name}`;
    const n = anzahl(basis) + (edit ? extraPlaetze : 0);
    const out = [];
    for (let i = 1; i <= n; i++) {
      const k = `${basis}.${i}`;
      const v = hat(k) ? anzeige[k] : (standardWerte[k] || '');
      const leer = !v || v === PLATZHALTER;
      if (!edit && (leer || versteckt(k))) continue;
      /* leer = Platzhalter (im Editor blass) – außer die Laufzeit setzt gleich ein gespeichertes Bild ein */
      const gespeichert = edit && felder[k] && felder[k] !== PLATZHALTER;
      out.push({ k, src: leer ? PLATZHALTER : v, leer: leer && !gespeichert, nr: out.length + 1 });
    }
    return out;
  };
  /* Für Gäste: alle Builder-Werte vorab in die Seite (spart die Abfrage) */
  const datenJson = edit ? '' : JSON.stringify(felder).replace(/</g, '\\u003c');
  return { t, text, bild, link, liste, galerie, edit, datenJson };
}
