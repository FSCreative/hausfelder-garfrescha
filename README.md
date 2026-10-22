# Haus Felder Garfrescha – Website

Moderne Website für die Ferienwohnung **Haus Felder Garfrescha** (St. Gallenkirch, Montafon). Texte und Fotos bearbeitet die Inhaberin direkt auf der Seite im **FS Creative Websitebuilder** (`/website`), erreichbar per Single-Sign-On aus VALUERO Partner.

## Technik

- Node.js (≥ 20, ES-Module) + Express + EJS
- FS Creative Websitebuilder (`ez-websitebuilder`) – Editor unter `/website`
- Anfrage-Formular mit SMTP-Mailversand (nodemailer)
- Standardtexte liegen in `content/content.json`, alle Änderungen aus dem Editor in `DATA_DIR/builder.json`

## Websitebuilder

### Umgebungsvariablen (Railway → Variables)

| Variable | Wert / Beschreibung |
|---|---|
| `EZ_ZENTRALE_URL` | `https://partner.valuero.at` |
| `EZ_SITE_ID` | `haus-felder` |
| `EZ_SITE_KEY` | geheimer Site-Key aus VALUERO Partner → Admin → Websites |
| `DATA_DIR` | `/data` (Railway-Volume, existiert bereits) – hier liegen `builder.json`, die alte `content.json` und `uploads/` |
| `EDITOR_PASSWORT` | optional: zusätzliche Anmeldung mit Passwort unter `/login` (ohne VALUERO) |
| `SESSION_SECRET` | wie bisher, signiert auch das Editor-Cookie (`ezb`) |

Ohne `EZ_ZENTRALE_URL`/`EZ_SITE_ID`/`EZ_SITE_KEY` gibt es kein Single-Sign-On; dann geht es nur mit `EDITOR_PASSWORT`.

### Bearbeiten

- Aus dem VALUERO-Partner-Dashboard (Menü „Website“) springt die Inhaberin per Single-Sign-On (`/website?ezz=…`, 2 Minuten gültig) direkt in den Editor. Wird die Website in VALUERO gesperrt, ist der Editor nach spätestens 60 s gesperrt – die Website selbst bleibt online.
- Alternativ `/login` mit `EDITOR_PASSWORT`. Der Link „Admin“ in der Fußzeile führt zu `/website`.
- Bearbeitbar sind alle Seiten aus `site.config.json` (Start, Wohnung, Anreise, Sommer, Winter, Kontakt, Anfrage, Impressum): Überschriften, Texte, Listen, Knöpfe (Text + Link), Titel- und Galeriebilder. Telefon, E-Mail, Name der Gastgeberin und die Impressumsangaben gelten auf allen Seiten (`global.…`). Zusätzlich gehen die Builder-Bausteine (Text, Bild, Galerie, …) und das Ausblenden einzelner Elemente.
- Listen und Galerien: im Editor stehen am Ende zwei freie Plätze („+ weiterer Eintrag“ bzw. Platzhalterbild – Doppelklick zum Tauschen). Leere Einträge erscheinen auf der Website nicht.
- Nicht im Editor: Logo, Menü/Kopfzeile, Social-Media-Links, Datenschutzerklärung (Text in `views/datenschutz.ejs`), das Anfrageformular selbst.

### Technik der Einbindung

- `server.js`: `einfacheAnmeldung` (SSO + Passwort) und `mountBuilder(…, { seitenAusliefern: false })` – die Seiten rendert weiterhin EJS.
- `lib/inhalte.js`: Schlüssel (`data-ez`, `data-ez-img`, `data-ez-bg`), Hilfen für die Vorlagen (`ez.t`, `ez.bild`, `ez.liste`, `ez.galerie`, `ez.link`) und die einmalige Übernahme.
- Gäste bekommen die gespeicherten Werte direkt im HTML. Im Editor-Rahmen (`?edit=1`) wird bewusst nur der Standard gerendert; die Builder-Laufzeit legt die gespeicherten Werte selbst darüber (sonst gingen sie beim Speichern verloren).
- `.github/workflows/builder-aktualisieren.yml` hält den Builder automatisch aktuell (alle 30 Minuten neue Fassung in die `package-lock.json`, sobald auf `main`).

### Übernahme der bisherigen Inhalte (einmalig, automatisch)

Beim Start gilt:

1. Hat die Builder-Ablage noch **keine** Seiten und gibt es `DATA_DIR/content.json` (vom alten Admin), werden alle Werte, die vom Stand in `content/content.json` abweichen, in die Builder-Ablage übernommen (Texte escaped, gekürzte Listen/Galerien als leere Einträge, Fotos aus `/media/…` bleiben verlinkt).
2. Danach wird ein Merker `_migration` gespeichert – die Übernahme läuft nie wieder. Im Log steht z. B. `[migration] 3 geänderte Felder … übernommen`.
3. `DATA_DIR/content.json` und `DATA_DIR/uploads` bleiben unverändert liegen (Sicherung, Fotos werden weiter unter `/media` ausgeliefert).
4. Nach erfolgreicher Übernahme ist die Builder-Ablage die einzige Quelle für Änderungen; `/admin` leitet auf `/website` um (Änderungen im alten Admin würden sonst unbemerkt überdeckt).
5. Schlägt die Übernahme fehl (z. B. defekte `content.json`), bleibt alles wie bisher: Seiten zeigen Seed + `content.json`, der alte Admin unter `/admin` funktioniert weiter, im Log steht `[migration] … fehlgeschlagen`. Beim nächsten Start wird es erneut versucht.

## Weitere Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `PORT` | wird von Railway gesetzt (Produktion: 8080), lokal Standard 3000 |
| `SMTP_HOST` | z. B. `smtp.gmail.com` |
| `SMTP_PORT` | `587` (oder `465`) |
| `SMTP_USER` | SMTP-Benutzer / E-Mail-Adresse |
| `SMTP_PASS` | SMTP-Passwort (bei Gmail: App-Passwort) |
| `MAIL_TO` | Empfänger der Anfragen (Standard: E-Mail-Adresse der Website) |
| `ADMIN_PASSWORD` | nur noch für den alten Admin, falls die Übernahme fehlschlägt |

**Wichtig:** Ohne Railway-Volume (`DATA_DIR=/data` + Volume auf `/data` gemountet) gehen Änderungen bei jedem Deployment verloren.

## Bilder importieren

Die Original-Bilder der alten Wix-Website werden über den GitHub-Action-Workflow **„Bilder von Wix-Website importieren“** (Actions-Tab → Run workflow) in voller Auflösung nach `public/images` geladen und committet.

## Lokal starten

```bash
npm install
npm run fetch-images   # einmalig Bilder laden
EDITOR_PASSWORT=geheim DATA_DIR=./data npm start   # http://localhost:3000, Editor: /login → /website
```
