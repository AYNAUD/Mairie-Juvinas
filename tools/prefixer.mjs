/* =====================================================================
   Publication sous un sous-chemin (ex. GitHub Pages : /Mairie-Juvinas/).
   Le site est écrit avec des chemins absolus depuis la racine ("/demarches/…") :
   ce script réécrit, dans dist/, ceux qui pointent vers le site lui-même.

   Usage : BASE_PATH=/Mairie-Juvinas node tools/prefixer.mjs [--noindex]
   --noindex : site de test, à ne pas faire référencer (robots.txt + meta).
   Ne s'applique qu'à dist/, jamais à content/ : la source reste à la racine.
   ===================================================================== */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RACINE, 'dist');
const base = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const noindex = process.argv.includes('--noindex');
if (!base.startsWith('/')) { console.error('BASE_PATH doit commencer par « / ».'); process.exit(1); }

// Premiers segments de chemin qui appartiennent au site (dossiers et fichiers de dist/).
const segments = readdirSync(DIST).map((n) => n.replace(/\.[a-z]+$/, '')).filter(Boolean);
segments.push('documents');
const SEG = [...new Set(segments)].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

// Chemin absolu du site entre guillemets ou parenthèses : "/demarches/…", url("/img/…").
const chemin = new RegExp(`(["'(\`])/(?=(?:${SEG})(?:[/.#?"'\`)]|$))`, 'g');
// Accueil : href="/" et action="/".
const accueil = /((?:href|action|data-webcal|data-adresse)=")\/(?=")/g;

let fichiers = 0;
function parcourir(dossier) {
  for (const nom of readdirSync(dossier)) {
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) { parcourir(p); continue; }
    const ext = extname(p);
    if (!['.html', '.css', '.js', '.json'].includes(ext)) continue;
    let s = readFileSync(p, 'utf8');
    const avant = s;
    s = s.replace(chemin, `$1${base}/`);
    if (ext === '.html') {
      s = s.replace(accueil, `$1${base}/`);
      if (noindex && s.includes('</head>') && !s.includes('name="robots"')) {
        s = s.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>');
      }
    }
    if (s !== avant) { writeFileSync(p, s); fichiers++; }
  }
}
parcourir(DIST);

if (noindex) writeFileSync(join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`Préfixe ${base} appliqué à ${fichiers} fichier(s)${noindex ? ', site de test non référencé' : ''}.`);
