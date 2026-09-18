/* =====================================================================
   Contrôles avant publication :
   1. contrastes de couleur (WCAG AA) sur les trois thèmes ;
   2. cohérence des variables entre thèmes ;
   3. liens internes morts dans dist/ ;
   4. contrôles d'accessibilité structurels sur le HTML généré.
   ===================================================================== */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const STYLES = join(RACINE, 'src/styles');
const DIST = join(RACINE, 'dist');

let erreurs = 0, avertissements = 0;
const ko = (m) => { console.log(`  ✗ ${m}`); erreurs++; };
const attention = (m) => { console.log(`  ! ${m}`); avertissements++; };
const ok = (m) => console.log(`  ✓ ${m}`);

/* ------------------------------------------------------- Couleurs et contraste */

function versRvb(couleur) {
  const c = couleur.trim();
  const court = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (court) return court.slice(1).map((x) => parseInt(x + x, 16));
  const long = c.match(/^#([0-9a-f]{6})$/i);
  if (long) return [0, 2, 4].map((i) => parseInt(long[1].slice(i, i + 2), 16));
  return null;
}

function luminance([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contraste(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Extrait les variables d'un bloc de sélecteur donné.
function variables(css, selecteur) {
  const i = css.indexOf(selecteur);
  if (i === -1) return null;
  const debut = css.indexOf('{', i), fin = css.indexOf('}', debut);
  const vars = {};
  for (const m of css.slice(debut, fin).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

// Paires « texte sur fond » réellement utilisées par les composants.
const PAIRES = [
  ['texte', 'fond', 4.5, 'texte courant'],
  ['texte', 'fond-alt', 4.5, 'texte sur fond secondaire'],
  ['texte', 'fond-carte', 4.5, 'texte dans une carte'],
  ['texte', 'fond-accentue', 4.5, 'texte sur fond accentué'],
  ['texte-doux', 'fond', 4.5, 'texte secondaire'],
  ['texte-doux', 'fond-alt', 4.5, 'texte secondaire sur fond secondaire'],
  ['texte-doux', 'fond-carte', 4.5, 'texte secondaire dans une carte'],
  ['texte-tres-doux', 'fond', 4.5, 'texte tertiaire'],
  ['lien', 'fond', 4.5, 'lien'],
  ['lien', 'fond-carte', 4.5, 'lien dans une carte'],
  ['lien', 'fond-alt', 4.5, 'lien sur fond secondaire'],
  ['accent-texte', 'accent', 4.5, 'texte du bouton principal'],
  ['accent-doux-texte', 'accent-doux', 4.5, 'texte des pastilles de suggestion'],
  ['texte-inverse', 'fond-inverse', 4.5, 'texte inversé'],
  ['accent', 'fond', 3, 'bordure et repère d’accent'],
  ['accent', 'fond-carte', 3, 'accent dans une carte'],
  ['bordure-forte', 'fond', 3, 'bordure de champ de saisie'],
  ['bordure-forte', 'fond-carte', 3, 'bordure de bouton secondaire'],
  ['focus', 'fond', 3, 'indicateur de focus'],
  ['focus', 'fond-alt', 3, 'focus sur fond secondaire'],
  ['danger', 'fond-carte', 4.5, 'numéro d’urgence'],
  ['danger', 'danger-fond', 4.5, 'message d’erreur'],
  ['succes', 'fond-carte', 4.5, 'badge « en mairie »'],
  ['info', 'fond-carte', 4.5, 'badge « en ligne »'],
  ['attention', 'fond-carte', 4.5, 'badge « hors de Lecques »'],
  ['attention', 'attention-fond', 4.5, 'bandeau d’alerte'],
  ['info', 'info-fond', 4.5, 'réponse rapide de la recherche']
];

const THEMES = ['republique', 'garrigue', 'guichet'];
console.log('\nContrastes de couleur (WCAG AA)');

const jeux = {};
for (const theme of THEMES) {
  const css = readFileSync(join(STYLES, `theme-${theme}.css`), 'utf8');
  const base = variables(css, `[data-theme="${theme}"] {`);
  if (!base) { ko(`thème ${theme} : bloc de variables introuvable`); continue; }
  jeux[theme] = base;

  const sombre = variables(css, `[data-theme="${theme}"]:not([data-clair])`);
  const contrasteFort = variables(css, `[data-theme="${theme}"][data-contraste="1"]`);

  for (const [nom, vars] of [['clair', base], ['sombre', sombre && { ...base, ...sombre }], ['contraste renforcé', contrasteFort && { ...base, ...contrasteFort }]]) {
    if (!vars) continue;
    let echecs = 0;
    for (const [avant, arriere, seuil, description] of PAIRES) {
      const a = versRvb(vars[avant] || ''), b = versRvb(vars[arriere] || '');
      if (!a || !b) { attention(`${theme}/${nom} : variable manquante (--${avant} ou --${arriere})`); continue; }
      const r = contraste(a, b);
      if (r < seuil) { ko(`${theme}/${nom} — ${description} : ${r.toFixed(2)}:1 (minimum ${seuil}:1) — --${avant} sur --${arriere}`); echecs++; }
    }
    if (!echecs) ok(`${theme} · ${nom} — ${PAIRES.length} paires conformes`);
  }
}

console.log('\nCohérence des variables entre thèmes');
const reference = Object.keys(jeux.republique || {});
for (const theme of THEMES.slice(1)) {
  const manquantes = reference.filter((v) => !(v in (jeux[theme] || {})));
  if (manquantes.length) ko(`thème ${theme} : variables manquantes — ${manquantes.join(', ')}`);
  else ok(`thème ${theme} — ${reference.length} variables définies`);
}

/* ------------------------------------------------------------- Liens internes */

console.log('\nLiens internes');
function fichiersHtml(dossier) {
  const sortie = [];
  for (const entree of readdirSync(dossier)) {
    const p = join(dossier, entree);
    if (statSync(p).isDirectory()) sortie.push(...fichiersHtml(p));
    else if (entree.endsWith('.html')) sortie.push(p);
  }
  return sortie;
}

if (!existsSync(DIST)) {
  ko('dist/ est absent — lancez d’abord « npm run build »');
} else {
  const pages = fichiersHtml(DIST);
  const morts = new Map();
  let total = 0;

  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      const url = m[1];
      total++;
      const cible = url.endsWith('/') ? join(DIST, url, 'index.html') : join(DIST, url);
      if (!existsSync(cible)) {
        const liste = morts.get(url) || [];
        liste.push(page.replace(DIST, ''));
        morts.set(url, liste);
      }
    }
  }
  if (morts.size) {
    for (const [url, sources] of morts) ko(`lien mort ${url} — cité par ${sources.length} page(s), dont ${sources[0]}`);
  } else ok(`${total} liens internes vérifiés sur ${pages.length} pages, aucun mort`);

  /* --------------------------------------------------------- Structure et a11y */

  console.log('\nStructure des pages');
  let sansH1 = 0, h1Multiples = 0, sansLang = 0, sansTitre = 0, imagesSansAlt = 0, sautsDeNiveau = 0;
  let plusLourde = { page: '', octets: 0 };

  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const rel = page.replace(DIST, '');
    const octets = Buffer.byteLength(html);
    if (octets > plusLourde.octets) plusLourde = { page: rel, octets };

    const h1 = [...html.matchAll(/<h1[\s>]/g)].length;
    if (h1 === 0) { sansH1++; ko(`${rel} : aucun <h1>`); }
    if (h1 > 1) { h1Multiples++; ko(`${rel} : ${h1} éléments <h1>`); }
    if (!/<html[^>]*lang="fr"/.test(html)) { sansLang++; ko(`${rel} : attribut lang manquant`); }
    if (!/<title>[^<]{5,}</.test(html)) { sansTitre++; ko(`${rel} : titre de page absent ou trop court`); }

    for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) { imagesSansAlt++; ko(`${rel} : image sans attribut alt`); }

    const niveaux = [...html.matchAll(/<h([1-4])[\s>]/g)].map((m) => Number(m[1]));
    for (let i = 1; i < niveaux.length; i++) {
      if (niveaux[i] - niveaux[i - 1] > 1) { sautsDeNiveau++; attention(`${rel} : saut de niveau de titre h${niveaux[i - 1]} → h${niveaux[i]}`); break; }
    }
  }
  if (!sansH1 && !h1Multiples) ok(`${pages.length} pages : un <h1> unique par page`);
  if (!sansLang) ok('toutes les pages déclarent lang="fr"');
  if (!sansTitre) ok('toutes les pages ont un titre');
  if (!imagesSansAlt) ok('toutes les images ont une alternative textuelle');
  if (!sautsDeNiveau) ok('aucun saut de niveau dans la hiérarchie des titres');

  console.log('\nPoids');
  const css = Buffer.byteLength(readFileSync(join(DIST, 'assets/site.css')));
  const js = Buffer.byteLength(readFileSync(join(DIST, 'assets/site.js')));
  const kio = (n) => `${(n / 1024).toFixed(1)} ko`;
  const total2 = plusLourde.octets + css + js;
  console.log(`  page la plus lourde : ${plusLourde.page} — ${kio(plusLourde.octets)}`);
  console.log(`  + CSS ${kio(css)} + JS ${kio(js)} = ${kio(total2)} au premier chargement`);
  if (total2 > 250 * 1024) attention(`budget de 250 ko dépassé (${kio(total2)})`);
  else ok(`budget respecté : ${kio(total2)} < 250 ko`);

  const externes = new Set();
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    for (const m of html.matchAll(/(?:src|href)="(https?:\/\/[^"/]+)/g)) {
      if (/<link[^>]*stylesheet|<script[^>]*src/.test(html.slice(Math.max(0, m.index - 120), m.index))) externes.add(m[1]);
    }
  }
  if (externes.size) ko(`ressources chargées depuis un tiers : ${[...externes].join(', ')}`);
  else ok('aucune ressource chargée depuis un service tiers');
}

console.log(`\n${erreurs} erreur(s), ${avertissements} avertissement(s)\n`);
process.exit(erreurs ? 1 : 0);
