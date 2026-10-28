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
import { definirAnnonces } from './templates/layout.mjs';
import { sprite } from './templates/icons.mjs';
import { frontMatter, texteBrut, echapper } from './markdown.mjs';
import { calendrier, evenementsReguliers, evenementActualite } from './calendrier.mjs';
import { extension } from './formats-documents.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENU = join(RACINE, 'content');
const DIST = join(RACINE, 'dist');

const lireJson = (f) => JSON.parse(readFileSync(join(CONTENU, f), 'utf8'));

// Poids d'un fichier de public/documents/, annoncé à côté de son lien avec
// son format (RGAA : un fichier à ouvrir dit ce qu'il est et ce qu'il pèse).
// Absent, le lien n'annonce que le format.
const octetsDocument = (fichier) => {
  const chemin = join(RACINE, 'public/documents', fichier);
  return existsSync(chemin) ? statSync(chemin).size : undefined;
};

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
// Poids des documents joints aux actualités.
for (const a of actualitesToutes) {
  for (const l of a.liens || []) {
    if (l.type !== 'document' || typeof l.url !== 'string' || !l.url.startsWith('/documents/')) continue;
    l.octets = octetsDocument(decodeURIComponent(l.url.slice('/documents/'.length)));
  }
}
const consultations = lireJson('consultations.json');
const elus = lireJson('elus.json');
const conseils = lireJson('conseils.json');
const budgets = lireJson('budgets.json');
const annuaire = lireJson('annuaire.json');
const documents = lireJson('documents.json');
// Poids des documents du registre (conseils, bibliothèque, budgets, élus,
// bulletins, commissions, pages) et des fiches démarche ; ceux du
// front-matter des pages Markdown sont posés plus bas, avec les pages.
for (const d of [...Object.values(documents).flat(), ...demarches.flatMap((x) => x.documents || [])]) {
  d.octets = octetsDocument(d.fichier);
}
const photos = existsSync(join(CONTENU, 'photos.json')) ? lireJson('photos.json') : {};
const entreprises = existsSync(join(CONTENU, 'entreprises.json'))
  ? lireJson('entreprises.json')
  : { misAJour: null, entreprises: [] };
const carteFond = existsSync(join(CONTENU, 'carte-fond.json'))
  ? lireJson('carte-fond.json')
  : null;
// Produits chaque semaine par .github/workflows/donnees-publiques.yml
// (tools/fetch-defibrillateurs.mjs, tools/fetch-finances.mjs) : absents,
// les blocs correspondants ne s'affichent simplement pas.
const defibrillateurs = existsSync(join(CONTENU, 'defibrillateurs.json')) ? lireJson('defibrillateurs.json') : null;
const finances = existsSync(join(CONTENU, 'finances.json')) ? lireJson('finances.json') : null;
// Plan de zonage du PLU (tools/fetch-zonage.mjs, même workflow hebdomadaire) :
// absent, la page Urbanisme garde simplement son texte et ses liens.
const zonage = existsSync(join(CONTENU, 'zonage-plu.json')) ? lireJson('zonage-plu.json') : null;
// Sites à découvrir autour de la commune (saisis à la main) et fond de leur
// carte, temps de trajet compris (tools/fetch-carte-tourisme.mjs, relancé à
// la main) : sans le fond, la page Tourisme garde la liste des sites.
const tourismeSites = existsSync(join(CONTENU, 'tourisme-sites.json')) ? lireJson('tourisme-sites.json') : null;
const carteTourisme = existsSync(join(CONTENU, 'carte-tourisme.json')) ? lireJson('carte-tourisme.json') : null;
const categoriesActualites = lireJson('categories-actualites.json');

const pagesMd = readdirSync(join(CONTENU, 'pages'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { meta, corps } = frontMatter(readFileSync(join(CONTENU, 'pages', f), 'utf8'));
    meta.documents = V.normaliserDocuments(meta.documents)
      .map((d) => ({ ...d, octets: octetsDocument(d.fichier) }));
    const slug = basename(f, '.md');
    const url = meta.rubrique === 'legal' ? `/${slug}.html` : `/${meta.rubrique}/${slug}.html`;
    return { slug, url, meta, corps };
  })
  .sort((a, b) => (a.meta.ordre || 99) - (b.meta.ordre || 99));

const ctx = { site, nav, demarches, actualites, consultations, elus, conseils, budgets, annuaire, documents, pagesMd, photos, entreprises, carteFond, defibrillateurs, finances, zonage, tourismeSites, carteTourisme, categoriesActualites,
  // Documents liés depuis les pages, inscrits par les gabarits (voir plus bas).
  documentsLies: new Map() };

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
  { titre: 'Budgets et comptes', resume: `Les comptes de la commune de ${site.commune.nom} en clair et les documents budgétaires.`, url: '/mairie/budgets.html', categorie: 'La mairie', mots: ['budget', 'finances', 'comptes', 'impôts', 'taxe foncière', 'investissement', 'dépenses', 'recettes', 'ofgl'], poids: 1.5 },
  { titre: `Les associations de ${site.commune.nom}`, resume: `Les associations de ${site.commune.nom}.`, url: '/vie-locale/associations.html', categorie: 'Vie locale', mots: ['associations', 'club', 'bénévole', 'les gens de juvinas'], poids: 2 },
  { titre: 'Acteurs économiques', resume: `Les professionnels installés à ${site.commune.nom}.`, url: '/vie-locale/professionnels.html', categorie: 'Vie locale', mots: ['commerce', 'artisan', 'professionnel', 'entreprise', 'auto-entrepreneur', 'association', 'sirene'], expressions: ['où manger', 'restaurant', `commerçants de ${site.commune.nom.toLowerCase()}`], poids: 1.5 },
  { titre: 'Cartographie des acteurs économiques', resume: `Carte de localisation des commerces, artisans et associations de ${site.commune.nom}.`, url: '/vie-locale/carte-acteurs-economiques.html', categorie: 'Vie locale', mots: ['carte', 'cartographie', 'localisation', 'plan', 'où sont les commerces'], poids: 1 },
  { titre: 'Petite enfance', resume: `Relais petite enfance, assistantes maternelles et crèches pour les familles de ${site.commune.nom}.`, url: '/enfance-jeunesse/petite-enfance.html', categorie: 'Enfance & jeunesse', mots: ['crèche', 'nounou', 'assistante maternelle', 'garde', 'relais petite enfance', 'piape'], poids: 2 },
  { titre: 'Collèges et lycées', resume: `Les collèges et lycées les plus proches de ${site.commune.nom}.`, url: '/enfance-jeunesse/colleges-lycees.html', categorie: 'Enfance & jeunesse', mots: ['collège', 'lycée', 'aubenas', 'vals-les-bains', 'montpezat', 'secondaire'], poids: 1.5 },
  { titre: 'Centres de loisirs', resume: 'Accueils de loisirs itinérants, stages multisports et service jeunesse de la Communauté de communes.', url: '/enfance-jeunesse/loisirs.html', categorie: 'Enfance & jeunesse', mots: ['centre de loisirs', 'mercredi', 'vacances', 'stage', 'multisports', 'jeunesse'], poids: 1.5 },
  { titre: 'Plan du site', resume: 'Toutes les pages du site.', url: '/plan-du-site.html', categorie: 'Informations', mots: ['plan du site', 'sommaire', 'arborescence'], poids: 0.5 },
  { titre: "S'abonner aux actualités", resume: 'Recevoir par courriel les actualités de la commune, ou seulement les thèmes choisis, avec désabonnement en un clic.', url: '/vie-locale/abonnement.html', categorie: 'Vie locale', mots: ['abonnement', 'newsletter', 'courriel', 'inscription', 'désabonnement', 'alerte email', 'thèmes'], expressions: ['être prévenu par email', 'recevoir les alertes par courriel'], poids: 1.5 },
  { titre: 'Les dates dans votre agenda', resume: 'Abonner son téléphone aux rendez-vous réguliers et aux événements de la commune.', url: '/vie-locale/calendriers.html', categorie: 'Vie locale', mots: ['agenda', 'calendrier', 'ical', 'ics', 'webcal', 'google agenda', 'rappel', 'téléphone'], expressions: ['ajouter à mon agenda', 'calendrier des encombrants', 'mettre les dates dans mon téléphone', 'calendrier de la commune'], poids: 1.5 },
  { titre: 'Fiche pratique à imprimer', resume: "Numéros d'urgence, horaires de la mairie, défibrillateur et rendez-vous réguliers sur une page.", url: '/mairie/fiche-pratique.html', categorie: 'La mairie', mots: ['fiche', 'imprimer', 'aide-mémoire', 'mémo', 'frigo', 'numéros utiles', 'papier'], expressions: ['fiche frigo', 'numéros utiles à imprimer', 'imprimer les numéros utiles'], poids: 1.5 },
  // Pas de « bibliothèque » seul dans les mots : il doit continuer à mener à
  // la bibliothèque Bib'lek (prêt de livres).
  { titre: 'Bibliothèque documentaire communale', resume: 'Les documents publiés par la commune, classés par année et par thème, avec une recherche dans leur texte.', url: '/mairie/bibliotheque-documentaire.html', categorie: 'La mairie', mots: ['documents', 'documentation', 'rapport', 'étude', 'arrêté', 'archives', 'publications'], expressions: ['documents de la commune', 'documents communaux', 'documents publiés par la mairie', 'bibliothèque documentaire'], poids: 1.5 }
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

// Annonces de l'en-tête, identiques sur toutes les pages du site.
definirAnnonces({
  actualites: actualites.length,
  consultations: consultations.filter((c) => V.etatConsultation(c, aujourdhui) === 'ouverte').length
});

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
ecrire('/vie-locale/associations.html', V.pageAssociations(ctx));
ecrire('/vie-locale/professionnels.html', V.pageProfessionnels(ctx));
ecrire('/vie-locale/carte-acteurs-economiques.html', V.pageCarteActeurs(ctx));

ecrire('/enfance-jeunesse/petite-enfance.html', V.pagePetiteEnfance(ctx));
ecrire('/enfance-jeunesse/colleges-lycees.html', V.pageEtablissements(ctx));
ecrire('/enfance-jeunesse/loisirs.html', V.pageLoisirsJeunesse(ctx));

ecrire('/mairie/contact.html', V.pageContact(ctx));
ecrire('/mairie/elus.html', V.pageElus(ctx));
ecrire('/mairie/commissions.html', V.pageCommissions(ctx));
ecrire('/mairie/conseils-municipaux.html', V.pageConseils(ctx));
// Une page par séance dont le PV est sur le site (voir V.pageSeanceConseil).
const seancesAvecPv = V.seancesAvecPv(conseils, documents);
for (const { annee, seance, doc } of seancesAvecPv) {
  ecrire(V.urlSeanceConseil(seance.date), V.pageSeanceConseil(ctx, seance, doc, annee));
}
ecrire('/mairie/budgets.html', V.pageBudgets(ctx));
ecrire('/mairie/fiche-pratique.html', V.pageFichePratique(ctx));
ecrire('/mairie/bibliotheque-documentaire.html', V.pageBibliothequeDocumentaire(ctx));
// Une page par document de la bibliothèque (voir V.pageDocumentBibliotheque) :
// le texte d'un .txt y est affiché tel quel, jusqu'à 200 Ko — au-delà, un
// lien pour l'ouvrir.
for (const { annee, docs } of V.anneesBibliotheque(documents)) {
  for (const d of docs) {
    const chemin = join(RACINE, 'public/documents', d.fichier);
    const texte = extension(d.fichier) === 'txt' && existsSync(chemin) && statSync(chemin).size <= 200 * 1024
      ? readFileSync(chemin, 'utf8') : null;
    ecrire(V.urlDocumentBibliotheque(d), V.pageDocumentBibliotheque(ctx, d, annee, texte));
  }
}
ecrire('/vie-locale/calendriers.html', V.pageCalendriers(ctx));
ecrire('/hors-ligne.html', V.pageHorsLigne(ctx));

// Index de rubrique : reprend l'ordre déclaré dans navigation.json.
const resumesPages = Object.fromEntries(pagesMd.map((p) => [p.url, p.meta.description]));
const nbSeancesConseil = conseils.reduce((n, a) => n + a.seances.length, 0);
const nbDocumentsBibliotheque = V.anneesBibliotheque(documents).reduce((n, a) => n + a.docs.length, 0);
for (const rub of nav) {
  if (rub.id === 'demarches') continue;
  const entrees = rub.enfants.map((c) => {
    const entree = { ...c, resume: resumesPages[c.url] || '' };
    if (c.url === '/mairie/conseils-municipaux.html') {
      entree.compteur = nbSeancesConseil;
      entree.compteurTitre = `${nbSeancesConseil} séance${nbSeancesConseil > 1 ? 's' : ''} enregistrée${nbSeancesConseil > 1 ? 's' : ''}`;
    }
    if (c.url === '/vie-locale/professionnels.html' && entreprises.entreprises.length) {
      const n = entreprises.entreprises.length;
      entree.compteur = n;
      entree.compteurTitre = `${n} acteur${n > 1 ? 's' : ''} économique${n > 1 ? 's' : ''} recensé${n > 1 ? 's' : ''} (répertoire Sirene)`;
    }
    if (c.url === '/mairie/bibliotheque-documentaire.html' && nbDocumentsBibliotheque) {
      entree.compteur = nbDocumentsBibliotheque;
      entree.compteurTitre = `${nbDocumentsBibliotheque} document${nbDocumentsBibliotheque > 1 ? 's' : ''} publié${nbDocumentsBibliotheque > 1 ? 's' : ''}`;
    }
    return entree;
  });
  ecrire(rub.url, V.rubriqueIndex(ctx, rub, entrees));
}

// Une page par document lié depuis les pages ci-dessus, sous la page qui
// le lie (voir V.pageDocumentLie) : un PDF ouvert seul laissait l'habitant
// sur téléphone sans retour possible au site.
for (const lie of ctx.documentsLies.values()) ecrire(lie.url, V.pageDocumentLie(ctx, lie));

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
${urls.filter((u) => u.endsWith('.html') && u !== '/hors-ligne.html').map((u) => `  <url><loc>${site.url}${u.replace(/index\.html$/, '')}</loc><lastmod>${aujourdhui}</lastmod></url>`).join('\n')}
</urlset>`);
ecrire('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);

/* ------------------------------------------------------- Calendriers (.ics) */

// Voir src/calendrier.mjs et V.pageCalendriers. Les actualités expirées
// quittent le calendrier des événements comme elles quittent les listes ;
// le fichier .ics propre à chaque actualité datée suit, lui, son permalien
// (jamais supprimé, pour ne pas casser un lien déjà partagé).
function ecrireBrut(cheminUrl, contenu) {
  const abs = join(DIST, cheminUrl.replace(/^\//, ''));
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, contenu);
}
ecrireBrut('/calendriers/rendez-vous-reguliers.ics', calendrier({
  nom: `${site.commune.nom} — rendez-vous réguliers`,
  description: `Les services et rendez-vous réguliers de la commune de ${site.commune.nom}.`,
  producteur: site.mairie.nom,
  evenements: evenementsReguliers(site.rendezVousReguliers || [], site)
}));
ecrireBrut('/calendriers/evenements.ics', calendrier({
  nom: `${site.commune.nom} — événements`,
  description: `Les manifestations et rendez-vous annoncés dans les actualités de la commune de ${site.commune.nom}.`,
  producteur: site.mairie.nom,
  evenements: actualites.map((a) => evenementActualite(a, site)).filter(Boolean)
}));
for (const a of actualitesToutes) {
  const evenement = evenementActualite(a, site);
  if (evenement) ecrireBrut(`/vie-locale/actualites/${a.id}.ics`, calendrier({ nom: a.titre, description: a.chapeau || a.titre, evenements: [evenement], producteur: site.mairie.nom }));
}

/* ------------------------- Recherche dans les PV et la bibliothèque documentaire */

// Seule dépendance du projet (voir CLAUDE.md, section « Recherche dans les
// comptes-rendus ») : unpdf extrait le texte des PDF déposés localement
// (public/documents/) d'une famille de catégories — "conseils/<année>" pour
// la recherche de /mairie/conseils-municipaux.html, "bibliotheque/<année>"
// pour celle de /mairie/bibliotheque-documentaire.html. Régénéré à chaque
// build depuis les PDF déjà versionnés dans le dépôt : aucune étape
// manuelle, aucun risque d'oubli après un dépôt par email (voir
// worker/github.mjs, commitDepotDocument). Les séances dont le PDF n'est
// qu'un lien externe (historique antérieur à ce circuit) ne sont pas
// couvertes — hors de portée d'un site statique sans accès à ce fichier.
//
// Un document de la bibliothèque porte en plus son libellé et ses thèmes
// (cherchés aussi par recherche-pv.js) : il reste donc trouvable même sans
// texte extractible (un scan, une image, une vidéo), d'où "garderSansTexte".
// Le texte vient d'un PDF (unpdf) ou d'un fichier texte (.txt, lu tel quel) ;
// les autres formats n'en ont pas.
//
// Le texte n'est écrit qu'une fois, tel qu'il s'affiche : sa version
// normalisée pour la recherche (minuscules, sans accents) est calculée par
// recherche-pv.js au chargement de l'index. L'écrire aussi ici doublait le
// poids du fichier, pour un calcul de quelques millisecondes.
async function construireIndexDocuments(documentsParCategorie, prefixe, { garderSansTexte = false, page = () => undefined } = {}) {
  const index = [];
  for (const [categorie, docs] of Object.entries(documentsParCategorie || {})) {
    if (!categorie.startsWith(prefixe)) continue;
    for (const doc of docs) {
      if (!doc.date) continue;
      const chemin = join(RACINE, 'public/documents', doc.fichier);
      if (!existsSync(chemin)) continue;
      let texteBasePv = '';
      try {
        let texte = '';
        if (extension(doc.fichier) === 'pdf') {
          ({ text: texte } = await extractText(new Uint8Array(readFileSync(chemin)), { mergePages: true }));
        } else if (extension(doc.fichier) === 'txt') {
          texte = readFileSync(chemin, 'utf8');
        }
        texteBasePv = String(texte).replace(/\s+/g, ' ').trim().slice(0, 200000);
      } catch (e) {
        console.error(`  ! Extraction du texte échouée pour ${doc.fichier} : ${e.message}`);
        if (!garderSansTexte) continue;
      }
      if (!texteBasePv && !garderSansTexte) continue;
      const entree = { date: doc.date, fichier: doc.fichier, page: page(doc), texteBasePv };
      if (garderSansTexte) {
        entree.libelle = doc.libelle;
        entree.themes = doc.themes || [];
      }
      index.push(entree);
    }
  }
  index.sort((a, b) => b.date.localeCompare(a.date));
  return index;
}

// Un résultat mène à la page du document, jamais au fichier seul (voir
// V.pageDocumentBibliotheque) ; un PV dont la date ne correspond à aucune
// séance n'a pas de page : recherche-pv.js mène alors au PDF.
const datesSeancesAvecPv = new Set(seancesAvecPv.map((x) => x.seance.date));
const indexPv = await construireIndexDocuments(documents, 'conseils/',
  { page: (doc) => (datesSeancesAvecPv.has(doc.date) ? V.urlSeanceConseil(doc.date) : undefined) });
const indexBibliotheque = await construireIndexDocuments(documents, 'bibliotheque/',
  { garderSansTexte: true, page: V.urlDocumentBibliotheque });

/* ------------------------------------------------------------------ Assets */

writeFileSync(join(DIST, 'search-index.json'), JSON.stringify(indexRecherche));
writeFileSync(join(DIST, 'recherche-pv.json'), JSON.stringify(indexPv));
writeFileSync(join(DIST, 'recherche-bibliotheque.json'), JSON.stringify(indexBibliotheque));

mkdirSync(join(DIST, 'assets'), { recursive: true });

const ordreCss = ['reset.css', 'tokens.css', 'theme-republique.css', 'theme-garrigue.css', 'theme-guichet.css', 'composants.css', 'pages.css', 'impression.css'];
const css = ordreCss
  .filter((f) => existsSync(join(RACINE, 'src/styles', f)))
  .map((f) => `/* ===== ${f} ===== */\n${readFileSync(join(RACINE, 'src/styles', f), 'utf8')}`)
  .join('\n');
writeFileSync(join(DIST, 'assets/site.css'), css);

const ordreJs = ['prefs.js', 'nav.js', 'recherche.js', 'horaires.js', 'outils.js'];
const js = ordreJs
  .filter((f) => existsSync(join(RACINE, 'src/scripts', f)))
  .map((f) => `/* ===== ${f} ===== */\n${readFileSync(join(RACINE, 'src/scripts', f), 'utf8')}`)
  .join('\n');
writeFileSync(join(DIST, 'assets/site.js'), js);

// Chargé séparément, pas dans le bundle site.js : seules les pages des
// conseils municipaux et de la bibliothèque documentaire en ont besoin,
// inutile d'en alourdir toutes les autres.
const recherchePv = join(RACINE, 'src/scripts/recherche-pv.js');
if (existsSync(recherchePv)) cpSync(recherchePv, join(DIST, 'assets/recherche-pv.js'));

// Chargé séparément, pas dans le bundle site.js : seule la page Transports
// en a besoin (voir V.pageMarkdown / widgetTransportLio).
const transportLio = join(RACINE, 'src/scripts/transport-lio.js');
if (existsSync(transportLio)) cpSync(transportLio, join(DIST, 'assets/transport-lio.js'));

// Chargé séparément, pas dans le bundle site.js : seules les actualités avec
// photo en ont besoin (voir V.articleActualite).
const photoJs = join(RACINE, 'src/scripts/photo.js');
if (existsSync(photoJs)) cpSync(photoJs, join(DIST, 'assets/photo.js'));

// Chargé séparément, pas dans le bundle site.js : seules les pages de
// consultation ouvertes en ont besoin (voir V.pageConsultation), pour
// afficher le compteur de réponses en direct — une pure amélioration
// JavaScript, jamais requise pour voter (voir CLAUDE.md).
const consultationJs = join(RACINE, 'src/scripts/consultation.js');
if (existsSync(consultationJs)) cpSync(consultationJs, join(DIST, 'assets/consultation.js'));

// Chargés séparément, pas dans le bundle site.js : seules les pages
// « Risques et sécurité » et « Eau et assainissement » en ont besoin (voir
// V.pageMarkdown, widgetRiviere et widgetRestrictionsEau).
// De même, filtre-naf.js pour la seule page « Acteurs économiques » (voir
// V.pageProfessionnels, annuaireSireneParSection), et situation.js pour la
// seule page d'accueil (V.accueil, bandeauSituation), qualite-eau.js pour la
// page « Eau et assainissement » (widgetQualiteEau), risques-adresse.js pour
// la page « Risques et sécurité » (widgetRisquesAdresse), carte-tourisme.js
// pour la page « Tourisme et randonnées » (carteTourisme).
for (const f of ['vidourle.js', 'restrictions-eau.js', 'qualite-eau.js', 'risques-adresse.js', 'filtre-naf.js', 'situation.js', 'plan-zonage.js', 'carte-tourisme.js']) {
  const source = join(RACINE, 'src/scripts', f);
  if (existsSync(source)) cpSync(source, join(DIST, 'assets', f));
}

// Service worker à la racine (sa portée couvre tout le site) : une version
// par build, pour que chaque publication remplace le cache précédent. Les
// pages ESSENTIELLES sont enregistrées dès la première visite, les autres
// au fil de la navigation (voir src/scripts/sw.js).
const ESSENTIELS = ['/', '/hors-ligne.html', '/cadre-de-vie/risques.html', '/mairie/fiche-pratique.html', '/mairie/contact.html',
  '/assets/site.css', '/assets/site.js', '/assets/blason.svg', '/assets/vidourle.js', '/assets/situation.js'];
writeFileSync(join(DIST, 'sw.js'), readFileSync(join(RACINE, 'src/scripts/sw.js'), 'utf8')
  .replace('__VERSION__', new Date().toISOString())
  .replace('__ESSENTIELS__', JSON.stringify(ESSENTIELS)));

const blason = join(RACINE, 'src/styles/blason.svg');
if (existsSync(blason)) cpSync(blason, join(DIST, 'assets/blason.svg'));

// Polices hébergées sur le site lui-même (licence OFL, fichiers de licence
// à côté) : sous /assets/, elles profitent aussi du cache hors connexion.
const polices = join(RACINE, 'src/styles/polices');
if (existsSync(polices)) cpSync(polices, join(DIST, 'assets/polices'), { recursive: true });

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
console.log(`  ${pagesEcrites.length} pages · ${demarches.length} démarches · ${index.length} entrées dans l'index de recherche · ${indexPv.length} PV indexé(s) · ${indexBibliotheque.length} document(s) de la bibliothèque`);
console.log(`  HTML total ${ko(total)} · page la plus lourde ${plusLourde.url} (${ko(plusLourde.octets)})`);
console.log(`  CSS ${ko(Buffer.byteLength(css))} · JS ${ko(Buffer.byteLength(js))} · index ${ko(Buffer.byteLength(JSON.stringify(indexRecherche)))}\n`);
