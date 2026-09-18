# CLAUDE.md — Site de la Mairie de Juvinas (07600)

**Ce dépôt est un fork du moteur du site de la mairie de Lecques** (même principe directeur,
mêmes contraintes techniques, même structure de dépôt). Le contenu, lui, est propre à
Juvinas — rien n'a été copié tel quel : voir « État de ce fork » plus bas pour savoir ce qui
est vérifié, ce qui est un brouillon, et ce qui manque encore.

## Le principe directeur

**L'habitant ne vient pas admirer le site, il vient accomplir une action.**

Refaire une carte d'identité, déclarer une naissance, savoir quand sortir la poubelle,
louer la salle communale. Toute décision de conception se tranche avec cette question :
*est-ce que ça rapproche l'habitant de son action, ou est-ce que ça l'en éloigne ?*

Trois règles qui en découlent, non négociables :

1. **Règle des 3 clics** — toute démarche courante est atteignable en 3 clics maximum depuis
   l'accueil. Les plus fréquentes le sont en **1 clic** (tuiles « Je veux… »).
2. **Zonage strict** — le transactionnel (`Mes démarches`) ne se mélange jamais avec l'éditorial
   (`Vie locale`, actualités). Deux zones, deux traitements visuels.
3. **Mobile d'abord** — plus de 60 % des consultations se font sur smartphone. Toute feuille de
   style s'écrit en mobile-first, les media queries sont exclusivement en `min-width`.
   Aucune page ne défile horizontalement à 320 px.

## Contraintes techniques non négociables

- **Zéro dépendance runtime.** `package.json` ne contient que des scripts. Pas de framework,
  pas de bundler. **Exception assumée** : `unpdf` (extraction de texte des PDF de séance pour
  la recherche dans les comptes-rendus), utilisée uniquement par `src/build.mjs` au moment du
  build, jamais envoyée au navigateur.
- **Zéro requête tierce.** Pas de Google Fonts, pas de CDN, pas d'analytics externe. Polices
  système uniquement.
- **Fonctionnement sans JavaScript.** Le JS améliore, il ne rend jamais un contenu accessible.
- **RGAA 4.1.** Contrastes AA, hiérarchie de titres sans saut, focus visible, cibles ≥ 44 px,
  zoom 200 % sans défilement horizontal, alternatives textuelles.
- **Budget** : < 250 ko par page, chargement complet en moins d'une seconde en 3G.

## Structure du dépôt

```
content/            SOURCE DE VÉRITÉ. Modifiée par la mairie. JSON + Markdown.
src/build.mjs        générateur statique (Node natif, 1 dépendance : unpdf)
src/markdown.mjs      rendu Markdown minimal maison
src/templates/        gabarits : modules JS produisant le HTML
src/styles/            tokens.css (variables) + composants.css + pages.css + 3 thèmes
src/scripts/           prefs.js, nav.js, recherche.js, horaires.js
public/img            photos (VIDE — aucune photo n'a encore été fournie)
public/documents       PDF téléchargeables (VIDE)
tools/serve.mjs        aperçu local
tools/check.mjs        contrastes, variables, liens morts, structure, poids
tools/test-recherche.mjs  pertinence du moteur de recherche
dist/                  sortie générée. JAMAIS éditée à la main, JAMAIS versionnée.
```

**Pas de dossier `worker/`** dans ce fork : l'administration par email (dépôt de documents et
d'actualités piloté par courriel, voir le dépôt Lecques) n'a pas été portée. Tant qu'il
n'existe pas, `content/documents.json`, `content/actualites.json` et le formulaire
d'abonnement (`/vie-locale/abonnement.html`) se modifient à la main, directement dans le
dépôt — et le formulaire d'abonnement reste visuellement présent mais inerte
(`site.administration.urlBase` pointe vers un domaine placeholder, voir `content/site.json`).

## Règle absolue sur le contenu

**Ne jamais modifier le HTML de `dist/`.** Tout contenu se modifie dans `content/`,
puis on relance `npm run build`.

## État de ce fork (à lire avant de publier quoi que ce soit)

Ce dépôt a été amorcé par IA à partir de sources publiques (service-public.fr, linternaute.fr,
Wikipédia, Géoportail de l'urbanisme) le 18 septembre 2026. **Rien de tout cela n'a été validé
par la mairie de Juvinas.** Avant toute publication :

- **Fiable, croisé sur plusieurs sources** : coordonnées de la mairie (adresse, téléphone,
  email), code INSEE, intercommunalité (CC du Bassin d'Aubenas), population, superficie,
  altitude, arrondissement, canton.
- **Une seule source, à confirmer** : nom du maire et des élus (`content/elus.json`, source
  linternaute.fr).
- **Horaires du secrétariat** (`content/site.json` → `mairie.horaires`) : trouvées sur des
  agrégateurs, pas une source officielle communale — à reconfirmer en priorité, tout le site
  (bandeau d'accueil, page Contact) en dépend.
- **Fiches démarche** (`content/demarches.json`, 20 fiches) : la plupart décrivent des
  procédures nationales, fiables. Trois ont un point d'incertitude signalé dans leur texte
  (gendarmerie compétente, maternité de rattachement, document d'urbanisme applicable).
  Quatre sont des coquilles à ne pas publier telles quelles — `ecole-cantine`, `encombrants`,
  `salle-communale`, et le tarif dans `concession-cimetiere` — faute de source fiable.
- **Pages éditoriales incomplètes par honnêteté, pas par oubli** : `dechets.md`, `eau.md`,
  `urbanisme.md`, `environnement.md`, `risques.md`, `transports.md`, `services.md`,
  `ecole.md`, `bulletins.md` sont des pages « à compléter » — mieux vaut une case vide qu'une
  information inventée sur un site public.
- **Aucune photo, aucun PDF** : `public/img/` et `public/documents/` sont vides. Les gabarits
  y font toujours référence (`content/photos.json` reste `{}` en attendant) : c'est signalé
  par `npm run check` (2 liens morts vers des images), pas un bug à corriger sans photos
  réelles.
- **`content/budgets.json`** est vide : la page Budget elle-même a été retirée du générateur
  (`src/build.mjs`/`src/templates/views.mjs`) plutôt que publiée avec des montants inventés —
  à réécrire une fois le budget réel transmis par la mairie.
- **Thème visuel** : `republique` (institutionnel, neutre) par défaut. Le thème `garrigue`
  hérité de Lecques (olivier, terre cuite — identité méditerranéenne du Gard) reste
  disponible dans le code mais ne convient pas à l'identité de l'Ardèche ; à renommer/recolorer
  si vous voulez un thème identitaire propre à Juvinas.
- **Nom de domaine** : `content/site.json` → `url` utilise `https://www.juvinas.fr` comme
  simple espace réservé — à confirmer/enregistrer avant toute mise en ligne.

## Les trois thèmes

Un seul code, trois identités visuelles pilotées par `data-theme` sur `<html>` :
`republique` (institutionnel), `garrigue` (hérité de Lecques, à retravailler), `guichet`
(utilitaire, mode sombre natif). **Aucune couleur ne doit être codée en dur** dans
`composants.css` ou dans un gabarit : toute couleur passe par une variable de `tokens.css`,
redéfinie par les trois thèmes.

## Commandes

```
npm run build    Génère dist/
npm run dev      Génère puis sert dist/ sur http://localhost:4173
npm run check    Build + contrôles complets + test de pertinence de la recherche
npm test         Test de pertinence de la recherche seul
```

`npm run check` doit rester vert à l'exception des deux liens d'image mentionnés ci-dessus,
tant qu'aucune photo n'a été fournie.

## Coordonnées de référence (ne pas réinventer)

```
Mairie de Juvinas — Le Village, 35 route de la Mairie, 07600 JUVINAS
Tél. 04 75 88 21 56 — mairie@juvinas.fr
Secrétariat : lundi 13h30-17h30 · mercredi 13h30-17h30 (à confirmer)
Maire : Jean-Claude COURT — 187 habitants (INSEE 2023) — CC du Bassin d'Aubenas
```

Ces valeurs vivent dans `content/site.json` et nulle part ailleurs.
