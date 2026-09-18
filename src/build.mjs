#!/usr/bin/env node
/**
 * Générateur statique du site de la mairie de Juvinas.
 * Fork du générateur de la mairie de Lecques (moteur commun, contenu propre
 * à chaque commune dans content/). Une seule dépendance (unpdf, voir
 * CLAUDE.md « Recherche dans les comptes-rendus ») : Node 18+ suffit sinon.
 * Lit content/, écrit dist/.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractText } from 'unpdf';

import * as V from './templates/views.mjs';
import { sprite } from './templates/icons.mjs';
import { frontMatter, texteBrut, echapper } from './markdown.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENU = join(RACINE, 'content');
const DIST = join(RACINE, 'dist');

const lireJson = (f) => JSON.parse(readFileSync(join(CONTENU, f), 'utf8'));

/* ------------------------------------------------------------- Chargement */

const site = lireJson('site.json');
const nav = lireJson('navigation.json');
const demarches = lireJson('demarches.json');
const synonymes = lireJson('synonymes.json');
const actualitesToutes = lireJson('actualites.json').sort((a, b) => (b.epingle ? 1 : 0) - (a.epingle ? 1 : 0) || b.date.localeCompare(a.date));
// "expiration" (voir CLAUDE.md : vaut dateFin à défaut de valeur explicite)
// fait disparaître une actualité des listings, de l'accueil, de la
// recherche et du plan du site à partir du lendemain de cette date —
// jamais de son propre permalien (voir plus bas, actualitesToutes), pour ne
// jamais casser un lien déjà partagé.
const aujourdhui = new Date().toISOString().slice(0, 10);
const actualites = actualitesToutes.filter((a) => !a.expiration || a.expiration >= aujourdhui);
const consultations = lireJson('consultations.json');
const elus = lireJson('elus.json');
const conseils = lireJson('conseils.json');
const budgets = lireJson('budgets.json');
const annuaire = lireJson('annuaire.json');
const documents = lireJson('documents.json');
const photos = existsSync(join(CONTENU, 'photos.json')) ? lireJson('photos.json') : {};
const entreprises = existsSync(join(CONTENU, 'entreprises.json'))
  ? lireJson('entreprises.json')
  : { misAJour: null, entreprises: [] };
const carteFond = existsSync(join(CONTENU, 'carte-fond.json'))
  ? lireJson('carte-fond.json')
  : null;

const pagesMd = readdirSync(join(CONTENU, 'pages'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { meta, corps } = frontMatter(readFileSync(join(CONTENU, 'pages', f), 'utf8'));
    const slug = basename(f, '.md');
    const url = meta.rubrique === 'legal' ? `/${slug}.html` : `/${meta.rubrique}/${slug}.html`;
    return { slug, url, meta, corps };
  })
  .sort((a, b) => (a.meta.ordre || 99) - (b.meta.ordre || 99));

const ctx = { site, nav, demarches, actualites, consultations, elus, conseils, budgets, annuaire, documents, pagesMd, photos, entreprises, carteFond };

/* ---------------------------------------------------------------- Écriture */

const pagesEcrites = [];

function ecrire(cheminUrl, html) {
  if (html.includes('<!--SPRITE-->')) html = html.replace('<!--SPRITE-->', sprite(html));
  const rel = cheminUrl.endsWith('/') ? `${cheminUrl}index.html` : cheminUrl;
  const abs = join(DIST, rel.replace(/^\//, ''));
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, html);
  pagesEcrites.push({ url: rel, octets: Buffer.byteLength(html) });
}

/* ----------------------------------------------------- Index de recherche */

const index = [];
const synDem = synonymes.demarches || {};
const synPages = synonymes.pages || {};

function normaliser(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function ajouterIndex(entree) {
  // Deux niveaux de mots, volontairement séparés :
  //  k — mots déclarés (titre, résumé, mots-clés) : signal fort ;
  //  b — mots du corps de texte : signal faible, pour la couverture seulement.
  // Sans cette séparation, un mot croisé au détour d'un paragraphe remonte au
  // même rang qu'un mot-clé choisi, et la recherche paraît farfelue.
  const forts = new Set();
  for (const source of [entree.titre, entree.resume, ...(entree.mots || [])]) {
    for (const mot of normaliser(source).split(' ')) if (mot.length > 2) forts.add(mot);
  }
  const faibles = new Set();
  for (const mot of normaliser((entree.corps || []).join(' ')).split(' ')) {
    if (mot.length > 3 && !forts.has(mot)) faibles.add(mot);
  }
  index.push({
    t: entree.titre,
    r: entree.resume,
    u: entree.url,
    c: entree.categorie,
    // Expressions complètes (synonymes) : servent au score « phrase exacte ».
    e: (entree.expressions || []).map(normaliser).filter(Boolean),
    k: [...forts],
    b: [...faibles],
    p: entree.poids || 1
  });
}

for (const d of demarches) {
  ajouterIndex({
    titre: d.titre,
    resume: d.resume,
    url: `/demarches/${d.id}.html`,
    categorie: (V.CATEGORIES[d.categorie] || {}).titre || 'Démarche',
    mots: [...(d.motsCles || []), d.titreCourt, (V.LIEUX[d.lieu] || {}).libelle],
    expressions: [d.titre, d.titreCourt, ...(synDem[d.id] || [])],
    poids: 3
  });
}

for (const p of pagesMd) {
  const rub = nav.find((n) => n.id === p.meta.rubrique);
  ajouterIndex({
    titre: p.meta.titre,
    resume: p.meta.description || '',
    url: p.url,
    categorie: rub ? rub.libelle : 'Informations',
    mots: p.meta.motsCles || [],
    corps: texteBrut(p.corps).split(' ').slice(0, 260),
    expressions: [p.meta.titre, ...(synPages[p.slug] || [])],
    poids: 1.5
  });
}

for (const a of actualites) {
  ajouterIndex({
    titre: a.titre, resume: a.chapeau || '', url: `/vie-locale/actualites/${a.id}.html`,
    categorie: 'Actualité', mots: [a.categorie], corps: texteBrut(a.corps || '').split(' ').slice(0, 140),
    expressions: [a.titre], poids: 1
  });
}

for (const c of consultations) {
  ajouterIndex({
    titre: c.question, resume: c.chapeau || '', url: `/vie-locale/consultations/${c.id}.html`,
    categorie: 'Consultation citoyenne', mots: [c.theme, ...c.options.map((o) => o.libelle)],
    corps: texteBrut(c.corps || '').split(' ').slice(0, 140),
    expressions: [c.question], poids: 1.5
  });
}

const pagesGenerees = [
  { titre: 'Toutes les démarches', resume: `La liste complète des démarches administratives à ${site.commune.nom}.`, url: '/demarches/', categorie: 'Mes démarches', mots: ['démarches', 'administratif', 'formalités'], poids: 2 },
  { titre: 'Contact et horaires de la mairie', resume: 'Adresse, téléphone, courriel et horaires du secrétariat.', url: '/mairie/contact.html', categorie: 'La mairie', mots: ['contact', 'horaires', 'téléphone', 'adresse', 'ouverture', 'secrétariat', 'joindre', 'écrire'], poids: 3 },
  { titre: 'Les élus', resume: 'Le maire, les adjoints et les conseillers municipaux.', url: '/mairie/elus.html', categorie: 'La mairie', mots: ['maire', 'élus', 'adjoints', 'conseil municipal'], poids: 2 },
  { titre: 'Commissions et représentations', resume: 'Commissions municipales et syndicats intercommunaux.', url: '/mairie/commissions.html', categorie: 'La mairie', mots: ['commissions', 'syndicats', 'représentation'], poids: 1 },
  { titre: 'Conseils municipaux', resume: 'Les procès-verbaux des séances du conseil municipal.', url: '/mairie/conseils-municipaux.html', categorie: 'La mairie', mots: ['conseil municipal', 'procès verbal', 'pv', 'délibération', 'séance', 'compte rendu'], poids: 2 },
  { titre: 'Actualités', resume: 'Toutes les actualités, les manifestations et les rendez-vous réguliers de la commune.', url: '/vie-locale/actualites.html', categorie: 'Vie locale', mots: ['actualités', 'news', 'informations', 'agenda', 'événement', 'manifestation', 'fête', 'calendrier'], poids: 1.5 },
  { titre: 'Consultations citoyennes', resume: `Les consultations citoyennes en cours et passées à ${site.commune.nom}.`, url: '/vie-locale/consultations.html', categorie: 'Vie locale', mots: ['consultation', 'sondage', 'avis', 'vote', 'participation citoyenne'], poids: 1.5 },
  { titre: 'Plan du site', resume: 'Toutes les pages du site.', url: '/plan-du-site.html', categorie: 'Informations', mots: ['plan du site', 'sommaire', 'arborescence'], poids: 0.5 },
  { titre: "S'abonner aux actualités", resume: 'Recevoir par courriel les actualités de la commune, avec désabonnement en un clic.', url: '/vie-locale/abonnement.html', categorie: 'Vie locale', mots: ['abonnement', 'newsletter', 'courriel', 'inscription', 'désabonnement', 'alerte email'], poids: 1.5 }
];
for (const p of pagesGenerees) ajouterIndex({ ...p, expressions: [p.titre, ...(p.expressions || [])] });

const indexRecherche = {
  entrees: index,
  reponses: (synonymes.reponsesRapides || []).map((r) => ({
    t: r.titre, x: r.reponse, u: r.url,
    q: r.questions.map(normaliser)
  }))
};

/* ------------------------------------------------------ Génération des pages */

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

ecrire('/', V.accueil(ctx));
ecrire('/demarches/', V.listeDemarches(ctx));
for (const d of demarches) ecrire(`/demarches/${d.id}.html`, V.ficheDemarche(ctx, d));
ecrire('/recherche.html', V.pageRecherche(ctx));
ecrire('/designs.html', V.pageDesigns(ctx));
ecrire('/404.html', V.page404(ctx));

for (const p of pagesMd) ecrire(p.url, V.pageMarkdown(ctx, p));

ecrire('/vie-locale/actualites.html', V.listeActualites(ctx));
for (const a of actualitesToutes) ecrire(`/vie-locale/actualites/${a.id}.html`, V.articleActualite(ctx, a));
ecrire('/vie-locale/consultations.html', V.listeConsultations(ctx));
for (const c of consultations) ecrire(`/vie-locale/consultations/${c.id}.html`, V.pageConsultation(ctx, c));
ecrire('/vie-locale/abonnement.html', V.pageAbonnement(ctx));

ecrire('/mairie/contact.html', V.pageContact(ctx));
ecrire('/mairie/elus.html', V.pageElus(ctx));
ecrire('/mairie/commissions.html', V.pageCommissions(ctx));
ecrire('/mairie/conseils-municipaux.html', V.pageConseils(ctx));

// Index de rubrique : reprend l'ordre déclaré dans navigation.json.
const resumesPages = Object.fromEntries(pagesMd.map((p) => [p.url, p.meta.description]));
const nbSeancesConseil = conseils.reduce((n, a) => n + a.seances.length, 0);
for (const rub of nav) {
  if (rub.id === 'demarches') continue;
  const entrees = rub.enfants.map((c) => {
    const entree = { ...c, resume: resumesPages[c.url] || '' };
    if (c.url === '/mairie/conseils-municipaux.html') {
      entree.compteur = nbSeancesConseil;
      entree.compteurTitre = `${nbSeancesConseil} séance${nbSeancesConseil > 1 ? 's' : ''} enregistrée${nbSeancesConseil > 1 ? 's' : ''}`;
    }
    return entree;
  });
  ecrire(rub.url, V.rubriqueIndex(ctx, rub, entrees));
}

/* --------------------------------------------------------- Plan et sitemap */

const groupesPlan = [
  { titre: 'Mes démarches', pages: [{ titre: 'Toutes les démarches', url: '/demarches/' }, ...demarches.map((d) => ({ titre: d.titre, url: `/demarches/${d.id}.html` }))] },
  ...nav.filter((n) => n.id !== 'demarches').map((n) => ({
    titre: n.libelle,
    pages: [{ titre: `${n.libelle} — sommaire`, url: n.url }, ...n.enfants.map((c) => ({ titre: c.libelle, url: c.url }))]
  })),
  { titre: 'Actualités', pages: actualites.map((a) => ({ titre: a.titre, url: `/vie-locale/actualites/${a.id}.html` })) },
  { titre: 'Consultations citoyennes', pages: consultations.map((c) => ({ titre: c.question, url: `/vie-locale/consultations/${c.id}.html` })) },
  { titre: 'Informations légales', pages: [
    { titre: 'Déclaration d\'accessibilité', url: '/accessibilite.html' },
    { titre: 'Mentions légales', url: '/mentions-legales.html' },
    { titre: 'Données personnelles et cookies', url: '/donnees-personnelles.html' },
    { titre: 'Rechercher', url: '/recherche.html' },
    { titre: 'Les trois identités visuelles', url: '/designs.html' }
  ] }
];
ecrire('/plan-du-site.html', V.planDuSite(ctx, groupesPlan));

const urls = [...new Set(pagesEcrites.map((p) => p.url))];
ecrire('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.filter((u) => u.endsWith('.html')).map((u) => `  <url><loc>${site.url}${u.replace(/index\.html$/, '')}</loc><lastmod>${aujourdhui}</lastmod></url>`).join('\n')}
</urlset>`);
ecrire('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);

/* ---------------------------------------------- Recherche dans les PV (conseils) */

// Normalisation "longueur conservée" — contrairement à normaliser() ci-dessus
// (qui compacte les espaces et convient à l'index de recherche générale), on
// garde ici un caractère pour un caractère avec texteBasePv : c'est ce qui
// permet de retrouver, dans le texte affichable, la même position qu'une
// correspondance trouvée dans le texte normalisé (voir recherche-pv.js).
function normaliserRecherchePv(texteBasePv) {
  return texteBasePv
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

// Seule dépendance du projet (voir CLAUDE.md, section « Recherche dans les
// comptes-rendus ») : unpdf extrait le texte des PDF de séance déposés
// localement (public/documents/, catégorie "conseils/<année>") pour
// alimenter la recherche de /mairie/conseils-municipaux.html. Régénéré à
// chaque build depuis les PDF déjà versionnés dans le dépôt : aucune étape
// manuelle, aucun risque d'oubli après un dépôt par email (voir
// worker/github.mjs, commitDepotDocument). Les séances dont le PDF n'est
// qu'un lien externe (historique antérieur à ce circuit) ne sont pas
// couvertes — hors de portée d'un site statique sans accès à ce fichier.
async function construireIndexPv(documentsParCategorie) {
  const index = [];
  for (const [categorie, docs] of Object.entries(documentsParCategorie || {})) {
    if (!categorie.startsWith('conseils/')) continue;
    for (const doc of docs) {
      if (!doc.date) continue;
      const chemin = join(RACINE, 'public/documents', doc.fichier);
      if (!existsSync(chemin)) continue;
      try {
        const octets = new Uint8Array(readFileSync(chemin));
        const { text } = await extractText(octets, { mergePages: true });
        const texteBasePv = String(text).replace(/\s+/g, ' ').trim().slice(0, 200000);
        if (!texteBasePv) continue;
        index.push({ date: doc.date, fichier: doc.fichier, texteBasePv, texteRecherchePv: normaliserRecherchePv(texteBasePv) });
      } catch (e) {
        console.error(`  ! Extraction du texte échouée pour ${doc.fichier} : ${e.message}`);
      }
    }
  }
  index.sort((a, b) => b.date.localeCompare(a.date));
  return index;
}

const indexPv = await construireIndexPv(documents);

/* ------------------------------------------------------------------ Assets */

writeFileSync(join(DIST, 'search-index.json'), JSON.stringify(indexRecherche));
writeFileSync(join(DIST, 'recherche-pv.json'), JSON.stringify(indexPv));

mkdirSync(join(DIST, 'assets'), { recursive: true });

const ordreCss = ['reset.css', 'tokens.css', 'theme-republique.css', 'theme-garrigue.css', 'theme-guichet.css', 'composants.css', 'pages.css', 'impression.css'];
const css = ordreCss
  .filter((f) => existsSync(join(RACINE, 'src/styles', f)))
  .map((f) => `/* ===== ${f} ===== */\n${readFileSync(join(RACINE, 'src/styles', f), 'utf8')}`)
  .join('\n');
writeFileSync(join(DIST, 'assets/site.css'), css);

const ordreJs = ['prefs.js', 'nav.js', 'recherche.js', 'horaires.js'];
const js = ordreJs
  .filter((f) => existsSync(join(RACINE, 'src/scripts', f)))
  .map((f) => `/* ===== ${f} ===== */\n${readFileSync(join(RACINE, 'src/scripts', f), 'utf8')}`)
  .join('\n');
writeFileSync(join(DIST, 'assets/site.js'), js);

// Chargé séparément, pas dans le bundle site.js : seule la page des conseils
// municipaux en a besoin, inutile d'en alourdir toutes les autres.
const recherchePv = join(RACINE, 'src/scripts/recherche-pv.js');
if (existsSync(recherchePv)) cpSync(recherchePv, join(DIST, 'assets/recherche-pv.js'));

// Chargé séparément, pas dans le bundle site.js : seule la page Transports
// en a besoin (voir V.pageMarkdown / widgetTransportLio).
const transportLio = join(RACINE, 'src/scripts/transport-lio.js');
if (existsSync(transportLio)) cpSync(transportLio, join(DIST, 'assets/transport-lio.js'));

// Chargé séparément, pas dans le bundle site.js : seules les pages de
// consultation ouvertes en ont besoin (voir V.pageConsultation), pour
// afficher le compteur de réponses en direct — une pure amélioration
// JavaScript, jamais requise pour voter (voir CLAUDE.md).
const consultationJs = join(RACINE, 'src/scripts/consultation.js');
if (existsSync(consultationJs)) cpSync(consultationJs, join(DIST, 'assets/consultation.js'));

const blason = join(RACINE, 'src/styles/blason.svg');
if (existsSync(blason)) cpSync(blason, join(DIST, 'assets/blason.svg'));

const pub = join(RACINE, 'public');
if (existsSync(pub)) {
  for (const entree of readdirSync(pub)) {
    const src = join(pub, entree);
    if (statSync(src).isDirectory() && readdirSync(src).length === 0) continue;
    cpSync(src, join(DIST, entree), { recursive: true });
  }
}

/* ------------------------------------------------------------------ Rapport */

const total = pagesEcrites.reduce((n, p) => n + p.octets, 0);
const plusLourde = pagesEcrites.slice().sort((a, b) => b.octets - a.octets)[0];
const ko = (n) => `${(n / 1024).toFixed(1)} ko`;

console.log(`\n  Site généré dans dist/`);
console.log(`  ${pagesEcrites.length} pages · ${demarches.length} démarches · ${index.length} entrées dans l'index de recherche · ${indexPv.length} PV indexé(s)`);
console.log(`  HTML total ${ko(total)} · page la plus lourde ${plusLourde.url} (${ko(plusLourde.octets)})`);
console.log(`  CSS ${ko(Buffer.byteLength(css))} · JS ${ko(Buffer.byteLength(js))} · index ${ko(Buffer.byteLength(JSON.stringify(indexRecherche)))}\n`);
