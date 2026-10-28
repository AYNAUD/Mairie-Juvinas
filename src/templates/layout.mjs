import { icone, logoCommune } from './icons.mjs';
import { echapper as e } from '../markdown.mjs';

export const esc = e;

export function lien(href, libelle, opts = {}) {
  const externe = /^https?:\/\//.test(href);
  const cls = [opts.classe, externe ? 'lien-externe' : ''].filter(Boolean).join(' ');
  const attrs = [
    cls ? ` class="${cls}"` : '',
    externe ? ' target="_blank" rel="noopener"' : '',
    opts.attrs || ''
  ].join('');
  const marque = externe ? `${icone('externe', 'icone--mini')}<span class="sr-only"> (nouvelle fenêtre)</span>` : '';
  return `<a href="${esc(href)}"${attrs}>${libelle}${marque}</a>`;
}

function fildAriane(fil) {
  if (!fil || !fil.length) return '';
  const items = fil.map((f, i) => {
    const dernier = i === fil.length - 1;
    return `<li>${dernier
      ? `<span aria-current="page">${esc(f.libelle)}</span>`
      : `<a href="${esc(f.url)}">${esc(f.libelle)}</a>`}</li>`;
  }).join('');
  return `<nav class="fil" aria-label="Fil d'Ariane"><ol>${items}</ol></nav>`;
}

function bandeauAlerte(site) {
  const a = site.alerte;
  if (!a || !a.actif) return '';
  return `<div class="alerte alerte--${esc(a.niveau)}" role="region" aria-label="Alerte en cours">
  <div class="conteneur alerte__inner">
    ${icone('alerte')}
    <div class="alerte__texte"><strong>${esc(a.titre)}</strong> ${esc(a.texte)}</div>
    ${a.lien ? lien(a.lien.url, esc(a.lien.libelle), { classe: 'alerte__lien' }) : ''}
  </div>
</div>`;
}

// Chaque rubrique garde son lien vers sa page d'index, qui liste déjà toutes
// ses sous-rubriques. À côté, un bouton déplie la liste de ces sous-rubriques
// (champ « enfants » de content/navigation.json) : panneau déroulant sur
// ordinateur, accordéon dans le menu du téléphone. Le bouton n'est affiché
// qu'une fois nav.js chargé ; sans script, le panneau s'ouvre en CSS au survol
// et au focus (voir « Sous-rubriques » dans composants.css).
function menuPrincipal(nav, actif) {
  const items = nav.map((n) => {
    const enfants = n.enfants || [];
    const idSous = `sous-menu-${esc(n.id)}`;
    const sousRubriques = enfants.length ? `
    <button class="menu__deplier" type="button" aria-expanded="false" aria-controls="${idSous}">${icone('chevron', 'menu__chevron')}<span class="sr-only">Sous-rubriques : ${esc(n.libelle)}</span></button>
    <ul class="menu__sous" id="${idSous}">${enfants.map((c) => `<li${c.miseEnAvant ? ' class="menu__sous-avant"' : ''}><a href="${esc(c.url)}">${esc(c.libelle)}</a></li>`).join('')}</ul>` : '';
    return `<li class="menu__entree${n.id === actif ? ' menu__entree--active' : ''}" style="--couleur-rubrique: var(--nav-${esc(n.id)})">
    <a class="menu__rubrique" href="${esc(n.url)}"${n.id === actif ? ' aria-current="page"' : ''}>
      <span class="menu__puce" aria-hidden="true"></span>
      <span class="menu__texte">
        <span class="menu__libelle">${esc(n.libelle)}</span>
        <span class="menu__desc">${esc(n.description)}</span>
      </span>
    </a>${sousRubriques}
  </li>`;
  }).join('\n');
  return `<ul class="menu__liste">${items}</ul>`;
}

// Annonces de l'en-tête (« 13 actualités à connaître… », « Participez à
// 2 consultations citoyennes ») : comptées une fois par le build (voir
// definirAnnonces dans src/build.mjs) et reprises sur toutes les pages,
// quelle que soit la rubrique, pas seulement sur l'accueil.
let annonces = { actualites: 0, consultations: 0 };
export function definirAnnonces(a) { annonces = a; }

function liensAnnonces() {
  const { actualites: actualitesCount, consultations: consultationsCount } = annonces;
  return `${actualitesCount ? `<a class="entete__actus" href="/vie-locale/actualites.html"><span class="entete__actus-texte">${actualitesCount} actualité${actualitesCount > 1 ? 's' : ''} à connaître…</span>${icone('chevron', 'icone--mini')}</a>` : ''}
      ${consultationsCount ? `<a class="entete__actus" href="/vie-locale/consultations.html"><span class="entete__actus-texte">Participez à ${consultationsCount} consultation${consultationsCount > 1 ? 's' : ''} citoyenne${consultationsCount > 1 ? 's' : ''}</span>${icone('chevron', 'icone--mini')}</a>` : ''}`;
}

// Sur téléphone, les mêmes annonces passent sur leur propre bandeau, sous
// l'en-tête et hors de sa partie collante (voir .annonces-telephone dans
// composants.css) : un seul des deux emplacements est affiché à la fois.
function annoncesTelephone() {
  if (!annonces.actualites && !annonces.consultations) return '';
  return `<div class="annonces-telephone" role="region" aria-label="Annonces de la mairie">
  <div class="conteneur annonces-telephone__inner">
      ${liensAnnonces()}
  </div>
</div>`;
}

function entete(site, nav, actif) {
  return `<header class="entete">
  <div class="conteneur entete__barre">
    <a class="marque" href="/">
      <span class="marque__blason" aria-hidden="true">${logoCommune('marque__logo')}</span>
      <span class="marque__texte">
        <span class="marque__nom">${esc(site.titre)}</span>
        <span class="marque__sous">${esc(site.baseline)}</span>
      </span>
    </a>

    ${(annonces.actualites || annonces.consultations) ? `<div class="entete__annonces">
      ${liensAnnonces()}
    </div>` : ''}

    <div class="entete__actions">
      <a class="bouton bouton--fantome entete__recherche" href="/recherche.html" data-ouvre-recherche>
        ${icone('recherche')}<span>Rechercher</span>
      </a>
      <button class="bouton bouton--fantome entete__a11y" type="button" data-ouvre-a11y aria-expanded="false" aria-controls="panneau-a11y">
        ${icone('accessibilite')}<span class="entete__label">Affichage</span>
      </button>
      <button class="bouton bouton--fantome entete__menu" type="button" data-ouvre-menu aria-expanded="false" aria-controls="menu-principal">
        ${icone('menu', 'icone--menu')}${icone('fermer', 'icone--fermer')}<span>Menu</span>
      </button>
    </div>
  </div>

  <nav class="menu" id="menu-principal" aria-label="Navigation principale">
    <div class="conteneur">${menuPrincipal(nav, actif)}</div>
  </nav>

  <div class="panneau-a11y" id="panneau-a11y" hidden>
    <div class="conteneur panneau-a11y__inner">
      <fieldset>
        <legend>Taille du texte</legend>
        <div class="segments" role="group">
          <button type="button" data-taille="normal" aria-pressed="true">Normale</button>
          <button type="button" data-taille="grand" aria-pressed="false">Grande</button>
          <button type="button" data-taille="tres-grand" aria-pressed="false">Très grande</button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Confort de lecture</legend>
        <div class="segments" role="group">
          <button type="button" data-bascule="contraste" aria-pressed="false">Contraste renforcé</button>
          <button type="button" data-bascule="dyslexie" aria-pressed="false">Police adaptée</button>
          <button type="button" data-bascule="anime" aria-pressed="false">Réduire les animations</button>
        </div>
      </fieldset>
      <p class="panneau-a11y__aide">Ces réglages sont enregistrés dans votre navigateur, sur cet appareil uniquement. <a href="/accessibilite.html">Déclaration d'accessibilité</a></p>
      <button class="bouton bouton--fantome panneau-a11y__fermer" type="button" data-ferme-a11y>${icone('fermer')}<span>Fermer</span></button>
    </div>
  </div>
</header>`;
}

export function champRecherche(site, opts = {}) {
  const id = opts.id || 'recherche';
  const grand = opts.grand ? ' recherche--grande' : '';
  const valeur = opts.valeur ? ` value="${esc(opts.valeur)}"` : '';
  return `<form class="recherche${grand}" action="/recherche.html" method="get" role="search" data-recherche>
  <label class="recherche__label" for="${id}-champ">${esc(opts.label || 'Rechercher une démarche, une information')}</label>
  <div class="recherche__boite">
    <input class="recherche__champ" id="${id}-champ" name="q" type="search"${valeur}
      placeholder="${esc(site.accueil.placeholderRecherche)}"
      autocomplete="off" spellcheck="false"
      role="combobox" aria-expanded="false" aria-autocomplete="list"
      aria-controls="${id}-resultats" aria-describedby="${id}-aide">
    <button class="bouton bouton--principal recherche__bouton" type="submit" aria-label="Rechercher">${icone('recherche')}</button>
  </div>
  <p class="recherche__aide" id="${id}-aide">Écrivez comme vous parlez : « perte de passeport », « inscrire mon enfant à la cantine ».</p>
  <div class="recherche__resultats" id="${id}-resultats" role="listbox" aria-label="Résultats de recherche" hidden></div>
  <p class="sr-only" aria-live="polite" data-annonce-recherche></p>
</form>`;
}

function suggestions(site) {
  return `<ul class="suggestions" aria-label="Recherches fréquentes">
    ${site.accueil.suggestions.map((s) => `<li><a href="/recherche.html?q=${encodeURIComponent(s)}" data-suggestion>${esc(s)}</a></li>`).join('')}
  </ul>`;
}

function overlayRecherche(site) {
  return `<div class="overlay" id="overlay-recherche" hidden>
  <div class="overlay__voile" data-ferme-recherche></div>
  <div class="overlay__boite" role="dialog" aria-modal="true" aria-labelledby="overlay-titre">
    <div class="overlay__entete">
      <h2 id="overlay-titre">Que cherchez-vous ?</h2>
      <button class="bouton bouton--fantome" type="button" data-ferme-recherche>${icone('fermer')}<span>Fermer</span></button>
    </div>
    ${champRecherche(site, { id: 'overlay', label: 'Rechercher sur le site de la mairie' })}
    <div class="overlay__suggestions">
      <h3>Recherches fréquentes</h3>
      ${suggestions(site)}
    </div>
  </div>
</div>`;
}

function grouperHoraires(horaires) {
  const groupes = [];
  for (const h of horaires.filter((h) => h.ouvert)) {
    const g = groupes.find((g) => g.libelle === h.libelle);
    if (g) g.jours.push(h.jour); else groupes.push({ libelle: h.libelle, jours: [h.jour] });
  }
  return groupes;
}

function joursTexte(jours) {
  if (jours.length === 1) return jours[0];
  const j = jours.map((jour, i) => (i === 0 ? jour : jour.toLowerCase()));
  return `${j.slice(0, -1).join(', ')} et ${j[j.length - 1]}`;
}

/** « Fermé le mardi, le samedi et le dimanche. », d'après site.json : une
 *  phrase écrite à la main serait fausse au premier changement d'horaires. */
function joursFermes(horaires) {
  const jours = horaires.filter((h) => !h.ouvert).map((h) => `le ${h.jour.toLowerCase()}`);
  if (!jours.length) return '';
  return `Fermé ${jours.length === 1 ? jours[0] : `${jours.slice(0, -1).join(', ')} et ${jours[jours.length - 1]}`}.`;
}

function piedDePage(site, nav) {
  const m = site.mairie;
  const horaires = grouperHoraires(m.horaires)
    .map((g) => `<li><span>${esc(joursTexte(g.jours))}</span><span>${esc(g.libelle)}</span></li>`).join('');
  const fermes = joursFermes(m.horaires);
  // Le libellé d'une colonne n'est pas un titre : un titre placé dans un
  // <summary> se retrouve dans un bouton pour les lecteurs d'écran.
  const colonnes = nav.map((n) => `<details class="pied__colonne">
    <summary><span class="pied__rubrique">${esc(n.libelle)}</span>${icone('chevron', 'pied__chevron')}</summary>
    <ul>${n.enfants.slice(0, 6).map((c) => `<li><a href="${esc(c.url)}">${esc(c.libelle)}</a></li>`).join('')}</ul>
  </details>`).join('');

  return `<footer class="pied">
  <div class="conteneur pied__contact">
    <div class="pied__coordonnees">
      <h2>${esc(m.nom)}</h2>
      <address>
        ${esc(m.adresse)}<br>${esc(m.codePostal)} ${esc(m.ville)}<br>
        <a href="tel:${esc(m.telephoneLien)}">${esc(m.telephone)}</a><br>
        <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>
      </address>
    </div>
    <div class="pied__horaires-bloc">
      <h2>Horaires du secrétariat</h2>
      <ul class="pied__horaires">${horaires}</ul>
      ${fermes ? `<p class="pied__note">${esc(fermes)}</p>` : ''}
    </div>
  </div>

  <div class="conteneur pied__plan">
    ${colonnes}
  </div>

  <div class="conteneur pied__liens-utiles">
    <h2>Sites utiles</h2>
    <ul>${site.liensUtiles.map((l) => `<li>${l.logo
      ? lien(l.url, `<img src="/img/${esc(l.logo)}" alt="${esc(l.libelle)}" loading="lazy">`, { classe: 'bouton logo-lien' })
      : lien(l.url, esc(l.libelle))}</li>`).join('')}</ul>
  </div>

  <div class="pied__bas">
    <div class="conteneur pied__bas-inner">
      <ul class="pied__legal">
        <li><a href="/accessibilite.html">Accessibilité : conforme RGAA 4.1</a></li>
        <li><a href="/mentions-legales.html">Mentions légales</a></li>
        <li><a href="/donnees-personnelles.html">Données personnelles</a></li>
        <li><a href="/plan-du-site.html">Plan du site</a></li>
        <li><a href="/designs.html">Thèmes du site</a></li>
      </ul>
      <p class="pied__copyright">© ${new Date().getFullYear()} Commune de ${esc(site.commune.nom)} — Site sans cookie ni traceur.</p>
    </div>
  </div>
</footer>`;
}

function barreMobile(site) {
  const m = site.mairie;
  return `<nav class="barre-mobile" aria-label="Accès rapides">
  <a href="/recherche.html" data-ouvre-recherche>${icone('recherche')}<span>Rechercher</span></a>
  <a href="/demarches/">${icone('document')}<span>Démarches</span></a>
  <a href="tel:${esc(m.telephoneLien)}">${icone('telephone')}<span>Appeler</span></a>
  ${lien(m.itineraire, `${icone('lieu')}<span>Y aller</span>`)}
</nav>`;
}

export function page({ site, nav, titre, description, contenu, actif = '', fil = [], classeCorps = '', sommaire = null }) {
  const titreComplet = titre ? `${titre} — ${site.titre}` : `${site.titre} — ${site.commune.departement}`;
  const asideSommaire = sommaire && sommaire.length > 1
    ? `<nav class="sommaire" aria-labelledby="sommaire-titre">
        <h2 id="sommaire-titre">Sur cette page</h2>
        <ol>${sommaire.map((s) => `<li><a href="#${s.id}">${esc(s.texte)}</a></li>`).join('')}</ol>
      </nav>`
    : '';

  return `<!doctype html>
<html lang="fr" data-theme="${esc(site.theme)}" data-commune="${esc(site.commune.nom)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titreComplet)}</title>
<meta name="description" content="${esc(description || site.description)}">
<meta name="theme-color" content="#ffffff">
<link rel="preload" href="/assets/polices/source-sans-3-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<link rel="icon" href="/assets/blason.svg" type="image/svg+xml">
<script>
/* Restaure les préférences avant le premier rendu : évite tout clignotement.
   Un paramètre ?theme=... dans l'URL force temporairement un thème pour cette
   page — pratique pour comparer les 3 sites par simple lien, sans rien changer
   aux réglages enregistrés du visiteur. */
(function(){var d=document.documentElement;d.className+=' js';try{var p=JSON.parse(localStorage.getItem('mairie-prefs')||'{}');
if(p.theme)d.setAttribute('data-theme',p.theme);if(p.taille)d.setAttribute('data-taille',p.taille);
if(p.contraste)d.setAttribute('data-contraste','1');if(p.dyslexie)d.setAttribute('data-dyslexie','1');
if(p.anime)d.setAttribute('data-anime','0');
var force=new URLSearchParams(location.search).get('theme');
if(force&&['republique','garrigue','guichet'].indexOf(force)>-1)d.setAttribute('data-theme',force);
}catch(err){}})();
</script>
</head>
<body class="${esc(classeCorps)}">
<!--SPRITE-->
<a class="evitement" href="#contenu">Aller au contenu principal</a>
<a class="evitement" href="#recherche-champ">Aller à la recherche</a>
${bandeauAlerte(site)}
${entete(site, nav, actif)}
${annoncesTelephone()}
${fildAriane(fil)}
<main id="contenu" class="principal" tabindex="-1">
${asideSommaire}
${contenu}
</main>
${piedDePage(site, nav)}
${barreMobile(site)}
${overlayRecherche(site)}
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}

export { icone, suggestions, grouperHoraires, joursTexte };
