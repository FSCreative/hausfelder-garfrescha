/* Lädt Google Fonts (Fraunces + Outfit) herunter und hostet sie lokal (DSGVO).
   Erzeugt public/fonts/fonts.css und public/fonts/*.woff2 */
import { mkdir, writeFile } from 'fs/promises';

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Outfit:wght@300;400;500;600&display=swap';
// Chrome-UA, damit Google woff2 + variable Fonts liefert
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

await mkdir('public/fonts', { recursive: true });

const res = await fetch(CSS_URL, { headers: { 'User-Agent': UA } });
if (!res.ok) { console.error('CSS-Download fehlgeschlagen:', res.status); process.exit(1); }
let css = await res.text();

const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]))];
console.log(`${urls.length} Font-Dateien gefunden`);

for (const url of urls) {
  const name = url.split('/').slice(-2).join('-'); // eindeutiger Dateiname
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) { console.error(`FEHLER ${url}: ${r.status}`); process.exit(1); }
  await writeFile(`public/fonts/${name}`, Buffer.from(await r.arrayBuffer()));
  css = css.replaceAll(url, `/fonts/${name}`);
  console.log(`OK ${name}`);
}

await writeFile('public/fonts/fonts.css', css);
console.log('OK fonts.css');
