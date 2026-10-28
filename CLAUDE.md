# CLAUDE.md — Site de la Mairie de Juvinas (07600)

**Ce dépôt reprend l'architecture du site de la mairie de Lecques** (Gard) : même principe
directeur, mêmes contraintes techniques, même moteur statique. Il a été amorcé le 18 septembre 2026
puis remis à niveau le 28 octobre 2026 sur l'état actuel de Lecques (357 commits d'écart). Le contenu
est propre à Juvinas — voir « État de ce fork » pour ce qui est vérifié, ce qui est automatique et
ce qui manque encore.

## Le principe directeur

**L'habitant ne vient pas admirer le site, il vient accomplir une action.**

Refaire une carte d'identité, déclarer une naissance, savoir quand sortir la poubelle,
louer la salle Vesta. Toute décision de conception se tranche avec cette question :
*est-ce que ça rapproche l'habitant de son action, ou est-ce que ça l'en éloigne ?*

Trois règles qui en découlent, non négociables :

1. **Règle des 3 clics** — toute démarche courante est atteignable en 3 clics maximum depuis
   l'accueil. Les plus fréquentes le sont en **1 clic** (tuiles « Je veux… »).
2. **Zonage strict** — le transactionnel (`Mes démarches`) ne se mélange jamais avec l'éditorial
   (`Vie locale`, actualités). Deux zones, deux traitements visuels.
3. **Mobile d'abord** — plus de 60 % des consultations se font sur smartphone. Toute feuille de
   style s'écrit en mobile-first, les media queries sont exclusivement en `min-width`.
   Aucune page ne défile horizontalement à 320 px : un contenu trop large défile
   dans son propre cadre, jamais la page.

## Contraintes techniques non négociables

- **Zéro dépendance runtime.** `package.json` ne contient que des scripts. Pas de framework,
  pas de bundler. **Exception assumée** : `unpdf` (extraction du texte des PDF de séance pour la
  recherche dans les comptes-rendus), utilisée uniquement par `src/build.mjs` au moment du build,
  jamais envoyée au navigateur.
- **Zéro requête tierce.** Pas de Google Fonts, pas de CDN, pas d'analytics externe. Les polices
  sont **hébergées sur le site** (`src/styles/polices/`, licence SIL OFL 1.1 : Source Sans 3 pour le
  texte, Spectral pour les titres du thème garrigue). Les API publiques (Sirene, OFGL, Géo'DAE,
  OpenStreetMap…) ne sont interrogées que par les scripts de `tools/`, jamais par le navigateur.
- **Fonctionnement sans JavaScript.** Le JS améliore, il ne rend jamais un contenu accessible.
- **RGAA 4.1.** Contrastes AA, hiérarchie de titres sans saut, focus visible, cibles ≥ 44 px,
  zoom 200 % sans défilement horizontal, alternatives textuelles.
- **Budget** : < 250 ko transférés par page (HTML, CSS et JS compressés, polices comprises, images
  exclues). `npm run check` mesure ce poids transféré.

## Structure du dépôt

```
content/            SOURCE DE VÉRITÉ. Modifiée par la mairie. JSON + Markdown.
  site.json         coordonnées, horaires, bandeau d'alerte, tuiles d'accueil, thème, rendez-vous
                     réguliers, cours d'eau (riviere), liens de situation
  demarches.json    les 28 fiches démarche
  synonymes.json    langage courant → démarche ou page, et réponses rapides
  navigation.json   les 5 entrées de menu et leurs sous-rubriques
  pages/*.md        pages éditoriales (front-matter + Markdown)
  documents.json    registre des documents rattachés aux Conseils, Budgets, Bulletins,
                     Bibliothèque documentaire et pages génériques
  annuaire.json     associations, petite enfance, établissements scolaires, loisirs, urgences
  elus.json         conseil municipal (Répertoire national des élus)
  entreprises.json, defibrillateurs.json, finances.json, carte-fond.json
                    données publiques relues automatiquement — jamais éditées à la main
  photos.json       dimensions des photos (une entrée par photo de public/img/)
src/build.mjs       générateur statique (Node natif)
src/markdown.mjs, texte-actualite.mjs, calendrier.mjs, formats-documents.mjs, naf.mjs
src/templates/      gabarits : layout.mjs, views.mjs (un rendu par type de page), icons.mjs
src/styles/         tokens.css + composants.css + pages.css + 3 thèmes ; polices/
src/scripts/        prefs, nav, recherche, horaires, outils (bundle site.js) ; scripts propres à
                    une page ; sw.js (hors connexion)
public/img          photos (2 largeurs, JPEG optimisé)
public/documents    PDF téléchargeables
tools/              serve, check, test-recherche, importer-pv, fetch-* (données publiques)
.github/workflows/  check.yml (contrôles), entreprises.yml (Sirene, chaque nuit),
                    donnees-publiques.yml (défibrillateurs et comptes, chaque semaine)
dist/               sortie générée. JAMAIS éditée à la main, JAMAIS versionnée.
```

**Moteur partagé avec Lecques.** Le moteur (`src/`, `tools/`) est le même que celui de Lecques ;
seuls diffèrent le contenu (`content/`), le thème « Châtaigneraie », l'emblème et quelques gabarits
rendus indépendants de la commune (voir ci-dessous). Pour reprendre de futurs changements de Lecques,
comparer par fusion à trois voies (base = commit `149ca47` de Lecques, état du fork d'origine ;
la remise à niveau du 28 octobre 2026 s'est faite ainsi). Les classes CSS `carte-lecques__*`
et `dae--lecques` sont un héritage de nommage du moteur partagé : ne pas les renommer côté Juvinas
seul.

## Règle absolue sur le contenu

**Ne jamais modifier le HTML de `dist/`.** Tout contenu se modifie dans `content/`,
puis on relance `npm run build`.

## Ajouter une démarche

1. Ajouter un objet dans `content/demarches.json` — les champs `id`, `titre`, `resume`,
   `lieu` (`mairie` | `enligne` | `ailleurs`), `categorie`, `pieces`, `delai`, `cout`,
   `action` et `motsCles` sont tous obligatoires.
2. Ajouter les formulations en langage courant dans `content/synonymes.json`.
3. Si la démarche doit apparaître en tuile sur l'accueil, ajouter son `id` à
   `site.json → accueil.tuiles` (8 maximum).
4. Ajouter un cas dans `tools/test-recherche.mjs` : une démarche que la recherche ne trouve pas
   n'existe pas. `npm test` doit rester sans échec.

## Ajouter un document

Le fichier physique va toujours dans `public/documents/`. Son rattachement à une page passe par
`content/documents.json`, registre à clés de catégorie (`conseils/<année>`, `bibliotheque/<année>`,
`budgets`, `elus`, `bulletins`, `commissions`, `pages/<slug>`). Même fonctionnement que sur Lecques :
chaque document a sa page dans le site, avec format et poids annoncés (voir `worker/README.md` du
dépôt Lecques pour le circuit par email, non porté ici).

## Données publiques automatiques (« services sans entretien »)

- **Acteurs économiques** (`/vie-locale/professionnels.html`, carte
  `/vie-locale/carte-acteurs-economiques.html`) : `npm run entreprises` interroge le répertoire
  Sirene (API recherche-entreprises, code INSEE 07111) ; fond de carte OpenStreetMap par
  `npm run carte`. Relancé chaque nuit par `entreprises.yml`.
- **Défibrillateurs** (page Risques, fiche pratique) : `npm run defibrillateurs` (Géo'DAE). Aucun
  appareil n'est déclaré dans la commune au 28 octobre 2026 : le site affiche les plus proches.
- **Comptes de la commune** (`/mairie/budgets.html`) : `npm run finances` (OFGL, budget
  principal, comparé aux communes de 100 à 199 habitants). Le budget détaillé voté (sections,
  projets) reste à saisir dans `content/budgets.json` ; tant qu'il est vide, la page ne montre que
  les comptes publics.
- **Calendriers** (`/vie-locale/calendriers.html`) et **fiche pratique** à imprimer : générés depuis
  `site.json → rendezVousReguliers`, `annuaire.json`, `defibrillateurs.json` et les actualités.
- **Hors connexion** : `src/scripts/sw.js` garde l'accueil, les risques, la fiche pratique et le
  contact sur l'appareil.
- **Recherche dans les comptes-rendus** : voir `tools/importer-pv.mjs` (`npm run pv:importer`) et
  `src/scripts/recherche-pv.js`.

Des widgets « en direct » existent dans le moteur mais restent **inertes** tant qu'aucun Worker
n'est déployé pour Juvinas (`site.administration.urlBase` est un domaine factice) : cours d'eau,
restrictions d'eau (VigiEau), qualité de l'eau (Hub'Eau), risques à l'adresse, situation du moment,
horaires de car en temps réel (`site.transport`, absent). Ils retombent sur des liens vers les
services officiels.

## Ce qui n'est pas porté de Lecques

- **Le Worker d'administration** (`worker/` : formulaire de publication, comptes valideurs,
  abonnements et courriels, alertes automatiques) : composant serveur à part, avec secrets et
  comptes Cloudflare/GitHub/Brevo à créer. Tant qu'il n'existe pas, `content/actualites.json`,
  `content/documents.json` et le formulaire d'abonnement se modifient à la main, et le formulaire
  d'abonnement reste visuellement présent mais inerte.
- Le déploiement OVH/Cloudflare, le guide Word de l'habitant, la carte « Autour de la commune »
  (moteur prêt, mais `content/tourisme-sites.json` n'est pas saisi : il demande des sites avec leur
  fiche officielle vérifiée) et le plan de zonage du PLU (**Juvinas n'a pas de PLU** : commune au
  règlement national d'urbanisme, vérifié sur l'API Carto du Géoportail de l'urbanisme).

## État de ce fork (à lire avant de publier quoi que ce soit)

Rien de ce site n'a été relu par la mairie de Juvinas. Niveau de confiance des contenus :

- **Officiel / données ouvertes, vérifié** : coordonnées de la mairie, horaires (Annuaire de
  l'administration, fiche du 6 mars 2025 — certains sites tiers donnent d'autres créneaux, à
  reconfirmer), maire, adjoints et conseillers (Répertoire national des élus, version du 11 août
  2026), élus du canton, député, sénateurs, risques et arrêtés de catastrophe naturelle (Géorisques),
  régime d'urbanisme RNU (Géoportail de l'urbanisme), réseaux d'eau potable (Hub'Eau), jours de
  collecte des déchets et transport à la demande (Communauté de communes du Bassin d'Aubenas, pages
  du 28 octobre 2026), absence d'école sur la commune (Annuaire de l'éducation), comptes 2025
  (OFGL), activités économiques (Sirene).
- **Source encyclopédique** (Wikipédia) : histoire, météorite de 1821, patrimoine, salle Vesta
  (inaugurée le 29 mars 2019), géographie, climat.
- **Volontairement laissé vide plutôt qu'inventé** : école de rattachement des enfants, tarif et
  durée des concessions du cimetière, tarif et règlement de la salle Vesta, budget détaillé,
  commissions municipales, activités des associations, liste de commerçants présentés en détail
  (`annuaire.professionnels`), sites touristiques cartographiés.
- **Une graphie à trancher** : la rivière s'écrit « Bézorgues » (Sandre, OpenStreetMap, Wikipédia) ;
  « Bésorgues » circule aussi (et fait partie du nom de la commune voisine Labastide-sur-Bésorgues).
  Le site emploie « Bézorgues » pour la rivière.
- **Thème visuel** : `garrigue` (identifiant technique inchangé, affiché « Châtaigneraie »),
  par défaut, recoloré pour l'Ardèche. Son bandeau d'accueil porte la photo du village.
- **Emblème** : le logo de l'en-tête (météorite au-dessus des crêtes) est un emblème de travail,
  pas le logo de la commune : à remplacer par le logo officiel si la mairie en possède un.
- **Accueil** : la carte « Un nom connu jusque dans l'espace » (`site.accueil.identite`) met en
  avant la météorite de Juvinas ; la galerie « Juvinas en images » porte les deux photos fournies.
- **Photos** : seules `mairie` et `village` existent (`public/img/`). Un fichier brut
  `public/img/Village_juvinas.jpg` est laissé hors dépôt.
- **Nom de domaine** : `content/site.json → url` utilise `https://www.juvinas.fr` comme espace
  réservé (ce domaine redirige aujourd'hui vers une plateforme départementale, `e-ardeche.fr`,
  dont le certificat ne correspond pas) — à confirmer avant toute mise en ligne.

## Les trois thèmes

Un seul code, trois identités visuelles pilotées par `data-theme` sur `<html>` :
`republique` (institutionnel), `garrigue` (identitaire, recoloré pour l'Ardèche, affiché
« Châtaigneraie », par défaut), `guichet` (utilitaire, mode sombre natif). **Aucune couleur ne doit
être codée en dur** dans `composants.css` ou dans un gabarit : toute couleur passe par une variable
de `tokens.css`, redéfinie par les trois thèmes. Un thème qui ajoute une variable doit l'ajouter aux
trois, sinon `npm run check` échoue.

## Commandes

```
npm run build          Génère dist/
npm run dev            Génère puis sert dist/ sur http://localhost:4173 (PORT=… pour un autre port)
npm run check          Build + contrôles complets + test de pertinence de la recherche
npm test               Test de pertinence de la recherche seul
npm run entreprises    Relit le répertoire Sirene (automatique chaque nuit)
npm run carte          Refait le fond de carte (contour, voirie, Bézorgues), à la main
npm run defibrillateurs / npm run finances
                       Relit Géo'DAE / les comptes OFGL (automatique chaque semaine)
npm run zonage         Plan de zonage du PLU — sans objet tant que Juvinas n'a pas de PLU
npm run carte:tourisme Fond de la carte Tourisme, après saisie de content/tourisme-sites.json
npm run pv:importer -- <dossier> [--essai]
                       Importe un dossier de PV de conseils (PDF datés dans leur nom)
```

`npm run check` échoue si un contraste passe sous le seuil AA, si un thème oublie une variable, si
un lien interne est mort, s'il manque un `alt`, un `h1` ou un `lang`, ou si une ressource tierce
s'est glissée dans une page. Il doit rester vert.

## Coordonnées de référence (ne pas réinventer)

```
Mairie de Juvinas — Le Village, 35 route de la Mairie, 07600 JUVINAS
Tél. 04 75 88 21 56 — mairie@juvinas.fr
Secrétariat : lundi 13h30-17h30 · mercredi 13h30-17h30
Maire : Jean-Claude COURT — 187 habitants (INSEE 2023) — CC du Bassin d'Aubenas
```

Ces valeurs vivent dans `content/site.json` et nulle part ailleurs. Un numéro de téléphone codé en
dur dans un gabarit est un bug.
