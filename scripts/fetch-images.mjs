/* Lädt alle Bilder der alten Wix-Website in voller Auflösung nach public/images */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const OUT = 'public/images';
const BASE = 'https://static.wixstatic.com/media/';

const images = {
  'logo.png': 'd2f3ea_b77bcc47601b4f6b997a2bafe62f908d~mv2.png',
  'logo-kontakt.png': 'dc121b_50e87a251b0f4ca393c4305797bc6228~mv2.png',
  'wegweiser.png': 'd2f3ea_acc9d50cce464f289030fd387b7859a6~mv2.png',
  'home-huette-winter.jpg': 'dc121b_b5f5eacfd817468b8ff7b1e46138b61a~mv2.jpg',
  'home-familie.jpg': 'dc121b_3e1052d59351461d8388b67bde691cf1~mv2.jpg',
  'home-koffer.jpg': 'dc121b_79221348285940ac80e1ae51dc264a31~mv2.jpg',
  'wohnung-aussen.jpg': 'd2f3ea_cf86d10953de4b708c73fbe3445d1e12~mv2.jpg',
  'wohnung-01.jpg': 'dc121b_041f1ae8aa994d6fa2851f44f354eece~mv2.jpg',
  'wohnung-02.jpg': 'dc121b_ad0bee4563894e0692facb5faccf02df~mv2.jpg',
  'wohnung-03.jpg': 'dc121b_0edba39ca9d4485b97ed9ead622af161~mv2.jpg',
  'wohnung-04.jpg': 'dc121b_821ac3f06bec4a7ebcf30b903b076ac3~mv2.jpg',
  'wohnung-05.jpg': 'dc121b_a8610fd90fd74d188a812be6bf7a9f73~mv2.jpg',
  'wohnung-06.jpg': 'dc121b_da1cf767325040c297cb94b995e1a7a2~mv2.jpg',
  'wohnung-07.jpg': 'dc121b_1e66f8ba3c6e488799a58013db34f72b~mv2.jpg',
  'wohnung-08.jpg': 'dc121b_00e7e7a9ac01495bb14e92cbad2c2928~mv2.jpg',
  'wohnung-09.jpg': 'dc121b_ef101b0734814e47aafdb417f0719ece~mv2.jpeg',
  'wohnung-10.jpg': 'dc121b_6b48437a15d94344a1d17ea425882ede~mv2.jpg',
  'wohnung-11.jpg': 'dc121b_4f3c2a54f9674fa1919b249eb3a02fea~mv2.jpeg',
  'wohnung-12.jpg': 'dc121b_be165d5abec54d68a4fd458c884dc45b~mv2.jpeg',
  'wohnung-13.jpg': 'dc121b_ed7dd30d834244218b70b41f41658676~mv2.jpeg',
  'wohnung-14.jpg': 'dc121b_14e5392697cb47819937da27f0043b09~mv2.jpg',
  'wohnung-15.jpg': 'dc121b_909ca30c7b5340dab20e596748b835ca~mv2.jpg',
  'anreise-sommer.jpg': 'd2f3ea_b73507dcc505476991c9d8f7ccb01325~mv2.jpg',
  'anreise-winter.jpg': 'd2f3ea_3a073d007e684a43bcf5ea98ba54b8f6~mv2.jpg',
  'sommer-01.jpg': 'd2f3ea_694c73f49e7641c595cdf706f93027ca~mv2.jpeg',
  'sommer-02.jpg': 'dc121b_0b03247a9e374a5e9539cbb70a1f64f2~mv2.jpeg',
  'sommer-03.jpg': 'dc121b_e5f2bd02da934603904fe44fa5c08dd8~mv2.jpeg',
  'sommer-04.jpg': 'd2f3ea_b7c27caa5b1845b99a0ef6f81bfbe0b0~mv2.jpg',
  'winter-01.jpg': 'd2f3ea_01978b8f978d4aae91e9ccd2d2a0c268~mv2.jpeg',
  'winter-02.jpg': 'dc121b_4571918b250f45e680670a7661aca21d~mv2.jpeg',
  'winter-03.jpg': 'dc121b_7d2a3b44c31147339ed923a99f5c2ec7~mv2.jpeg',
  'winter-04.jpg': 'dc121b_7a8e2325a9334f46af5eb40daf1d4130~mv2.jpeg',
  'logo-montafon.jpg': 'dc121b_0369c9a1ae8d496d9825398bf7d1f964~mv2.jpg',
  'logo-booking.jpg': 'dc121b_ab445fad26d44f6b99f71af5246f7be8~mv2.jpg'
};

const files = {
  'public/files/agb.pdf': 'https://www.hausfelder-garfrescha.com/_files/ugd/dc121b_1763e107f33245468bebd9341d557091.pdf'
};

await mkdir(OUT, { recursive: true });
await mkdir('public/files', { recursive: true });

let failed = 0;
for (const [name, id] of Object.entries(images)) {
  const url = BASE + id; // ohne Transformations-Pfad = Originalauflösung
  const res = await fetch(url);
  if (!res.ok) { console.error(`FEHLER ${name}: ${res.status}`); failed++; continue; }
  await writeFile(path.join(OUT, name), Buffer.from(await res.arrayBuffer()));
  console.log(`OK ${name}`);
}
for (const [dest, url] of Object.entries(files)) {
  const res = await fetch(url);
  if (!res.ok) { console.error(`FEHLER ${dest}: ${res.status}`); failed++; continue; }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`OK ${dest}`);
}
if (failed > 0) process.exit(1);
