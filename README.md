# Haus Felder Garfrescha – Website

Moderne Website für die Ferienwohnung **Haus Felder Garfrescha** (St. Gallenkirch, Montafon) mit Admin-Bereich zum Bearbeiten von Texten und Fotos.

## Technik

- Node.js + Express + EJS
- Anfrage-Formular mit SMTP-Mailversand (nodemailer)
- Admin-Bereich unter `/admin` (Link in der Fußzeile)
- Texte liegen in `content/content.json`, Änderungen werden in `DATA_DIR` gespeichert
- Foto-Uploads landen in `DATA_DIR/uploads`

## Umgebungsvariablen (Railway → Variables)

| Variable | Beschreibung |
|---|---|
| `ADMIN_PASSWORD` | Passwort für den Admin-Bereich |
| `SESSION_SECRET` | Beliebiger langer Zufallswert (Cookie-Signierung) |
| `DATA_DIR` | Pfad zum Railway-Volume, z. B. `/data` (für dauerhafte Änderungen) |
| `SMTP_HOST` | z. B. `smtp.gmail.com` |
| `SMTP_PORT` | `587` (oder `465`) |
| `SMTP_USER` | SMTP-Benutzer / E-Mail-Adresse |
| `SMTP_PASS` | SMTP-Passwort (bei Gmail: App-Passwort) |
| `MAIL_TO` | Empfänger der Anfragen (Standard: hausfelder.garfrescha@gmail.com) |

**Wichtig:** Ohne Railway-Volume (`DATA_DIR=/data` + Volume auf `/data` gemountet) gehen Admin-Änderungen bei jedem Deployment verloren.

## Bilder importieren

Die Original-Bilder der alten Wix-Website werden über den GitHub-Action-Workflow **„Bilder von Wix-Website importieren“** (Actions-Tab → Run workflow) in voller Auflösung nach `public/images` geladen und committet.

## Lokal starten

```bash
npm install
npm run fetch-images   # einmalig Bilder laden
npm start              # http://localhost:3000
```
