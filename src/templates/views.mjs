import { page, esc, lien, icone, champRecherche, suggestions, grouperHoraires, joursTexte } from './layout.mjs';
import { formatBibliotheque } from '../formats-documents.mjs';
import { rendre } from '../markdown.mjs';
import { texteActualiteEnHtml } from '../texte-actualite.mjs';
import { quandRendezVous } from '../calendrier.mjs';
import { grouperParSectionNaf } from '../naf.mjs';

// Résumé court des horaires d'ouverture (bandeau d'accueil, repli sans JS) et
// données machine pour l'amélioration JS (src/scripts/horaires.js) : les
// deux se déduisent de content/site.json → mairie.horaires, jamais d'une
// plage horaire codée en dur, qui ne vaudrait que pour une seule commune.
function resumeHoraires(horaires) {
  const groupes = grouperHoraires(horaires);
  if (!groupes.length) return 'Secrétariat : se renseigner en mairie.';
  return 'Secrétariat : ' + groupes.map((g) => `${joursTexte(g.jours)} ${g.libelle}`).join(' · ') + '.';
}

function donneesHoraires(horaires) {
  const versMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  return horaires.filter((h) => h.ouvert && h.debut && h.fin)
    .map((h) => `${h.index}:${versMinutes(h.debut)}-${versMinutes(h.fin)}`).join(',');
}

// Chaque catégorie porte une photo : il n'existe pas de photo par démarche,
// mais une image cohérente par famille de démarches adoucit tout de même
// chaque fiche, sans jamais inventer un lien avec une photo hors sujet.
// Photos À FOURNIR par la mairie de Juvinas (voir public/img/, content/photos.json) :
// les identifiants ci-dessous sont des emplacements, aucune image n'existe encore.
export const CATEGORIES = {
  papiers: { titre: 'Papiers et identité', icone: 'identite', resume: 'Carte d\'identité, passeport, carte grise, permis de conduire.',
    photo: 'mairie', photoAlt: 'La mairie de Juvinas.' },
  famille: { titre: 'Famille et état civil', icone: 'mariage', resume: 'Mariage, PACS, naissance, décès, cimetière.',
    photo: 'village', photoAlt: 'Le village de Juvinas.' },
  citoyennete: { titre: 'Citoyenneté et élections', icone: 'vote', resume: 'Listes électorales, procuration, recensement, contact des élus.',
    photo: 'village', photoAlt: 'Le village de Juvinas.' },
  enfance: { titre: 'Enfance et scolarité', icone: 'ecole', resume: 'École, cantine, centre de loisirs.',
    photo: 'village', photoAlt: 'Le village de Juvinas.' },
  logement: { titre: 'Logement et urbanisme', icone: 'travaux', resume: 'Travaux, permis de construire, cadastre, terrain.',
    photo: 'village', photoAlt: 'Le village de Juvinas.' },
  'cadre-de-vie': { titre: 'Déchets et cadre de vie', icone: 'encombrant', resume: 'Encombrants, déchetterie, déchets verts, débroussaillement, animaux.',
    photo: 'village', photoAlt: 'Le village de Juvinas.' },
  'vie-locale': { titre: 'Vie locale et associations', icone: 'association', resume: 'Salle communale, associations.',
    photo: 'mairie', photoAlt: 'La mairie de Juvinas.' },
  loisirs: { titre: 'Loisirs', icone: 'nature', resume: 'Chasse, pêche et activités de plein air.',
    photo: 'village', photoAlt: 'Le village de Juvinas.' }
};

export const LIEUX = {
  mairie: { libelle: 'En mairie', classe: 'lieu--mairie' },
  enligne: { libelle: '100 % en ligne', classe: 'lieu--enligne' },
  ailleurs: { libelle: 'Hors de la commune', classe: 'lieu--ailleurs' }
};

const urlDemarche = (id) => `/demarches/${id}.html`;

function badgeLieu(d) {
  const l = LIEUX[d.lieu] || LIEUX.mairie;
  return `<span class="lieu ${l.classe}">${icone(d.lieu === 'enligne' ? 'document' : d.lieu === 'ailleurs' ? 'lieu' : 'mairie', 'icone--mini')}${esc(l.libelle)}</span>`;
}

function carteDemarche(d, opts = {}) {
  return `<li class="carte carte--demarche">
  <h3 class="carte__titre"><a href="${urlDemarche(d.id)}">${esc(opts.court ? d.titreCourt : d.titre)}</a></h3>
  <p class="carte__resume">${esc(d.resume)}</p>
  ${badgeLieu(d)}
</li>`;
}

function tuile(d) {
  return `<li class="tuile">
  <a href="${urlDemarche(d.id)}">
    <span class="tuile__icone">${icone(d.icone)}</span>
    <span class="tuile__titre">${esc(d.titreCourt)}</span>
    <span class="tuile__lieu">${esc((LIEUX[d.lieu] || LIEUX.mairie).libelle)}</span>
  </a>
</li>`;
}

function boutonAction(a, principal = false) {
  const cls = principal ? 'bouton bouton--principal bouton--large' : 'bouton bouton--secondaire';
  // Pour un lien externe, `lien()` ajoute déjà le pictogramme « nouvelle fenêtre »
  // en fin de libellé : n'en mettons pas un second en tête.
  if (a.type === 'externe') return lien(a.url, `<span>${esc(a.libelle)}</span>`, { classe: cls });
  const ic = a.type === 'tel' ? 'telephone' : a.type === 'mail' ? 'courriel' : 'fleche';
  return `<a class="${cls}" href="${esc(a.url)}">${icone(ic)}<span>${esc(a.libelle)}</span></a>`;
}

function dateFr(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Une actualité peut aussi porter une période (dateDebut/dateFin, ex. un
// conseil municipal ou une manifestation) depuis la fusion avec l'ancien
// Agenda. Les deux champs sont facultatifs et indépendants : cette fonction
// couvre les quatre combinaisons possibles pour ne jamais mal afficher une
// date manquante.
function periodeActu(a) {
  const debut = a.dateDebut || null;
  const fin = a.dateFin || null;
  if (!debut && !fin) return `<time datetime="${esc(a.date)}">${dateFr(a.date)}</time>`;
  if (debut && fin && debut !== fin) {
    return `Du <time datetime="${esc(debut)}">${dateFr(debut)}</time> au <time datetime="${esc(fin)}">${dateFr(fin)}</time>`;
  }
  if (!debut && fin) return `Jusqu'au <time datetime="${esc(fin)}">${dateFr(fin)}</time>`;
  const seule = debut || fin;
  return `Le <time datetime="${esc(seule)}">${dateFr(seule)}</time>`;
}

/* ------------------------------------------------- Consultations citoyennes */

// Contrairement aux actualités, les deux dates d'une consultation sont
// toujours renseignées (voir content/consultations.json) : l'état se déduit
// normalement de leur position par rapport à aujourd'hui. Exception : une
// consultation clôturée par avance (CONSULTATION-CLOTURE reçue avant la
// dateFin initiale — voir commitClotureConsultation, worker/github.mjs) doit
// afficher "Terminée" dès le jour même de la clôture, pas seulement le
// lendemain de la nouvelle dateFin (aujourdhui > dateFin ne suffit pas si
// les deux dates tombent le même jour) — d'où le champ "fermee", posé
// explicitement par cette commande plutôt que déduit des dates.
export function etatConsultation(c, aujourdhui) {
  if (c.fermee) return 'terminee';
  if (aujourdhui < c.dateDebut) return 'a-venir';
  if (aujourdhui > c.dateFin) return 'terminee';
  return 'ouverte';
}

function badgeEtatConsultation(etat) {
  if (etat === 'ouverte') return `<span class="lieu lieu--ouverte">${icone('check', 'icone--mini')}Ouverte</span>`;
  if (etat === 'a-venir') return `<span class="lieu">${icone('horloge', 'icone--mini')}À venir</span>`;
  return `<span class="lieu lieu--fermee">${icone('document', 'icone--mini')}Terminée</span>`;
}

function periodeConsultation(c, etat) {
  if (etat === 'ouverte') return `Consultation ouverte jusqu'au <time datetime="${esc(c.dateFin)}">${dateFr(c.dateFin)}</time>`;
  if (etat === 'a-venir') return `Ouvrira le <time datetime="${esc(c.dateDebut)}">${dateFr(c.dateDebut)}</time>`;
  return `Consultation terminée le <time datetime="${esc(c.dateFin)}">${dateFr(c.dateFin)}</time>`;
}

function carteConsultation(c, aujourdhui) {
  const etat = etatConsultation(c, aujourdhui);
  return `<li class="carte carte--consultation">
  <p class="carte__meta">${badgeEtatConsultation(etat)} <span class="etiquette">${esc(c.theme)}</span></p>
  <h3 class="carte__titre"><a href="/vie-locale/consultations/${esc(c.id)}.html">${esc(c.question)}</a></h3>
  <p class="carte__resume">${periodeConsultation(c, etat)}</p>
</li>`;
}

// Résultats définitifs (`resultatsFinaux`), toujours rendus en HTML statique
// pur : contrairement aux barres de pageBudgets (qui peuvent être
// aria-hidden car un <table> équivalent existe juste à côté), il n'y a pas
// ici de tableau parallèle — le pourcentage et le nombre de voix doivent
// donc être du texte réel dans chaque <li>.
function blocResultatsFinaux(options, resultatsFinaux, titre) {
  const total = resultatsFinaux.reduce((s, r) => s + r.voix, 0);
  return `<section class="section" aria-labelledby="resultats-titre">
    <h2 id="resultats-titre">${esc(titre)}</h2>
    <p class="consultation-compteur">${total} réponse${total > 1 ? 's' : ''}</p>
    <ul class="barres">
      ${options.map((o) => {
        const r = resultatsFinaux.find((x) => x.optionId === o.id);
        const voix = r ? r.voix : 0;
        const pct = total ? Math.round((voix / total) * 100) : 0;
        return `<li><span class="barres__label">${esc(o.libelle)} — ${pct}&nbsp;% (${voix} voix)</span>
          <span class="barres__piste"><span class="barres__valeur" style="inline-size:${pct}%"></span></span></li>`;
      }).join('')}
    </ul>
  </section>`;
}

// Distinct de blocResultatsFinaux (les chiffres) : ce que la mairie décide de
// faire de la consultation une fois close — renseigné par CONSULTATION-CLOTURE
// (voir worker/README.md), jamais généré automatiquement.
function blocConclusions(conclusions) {
  if (!conclusions) return '';
  return `<section class="encadre" aria-labelledby="conclusions-titre">
    <h2 id="conclusions-titre">Conclusions retenues de la consultation</h2>
    ${conclusions.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}
  </section>`;
}

function carteActu(a, opts = {}) {
  const titreTag = opts.titreTag || 'h3';
  return `<li class="carte carte--actu${a.epingle ? ' carte--actu-une' : ''}">
  ${a.image ? `<p class="carte__image"><img src="${esc(a.image.chemin)}" alt="${esc(a.image.alt)}" loading="lazy"></p>` : ''}
  <div class="carte__texte">
    <p class="carte__meta"><span class="etiquette">${esc(a.categorie)}</span> ${periodeActu(a)}${a.epingle ? ' <span class="etiquette etiquette--epingle">À la une</span>' : ''}</p>
    <${titreTag} class="carte__titre"><a href="/vie-locale/actualites/${esc(a.id)}.html">${esc(a.titre)}</a></${titreTag}>
    ${a.chapeau ? `<p class="carte__resume">${esc(a.chapeau)}</p>` : ''}
  </div>
</li>`;
}

/* ------------------------------------------------------------------ Accueil */

function carteGalerie(item, photos) {
  const d = (photos || {})[item.photo] || { largeur: 1200, hauteur: 800 };
  return `<li class="carte-galerie">
  <a href="${esc(item.url)}">
    <img src="/img/${esc(item.photo)}-700.jpg"
         srcset="/img/${esc(item.photo)}-700.jpg 700w, /img/${esc(item.photo)}-1200.jpg 1200w"
         sizes="(min-width: 64em) 22vw, (min-width: 40em) 30vw, 45vw"
         width="${d.largeur}" height="${d.hauteur}" loading="lazy" decoding="async" alt="${esc(item.alt)}">
    <span class="carte-galerie__libelle">${esc(item.libelle)}</span>
  </a>
</li>`;
}

// Le Worker « données en direct » (worker/README.md) est-il déployé ? Tant que
// administration.urlBase est un domaine .invalid, les widgets en direct ne
// font aucune requête : ils retombent sur leurs liens vers les services officiels.
const workerPret = (ctx) => !/\.invalid(\/|$)/.test(ctx.site.administration.urlBase || '.invalid');

// Situation du moment en tête de l'accueil : vigilance météo orange ou
// rouge dans le département, cours d'eau qui monte ou crue prévue par Vigicrues. Même
// aspect que le bandeau d'alerte de la mairie (layout.mjs, bandeauAlerte),
// mais caché par défaut : src/scripts/situation.js lit
// {administration.urlBase}/situation (worker/donnees-publiques.mjs,
// resumerSituation) et ne le montre qu'en orange ou en rouge, avec les
// phrases que le Worker a rédigées (les mêmes que dans les alertes par
// courriel). Sans JavaScript, ou si le Worker ne répond pas, rien ne
// s'affiche : l'accueil reste celui d'un jour ordinaire. L'état des routes
// n'est qu'un lien : reprendre les données d'Inforoute 30 demanderait
// l'autorisation écrite du Département (liens configurés dans
// site.json → situation).
function bandeauSituation(ctx) {
  if (!workerPret(ctx)) return '';
  const urlApi = `${ctx.site.administration.urlBase}/situation`;
  const cfg = ctx.site.situation || {};
  return `<div class="alerte" role="region" aria-label="Situation en cours" data-situation="${esc(urlApi)}" hidden>
  <div class="conteneur alerte__inner">
    ${icone('alerte')}
    <div class="alerte__texte" data-contenu></div>
    ${lien('/cadre-de-vie/risques.html', cfg.libelleConsignes || 'Consignes de sécurité', { classe: 'alerte__lien' })}
    ${cfg.lienRoutes ? lien(cfg.lienRoutes, 'État des routes', { classe: 'alerte__lien' }) : ''}
    ${cfg.lienVigilance ? lien(cfg.lienVigilance, 'Carte de Météo-France', { classe: 'alerte__lien' }) : ''}
  </div>
</div>
<script src="/assets/situation.js" defer></script>`;
}

export function accueil(ctx) {
  const { site, nav, demarches, actualites, photos, consultations } = ctx;
  const parId = Object.fromEntries(demarches.map((d) => [d.id, d]));
  const tuiles = site.accueil.tuiles.map((id) => parId[id]).filter(Boolean);
  const m = site.mairie;

  const unesAccueil = actualites.filter((a) => a.epingle).slice(0, 1);
  const autresAccueil = actualites.filter((a) => !a.epingle).slice(0, unesAccueil.length ? 2 : 3);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const nbConsultationsOuvertes = (consultations || []).filter((c) => etatConsultation(c, aujourdhui) === 'ouverte').length;

  const contenu = `
${bandeauSituation(ctx)}
<section class="heros" aria-labelledby="heros-titre">
  <div class="conteneur">
    <h1 id="heros-titre" class="heros__titre sr-only">Que souhaitez-vous faire&nbsp;?</h1>
    <p class="heros__intro">Toutes vos démarches à ${esc(site.commune.nom)}, en trois clics au maximum.</p>
    ${champRecherche(site, { id: 'recherche', label: 'Rechercher une démarche ou une information' })}
    <p class="pratique__statut heros__statut" data-statut-mairie data-horaires="${esc(donneesHoraires(site.mairie.horaires))}">
      <span class="pastille" aria-hidden="true"></span>
      <span><span data-statut-texte>${esc(resumeHoraires(site.mairie.horaires))}</span>
      <a href="#pratique-titre">Voir le détail</a></span>
    </p>
    <div class="heros__suggestions">
      <h2 class="heros__suggestions-titre">Recherches fréquentes</h2>
      ${suggestions(site)}
    </div>
  </div>
</section>

<section class="section section--tuiles" aria-labelledby="tuiles-titre">
  <div class="conteneur">
    <div class="section__entete">
      <h2 id="tuiles-titre">${esc(site.accueil.titreTuiles)}</h2>
      <p>${esc(site.accueil.sousTitreTuiles)}</p>
    </div>
    <ul class="tuiles">${tuiles.map(tuile).join('')}</ul>
    <p class="section__pied"><a class="bouton bouton--secondaire" href="/demarches/">${icone('fleche')}<span>Voir les ${demarches.length} démarches</span></a></p>
  </div>
</section>

${actualites.length ? `<section class="section" aria-labelledby="actualites-accueil-titre">
  <div class="conteneur">
    <div class="section__entete">
      <h2 id="actualites-accueil-titre">Actualités</h2>
      <a class="lien-suite" href="/vie-locale/actualites.html">${icone('fleche', 'icone--mini')}<span>Toutes les actualités</span></a>
      <p>Les dernières informations publiées par la mairie.</p>
    </div>
    ${unesAccueil.length ? `<ul class="liste-actus liste-actus--une">${unesAccueil.map((a) => carteActu(a, { titreTag: 'h3' })).join('')}</ul>` : ''}
    <ul class="grille-actus">${autresAccueil.map((a) => carteActu(a, { titreTag: 'h3' })).join('')}</ul>
    <aside class="encadre">
      <h2>Ne manquez aucune actualité</h2>
      <p>Recevez par courriel les prochaines publications de la mairie. Inscription libre, gratuite et résiliable en un clic.</p>
      <p><a class="bouton bouton--secondaire" href="/vie-locale/abonnement.html">${icone('courriel')}<span>S'abonner par courriel</span></a></p>
    </aside>
  </div>
</section>` : ''}

${nbConsultationsOuvertes > 0 ? `<section class="section section--consultation" aria-labelledby="consultation-accueil-titre">
  <div class="conteneur">
    <div class="carte carte--consultation-une">
      <h2 id="consultation-accueil-titre">🗣️ Participez à ${nbConsultationsOuvertes} consultation${nbConsultationsOuvertes > 1 ? 's' : ''} citoyenne${nbConsultationsOuvertes > 1 ? 's' : ''}</h2>
      <p><a class="bouton bouton--principal" href="/vie-locale/consultations.html">${icone('fleche')}<span>Je participe et donne mon avis…</span></a></p>
    </div>
  </div>
</section>` : ''}

<section class="section section--pratique" aria-labelledby="pratique-titre">
  <div class="conteneur">
    <div class="section__entete">
      <h2 id="pratique-titre">La mairie en pratique</h2>
      <p>Horaires, adresse et contact, réunis dans une seule carte.</p>
    </div>
    <div class="carte carte--pratique">
      <div class="pratique-grille">
        <div class="pratique-colonne">
          <h3>${icone('horloge', 'icone--mini')}Horaires du secrétariat</h3>
          <ul class="pratique__horaires">
            ${m.horaires.map((h) => `<li${h.ouvert ? '' : ' class="ferme"'}><span>${esc(h.jour)}</span><span>${esc(h.libelle)}</span></li>`).join('')}
          </ul>
          <p class="pied__note">${esc(m.horairesNote)}</p>
        </div>
        <div class="pratique-colonne">
          <h3>${icone('lieu', 'icone--mini')}Nous trouver</h3>
          <ul class="pratique__contacts">
            <li>${icone('lieu')}<span>${esc(m.adresse)}<br>${esc(m.codePostal)} ${esc(m.ville)}</span></li>
            <li>${icone('telephone')}<a href="tel:${esc(m.telephoneLien)}">${esc(m.telephone)}</a></li>
            <li>${icone('courriel')}<a href="mailto:${esc(m.email)}">${esc(m.email)}</a></li>
          </ul>
          <div class="pratique__boutons">
            ${lien(m.itineraire, `${icone('lieu')}<span>Itinéraire</span>`, { classe: 'bouton bouton--secondaire' })}
            <a class="bouton bouton--secondaire" href="/mairie/contact.html">${icone('mairie')}<span>Nous écrire</span></a>
          </div>
        </div>
        <div class="pratique-colonne">
          <h3>${icone('check', 'icone--mini')}Le secrétariat vous aide pour</h3>
          <ul class="pieces">
            <li>${icone('check', 'icone--mini')}<span>Un rendez-vous pour une démarche</span></li>
            <li>${icone('check', 'icone--mini')}<span>Un rendez-vous avec un élu</span></li>
            <li>${icone('check', 'icone--mini')}<span>Signaler un problème dans le village</span></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>

${site.accueil.identite ? `<section class="section section--identite" aria-labelledby="identite-titre">
  <div class="conteneur">
    <div class="carte carte--identite">
      <div class="carte--identite__icone" aria-hidden="true">${icone('meteorite')}</div>
      <div class="carte--identite__texte">
        <h2 id="identite-titre">${esc(site.accueil.identite.titre)}</h2>
        <p>${esc(site.accueil.identite.texte)}</p>
        <p><a class="lien-suite" href="${esc(site.accueil.identite.lien.url)}">${icone('fleche', 'icone--mini')}<span>${esc(site.accueil.identite.lien.libelle)}</span></a></p>
      </div>
    </div>
  </div>
</section>` : ''}

${site.accueil.galerie && site.accueil.galerie.length ? `<section class="section section--galerie" aria-labelledby="galerie-titre">
  <div class="conteneur">
    <div class="section__entete">
      <h2 id="galerie-titre">${esc(site.commune.nom)} en images</h2>
      <p>Le village, ses habitants et ses lieux de vie.</p>
    </div>
    <ul class="galerie galerie--defilante">${site.accueil.galerie.map((item) => carteGalerie(item, photos)).join('')}</ul>
  </div>
</section>` : ''}

${site.application ? `<section class="section section--appli" aria-labelledby="appli-titre">
  <div class="conteneur appli">
    <div>
      <h2 id="appli-titre">${esc(site.application.titre)}</h2>
      <p>${esc(site.application.texte)}</p>
    </div>
    <div class="appli__boutons">
      ${lien(site.application.ios, '<span>Télécharger pour iPhone</span>', { classe: 'bouton bouton--secondaire' })}
      ${lien(site.application.android, '<span>Télécharger pour Android</span>', { classe: 'bouton bouton--secondaire' })}
    </div>
  </div>
</section>` : ''}`;

  return page({ site, nav, titre: '', description: site.description, contenu, actif: '', classeCorps: 'page-accueil' });
}

/* ------------------------------------------------------- Liste des démarches */

export function listeDemarches(ctx) {
  const { site, nav, demarches } = ctx;
  const rub = nav.find((n) => n.id === 'demarches');
  const groupes = Object.keys(CATEGORIES)
    .map((cle) => ({ cle, ...CATEGORIES[cle], items: demarches.filter((d) => d.categorie === cle) }))
    .filter((g) => g.items.length);

  const contenu = `<div class="conteneur">
  ${banniereMuette(ctx, rub.photo, rub.photoAlt, rub.photoCredit)}
  <header class="page-entete">
    <h1>Mes démarches</h1>
    <p class="page-entete__intro">${demarches.length} démarches, classées par thème. Chaque fiche indique où la faire, les pièces à fournir, le coût et le délai.</p>
    ${champRecherche(site, { id: 'recherche', label: 'Rechercher une démarche' })}
  </header>

  <nav class="ancres" aria-label="Thèmes de démarches">
    <ul>${groupes.map((g) => `<li><a href="#${g.cle}">${icone(g.icone, 'icone--mini')}${esc(g.titre)}</a></li>`).join('')}</ul>
  </nav>

  ${groupes.map((g) => `<section class="section section--groupe" id="${g.cle}" aria-labelledby="titre-${g.cle}">
    <div class="section__entete">
      <h2 id="titre-${g.cle}">${icone(g.icone)}${esc(g.titre)}</h2>
      <p>${esc(g.resume)}</p>
    </div>
    <ul class="grille-cartes">${g.items.map((d) => carteDemarche(d)).join('')}</ul>
  </section>`).join('')}
</div>`;

  return page({
    site, nav, actif: 'demarches',
    titre: 'Mes démarches',
    description: `Toutes les démarches administratives à ${site.commune.nom} : papiers, famille, école, urbanisme, déchets. Où la faire, pièces à fournir, coût et délai.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Mes démarches' }],
    contenu
  });
}

/* --------------------------------------------------------- Fiche de démarche */

export function ficheDemarche(ctx, d) {
  const { site, nav, demarches } = ctx;
  const parId = Object.fromEntries(demarches.map((x) => [x.id, x]));
  const cat = CATEGORIES[d.categorie] || {};
  const voirAussi = (d.voirAussi || []).map((id) => parId[id]).filter(Boolean);
  const fil = [{ libelle: 'Accueil', url: '/' }, { libelle: 'Mes démarches', url: '/demarches/' }, { libelle: d.titreCourt }];

  const contenu = `<div class="conteneur conteneur--etroit">
  <article class="fiche">
    ${d.photo ? banniereMuette(ctx, d.photo, d.photoAlt, d.photoCredit) : banniereMuette(ctx, cat.photo, cat.photoAlt, cat.photoCredit)}
    <header class="fiche__entete">
      <p class="fiche__categorie">${icone(cat.icone || 'document', 'icone--mini')}${esc(cat.titre || 'Démarche')}</p>
      <h1>${esc(d.titre)}</h1>
      <p class="fiche__resume">${esc(d.resume)}</p>
      <div class="fiche__ou">
        ${badgeLieu(d)}
        <p>${esc(d.lieuDetail)}</p>
      </div>
      <div class="fiche__actions">
        ${boutonAction(d.action, true)}
        ${(d.actionsSecondaires || []).map((a) => boutonAction(a)).join('')}
      </div>
    </header>

    <section class="fiche__bloc" aria-labelledby="a-quoi">
      <h2 id="a-quoi">À quoi ça sert</h2>
      <p>${esc(d.quoi)}</p>
    </section>

    ${d.id === 'plu' ? planZonage(ctx, { niveau: 2, fiche: true }) : ''}

    <section class="fiche__bloc" aria-labelledby="comment">
      <h2 id="comment">Comment faire</h2>
      <ol class="etapes">${d.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>
    </section>

    ${d.pieces && d.pieces.length ? `<section class="fiche__bloc" aria-labelledby="pieces">
      <h2 id="pieces">Ce qu'il faut apporter</h2>
      <ul class="pieces">${d.pieces.map((p) => `<li>${icone('check', 'icone--mini')}<span>${esc(p)}</span></li>`).join('')}</ul>
    </section>` : ''}

    <section class="fiche__bloc" aria-labelledby="delai-cout">
      <h2 id="delai-cout">Délai et coût</h2>
      <dl class="paire">
        <div><dt>${icone('horloge', 'icone--mini')}Délai</dt><dd>${esc(d.delai)}</dd></div>
        <div><dt>Coût</dt><dd>${esc(d.cout)}</dd></div>
      </dl>
    </section>

    ${d.documents && d.documents.length ? `<section class="documents" aria-labelledby="docs-${esc(d.id)}">
      <h2 id="docs-${esc(d.id)}">Documents à consulter</h2>
      <ul class="liste-documents">
        ${d.documents.map((doc) => ligneDocument(ctx, { url: `/demarches/${d.id}.html`, actif: 'demarches', fil, ancre: `docs-${d.id}` }, doc)).join('')}
      </ul>
    </section>` : ''}

    ${d.aSavoir ? `<aside class="encadre" aria-labelledby="a-savoir">
      <h2 id="a-savoir">Bon à savoir</h2>
      <p>${esc(d.aSavoir)}</p>
    </aside>` : ''}

    <section class="fiche__bloc fiche__contact" aria-labelledby="besoin-aide">
      <h2 id="besoin-aide">Besoin d'aide&nbsp;?</h2>
      <p>Le secrétariat de mairie vous accompagne dans vos démarches, y compris celles qui ne relèvent pas de la commune.</p>
      <ul class="pratique__contacts">
        <li>${icone('telephone')}<a href="tel:${esc(site.mairie.telephoneLien)}">${esc(site.mairie.telephone)}</a></li>
        <li>${icone('courriel')}<a href="mailto:${esc(site.mairie.email)}">${esc(site.mairie.email)}</a></li>
        <li>${icone('horloge')}<span>Lundi, mercredi et vendredi de 10h à 12h · Jeudi de 14h à 16h30</span></li>
      </ul>
    </section>

    ${voirAussi.length ? `<section class="fiche__bloc" aria-labelledby="voir-aussi">
      <h2 id="voir-aussi">Voir aussi</h2>
      <ul class="grille-cartes">${voirAussi.map((x) => carteDemarche(x, { court: true })).join('')}</ul>
    </section>` : ''}
  </article>
</div>`;

  return page({
    site, nav, actif: 'demarches',
    titre: d.titre,
    description: d.resume,
    fil,
    contenu
  });
}

/* -------------------------------------------------------- Page de recherche */

export function pageRecherche(ctx) {
  const { site, nav, demarches } = ctx;
  const groupes = Object.keys(CATEGORIES)
    .map((cle) => ({ cle, ...CATEGORIES[cle], items: demarches.filter((d) => d.categorie === cle) }))
    .filter((g) => g.items.length);

  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <h1>Rechercher</h1>
    <p class="page-entete__intro">Écrivez comme vous parlez. La recherche comprend les formulations courantes et les fautes de frappe.</p>
    ${champRecherche(site, { id: 'recherche', label: 'Rechercher sur le site de la mairie' })}
  </header>

  <section id="resultats-page" class="resultats-page" aria-live="polite" aria-labelledby="resultats-titre" hidden>
    <h2 id="resultats-titre">Résultats</h2>
    <div data-resultats-page></div>
  </section>

  <section class="section" aria-labelledby="toutes-titre" data-repli-recherche>
    <div class="section__entete">
      <h2 id="toutes-titre">Toutes les démarches</h2>
      <p>Si la recherche ne vous donne pas ce que vous cherchez, la liste complète est ici.</p>
    </div>
    ${groupes.map((g) => `<h3 class="titre-groupe">${icone(g.icone, 'icone--mini')}${esc(g.titre)}</h3>
      <ul class="liste-simple">${g.items.map((d) => `<li><a href="${urlDemarche(d.id)}">${esc(d.titre)}</a> <span class="liste-simple__lieu">${esc((LIEUX[d.lieu] || LIEUX.mairie).libelle)}</span></li>`).join('')}</ul>`).join('')}
  </section>
</div>`;

  return page({
    site, nav, titre: 'Rechercher',
    description: `Rechercher une démarche ou une information sur le site de la mairie de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Rechercher' }],
    contenu, classeCorps: 'page-recherche'
  });
}

/* --------------------------------------------------- Abonnement aux actualités */

export function pageAbonnement(ctx) {
  const { site, nav } = ctx;
  const urlBase = site.administration.urlBase;
  // Thèmes = catégories d'actualités (content/categories-actualites.json),
  // « Alertes et sécurité » en tête : c'est le choix de ceux qui ne veulent
  // être prévenus que de l'essentiel (crue, coupure d'eau…).
  const ALERTES = 'Alertes et sécurité';
  const themes = [...(ctx.categoriesActualites || [])].sort((a, b) => (b === ALERTES) - (a === ALERTES));

  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <h1>S'abonner aux actualités</h1>
    <p class="page-entete__intro">Recevez par courriel les actualités publiées par la mairie de ${esc(site.commune.nom)}. Inscription libre, gratuite et résiliable à tout moment.</p>
  </header>

  <section class="section formulaire-simple" aria-labelledby="inscription-titre">
    <h2 id="inscription-titre">Je m'abonne</h2>
    <form method="post" action="${esc(urlBase)}/abonnement" class="formulaire-simple__form">
      <div class="champ">
        <label for="abonnement-email">Votre adresse électronique</label>
        <input type="email" id="abonnement-email" name="email" required autocomplete="email" placeholder="vous@exemple.fr">
      </div>
      ${themes.length ? `<fieldset class="champ-themes" aria-describedby="themes-aide">
        <legend>Thèmes qui vous intéressent <span class="champ-themes__facultatif">(facultatif)</span></legend>
        <p class="champ-themes__aide" id="themes-aide">Sans rien cocher, vous recevez toutes les actualités.${themes.includes(ALERTES) ? ` Pour n'être prévenu que d'une crue, d'une coupure d'eau ou d'une autre alerte, cochez seulement « ${ALERTES} ».` : ''}</p>
        <ul class="cases">
          ${themes.map((t, i) => `<li><input type="checkbox" id="theme-${i}" name="themes" value="${esc(t)}"><label for="theme-${i}">${esc(t)}</label></li>`).join('')}
        </ul>
      </fieldset>` : ''}
      <p class="champ-piege">
        <label for="abonnement-site">Ne remplissez pas ce champ, réservé à la détection automatisée</label>
        <input type="text" id="abonnement-site" name="site_web" tabindex="-1" autocomplete="off">
      </p>
      <button type="submit" class="bouton bouton--principal bouton--large">M'abonner</button>
    </form>
    <p class="formulaire-simple__note">Un courriel de confirmation vous sera envoyé : votre inscription n'est effective qu'après avoir cliqué sur le lien qu'il contient. Déjà abonné&nbsp;? Remplissez de nouveau ce formulaire pour changer de thèmes : le lien de confirmation les enregistrera. Vous pourrez vous désabonner à tout moment, en un clic, depuis n'importe quel courriel reçu. En savoir plus sur <a href="/donnees-personnelles.html">le traitement de vos données</a>.</p>
  </section>

  <section class="section formulaire-simple" aria-labelledby="desabonnement-titre">
    <h2 id="desabonnement-titre">Me désabonner</h2>
    <p>Chaque actualité reçue par courriel contient un lien de désabonnement immédiat. Si vous ne le retrouvez plus, indiquez votre adresse ci-dessous : nous vous renverrons ce lien par courriel.</p>
    <form method="post" action="${esc(urlBase)}/desabonnement" class="formulaire-simple__form">
      <div class="champ">
        <label for="desabonnement-email">Votre adresse électronique</label>
        <input type="email" id="desabonnement-email" name="email" required autocomplete="email" placeholder="vous@exemple.fr">
      </div>
      <button type="submit" class="bouton bouton--secondaire bouton--large">Recevoir le lien de désabonnement</button>
    </form>
  </section>
</div>`;

  return page({
    site, nav, actif: 'vie-locale',
    titre: "S'abonner aux actualités",
    description: `Recevoir par courriel les actualités de la commune de ${site.commune.nom}, avec désabonnement en un clic.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Vie locale', url: '/vie-locale/' }, { libelle: "S'abonner aux actualités" }],
    contenu
  });
}

/* ------------------------------------------------------- Pages éditoriales */

// Bannière en couleurs atténuées, en écho à la photo cliquée sur l'accueil.
// L'idée : cliquer une photo de la galerie doit retrouver cette même photo,
// adoucie, en arrivant sur la page — un fil visuel entre les deux.
function banniereMuette(ctx, nom, alt, credit) {
  if (!nom) return '';
  const d = (ctx.photos || {})[nom] || { largeur: 1200, hauteur: 800 };
  // Photo sous licence libre (Wikimedia Commons) : son auteur et sa licence
  // sont dus sous l'image, sur toute page qui l'affiche (content/photos.json).
  // Prise hors de la commune (horsCommune) : le nom de l'auteur seul, lié à
  // la page de la photo qui porte la licence (ce que permettent les licences
  // Creative Commons 4.0 et CC0 de ces photos), sans autre légende.
  const auteur = d.auteur ? (d.source ? lien(d.source, esc(d.auteur)) : esc(d.auteur)) : '';
  const legende = d.horsCommune
    ? auteur
    : [credit ? esc(credit) : '', auteur ? `Photo : ${auteur}${d.licence ? `, ${esc(d.licence)}` : ''}.` : ''].filter(Boolean).join(' ');
  return `<figure class="banniere-page">
    <img src="/img/${esc(nom)}-1200.jpg"
         srcset="/img/${esc(nom)}-700.jpg 700w, /img/${esc(nom)}-1200.jpg 1200w"
         sizes="(min-width: 48em) 48rem, 100vw"
         width="${d.largeur}" height="${d.hauteur}" loading="lazy" decoding="async"
         alt="${esc(alt || '')}">
    ${legende ? `<figcaption>${legende}</figcaption>` : ''}
  </figure>`;
}

// Un document peut venir du front-matter Markdown (chaîne "fichier.pdf | Libellé",
// ou tableau de telles chaînes) ou du registre content/documents.json (objets
// {fichier, libelle} déjà normalisés) — normaliserDocuments ramène les deux
// formes à la même forme d'objet, sans toucher au parseur de front-matter.
// src/build.mjs l'applique au chargement des pages pour y poser le poids.
export function normaliserDocuments(source) {
  if (!source) return [];
  return (Array.isArray(source) ? source : [source]).map((d) => {
    if (d && typeof d === 'object') return d;
    const [fichier, ...reste] = String(d).split('|');
    return { fichier: fichier.trim(), libelle: reste.join('|').trim() || fichier.trim() };
  });
}

// Un document lié depuis une page du site (fiche démarche, page éditoriale,
// élus, budgets, actualité…) s'ouvre dans sa propre page, rangée sous celle
// d'où l'on vient (« /vie-locale/tourisme.html » →
// « /vie-locale/tourisme/exemple-pdf.html ») et qui y ramène :
// voir pageDocument. Le gabarit inscrit le document dans ctx.documentsLies
// en écrivant son lien ; src/build.mjs écrit ensuite ces pages.
// "parent" : la page qui porte le lien — { url, actif, fil } comme pour
// page(), et "ancre", l'id du bloc de documents où revenir.
function lienDocumentLie(ctx, parent, d) {
  const url = `${parent.url.replace(/\.html$/, '')}/${String(d.fichier).replace(/\./g, '-').toLowerCase()}.html`;
  ctx.documentsLies.set(url, { url, parent, d });
  return url;
}

/** Page d'un document lié (voir lienDocumentLie). */
export function pageDocumentLie(ctx, { parent, d }) {
  const titreParent = parent.fil.at(-1).libelle;
  const retour = `Retour à « ${titreParent} »`;
  return pageDocument(ctx, {
    d, titre: d.libelle, actif: parent.actif,
    meta: d.date ? `<span>${dateFr(d.date)}</span>` : '',
    retour: { url: `${parent.url}#${parent.ancre}`, bouton: retour, lien: retour },
    description: `${d.libelle} — ${titreParent}, commune de ${ctx.site.commune.nom} (${formatEtPoids(d)}).`,
    fil: [...parent.fil.slice(0, -1), { libelle: titreParent, url: parent.url }, { libelle: d.libelle }]
  });
}

// « PDF, 10,6 Mo » à côté du libellé : sur téléphone, l'habitant sait ce
// qu'il va ouvrir avant de toucher le lien.
function ligneDocument(ctx, parent, d) {
  return `<li><a href="${lienDocumentLie(ctx, parent, d)}">${icone('document', 'icone--mini')}<span>${esc(d.libelle)}</span> <span class="poids">${esc(formatEtPoids(d))}</span></a></li>`;
}

function blocDocuments(ctx, parent, items) {
  if (!items || !items.length) return '';
  return `<section class="documents" aria-labelledby="documents-titre">
    <h2 id="documents-titre">Documents à consulter</h2>
    <ul class="liste-documents">${items.map((d) => ligneDocument(ctx, { ...parent, ancre: 'documents-titre' }, d)).join('')}</ul>
  </section>`;
}

function blocLiens(meta) {
  if (!meta.liens) return '';
  const items = (Array.isArray(meta.liens) ? meta.liens : [meta.liens])
    .map((l) => {
      const [url, libelle, logo] = String(l).split('|').map((s) => s.trim());
      const contenu = logo
        ? `<img src="/img/${esc(logo)}" alt="${esc(libelle)}" loading="lazy">`
        : `<span>${esc(libelle)}</span>`;
      const classe = logo ? 'bouton logo-lien' : 'bouton bouton--secondaire';
      return `<li>${lien(url, contenu, { classe })}</li>`;
    }).join('');
  return `<section class="liens-utiles" aria-labelledby="liens-utiles-titre">
    <h2 id="liens-utiles-titre">Sites à consulter</h2>
    <ul class="liens-utiles__boutons">${items}</ul>
  </section>`;
}

// Prochains passages du car, affichés sur la page « Transports et
// déplacements » (content/pages/transports.md) quand site.json → transport
// est renseigné : ligne, arrêt, identifiant de l'arrêt côté Worker, lien vers
// les horaires officiels et départs théoriques (heure, direction, jours,
// arrêts desservis). Les horaires du site reflètent le rendu sans JavaScript
// et servent de repli si le Worker ne répond pas ; src/scripts/transport-lio.js
// interroge {administration.urlBase}/transport/<identifiant> pour superposer
// le temps réel officiel (retard, suppression). Le navigateur du visiteur
// n'appelle jamais directement un service de transport tiers.
function widgetTransportLio(ctx) {
  const t = ctx.site.transport;
  if (!t || !t.departs || !t.departs.length) return '';
  const urlApi = `${ctx.site.administration.urlBase}/transport/${t.identifiant}`;
  return `<section class="transport-lio" aria-labelledby="transport-lio-titre" data-api="${esc(urlApi)}">
    <h2 id="transport-lio-titre">Prochains passages — ${esc(t.ligne)}, arrêt « ${esc(t.arret)} »</h2>
    <ul class="transport-lio__liste">
      ${t.departs.map((d, i) => `<li class="transport-lio__depart" data-index="${i}">
        <span class="transport-lio__heure">${esc(d.heure)}</span>
        <span class="transport-lio__direction">${esc(d.direction)}</span>
        <span class="transport-lio__jours">${esc(d.joursTexte)}</span>
        <span class="transport-lio__statut" data-statut></span>
        ${(d.arrets || []).length ? `<details class="transport-lio__arrets">
          <summary>Arrêts desservis ensuite ${icone('chevron', 'transport-lio__chevron')}</summary>
          <ol>${d.arrets.map((a) => `<li>${esc(a)}</li>`).join('')}</ol>
        </details>` : ''}
      </li>`).join('')}
    </ul>
    <p class="transport-lio__note" data-note>Horaire théorique. ${t.lienHoraires ? lien(t.lienHoraires, 'Horaires complets et perturbations sur le site du réseau') : ''}.</p>
  </section>
  <script src="/assets/transport-lio.js" defer></script>`;
}

const nombreFr = (n, decimales = 2) => n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

// Hauteur du cours d'eau aux stations qui encadrent le village (site.json →
// riviere), sur la page « Risques et sécurité ». Sans JavaScript (ou si le Worker ne répond
// pas) : un lien vers la fiche Vigicrues de chaque station et les repères
// de crues historiques. Avec : src/scripts/vidourle.js interroge
// {administration.urlBase}/vidourle (worker/donnees-publiques.mjs, qui lit
// l'API publique Hub'Eau) et affiche la mesure, la tendance sur 3 heures
// et la courbe des dernières 24 heures. Comme pour les cars liO, le
// navigateur du visiteur n'appelle jamais directement un service tiers.
function widgetRiviere(ctx) {
  const config = ctx.site.riviere;
  if (!workerPret(ctx) || !config || !config.stations || !config.stations.length) return '';
  const urlApi = `${ctx.site.administration.urlBase}/vidourle`;
  return `<section class="direct" aria-labelledby="vidourle-titre" data-vidourle="${esc(urlApi)}">
    <h3 id="vidourle-titre">${esc(config.titreDirect || `${config.nom} en direct`)}</h3>
    <ul class="direct__stations">
      ${config.stations.map((s) => `<li class="station" data-station="${esc(s.code)}">
        <h4 class="station__nom">${esc(s.nom)}</h4>
        <p class="station__position">${esc(s.position)}</p>
        <p class="station__mesure" data-mesure>${lien(`https://www.vigicrues.gouv.fr/station/${s.code}`, `Hauteur actuelle à ${esc(s.nom)} sur Vigicrues`)}</p>
        <div class="station__courbe" data-courbe hidden></div>
        ${s.crues && s.crues.length ? `<p class="station__reperes">Pour comparer : ${s.crues.map((c) => `crue de ${esc(c.libelle)}, ${nombreFr(c.hauteur)} m`).join(' ; ')}.</p>` : ''}
      </li>`).join('')}
    </ul>
    <p class="direct__note" data-note>Hauteurs mesurées par les stations de l'État, toutes les 5 à 60 minutes. Le zéro de chaque échelle est conventionnel : seule compte la comparaison avec les crues passées. La couleur de vigilance crues officielle est publiée sur ${lien('https://www.vigicrues.gouv.fr/', 'vigicrues.gouv.fr')}.</p>
  </section>
  <script src="/assets/vidourle.js" defer></script>`;
}

// Restrictions d'eau en vigueur dans la commune, sur la page « Eau et
// assainissement ». Sans JavaScript : renvoi vers VigiEau, le service
// officiel. Avec : src/scripts/restrictions-eau.js lit
// {administration.urlBase}/eau/restrictions (worker/donnees-publiques.mjs,
// qui interroge l'API VigiEau avec le code Insee de la commune).
function widgetRestrictionsEau(ctx) {
  const urlApi = `${ctx.site.administration.urlBase}/eau/restrictions`;
  return `<section class="direct" aria-labelledby="secheresse-titre" ${workerPret(ctx) ? `data-restrictions="${esc(urlApi)}"` : ''}>
    <h3 id="secheresse-titre">Restrictions d'eau à ${esc(ctx.site.commune.nom)} aujourd'hui</h3>
    <div class="secheresse" data-contenu>
      <p>La situation du jour est publiée par l'État sur ${lien('https://vigieau.gouv.fr/', 'VigiEau')} : indiquez-y votre adresse pour connaître les usages autorisés.</p>
    </div>
    <p class="direct__note">Eau du robinet, usages des particuliers. Vous puisez dans un puits, un forage ou un cours d'eau&nbsp;? Les règles peuvent différer : vérifiez sur ${lien('https://vigieau.gouv.fr/', 'vigieau.gouv.fr')}.</p>
  </section>
  ${workerPret(ctx) ? '<script src="/assets/restrictions-eau.js" defer></script>' : ''}`;
}

// « Ma maison face aux risques », sur la page « Risques et sécurité ». Le
// formulaire ne sert qu'avec JavaScript (src/scripts/risques-adresse.js
// interroge {administration.urlBase}/risques/adresse, voir
// worker/risques-adresse.mjs) : il reste donc caché sans lui, et la section
// de la page renvoie alors vers Géorisques, le service officiel.
function widgetRisquesAdresse(ctx) {
  if (!workerPret(ctx)) return '';
  const urlApi = `${ctx.site.administration.urlBase}/risques/adresse`;
  return `<section class="direct" aria-labelledby="risques-adresse-titre" data-risques-adresse="${esc(urlApi)}" hidden>
    <h3 id="risques-adresse-titre">Les risques à mon adresse</h3>
    <form class="adresse-risques">
      <label for="risques-adresse-champ">Votre adresse à ${esc(ctx.site.commune.nom)}</label>
      <input type="text" id="risques-adresse-champ" name="q" required minlength="3" maxlength="200" autocomplete="street-address" placeholder="Ex. : ${esc(ctx.site.mairie.adresse.replace(/^.*— /, ''))}">
      <button type="submit" class="bouton bouton--principal">Voir les risques</button>
    </form>
    <div class="resultat-risques" data-resultat aria-live="polite"></div>
    <p class="direct__note">Votre adresse n'est pas conservée : elle sert seulement à interroger l'IGN et Géorisques, le temps de la réponse. Ce résumé ne remplace pas l'état des risques officiel.</p>
  </section>
  <script src="/assets/risques-adresse.js" defer></script>`;
}

// Qualité de l'eau du robinet, sur la page « Eau et assainissement ». Sans
// JavaScript : renvoi vers le site du ministère de la Santé, qui publie les
// résultats du contrôle sanitaire commune par commune. Avec :
// src/scripts/qualite-eau.js lit {administration.urlBase}/eau/qualite
// (worker/donnees-publiques.mjs, API Hub'Eau Qualité de l'eau potable).
function widgetQualiteEau(ctx) {
  const urlApi = `${ctx.site.administration.urlBase}/eau/qualite`;
  return `<section class="direct" aria-labelledby="qualite-eau-titre" ${workerPret(ctx) ? `data-qualite-eau="${esc(urlApi)}"` : ''}>
    <h3 id="qualite-eau-titre">Qualité de l'eau du robinet</h3>
    <div class="qualite-eau" data-contenu>
      <p>L'eau est contrôlée par l'Agence régionale de santé. Les résultats sont publiés commune par commune sur ${lien(`https://orobnat.sante.gouv.fr/orobnat/afficherPage.do?methode=menu&usd=AEP&idRegion=${esc(ctx.site.commune.codeRegion || '')}`, 'le site du ministère de la Santé')}.</p>
    </div>
    <p class="direct__note">Contrôle sanitaire officiel (ARS ${esc(ctx.site.commune.region)}), repris par Hub'Eau. Les limites de qualité protègent la santé ; les références de qualité sont des indicateurs du bon fonctionnement des installations.</p>
  </section>
  ${workerPret(ctx) ? '<script src="/assets/qualite-eau.js" defer></script>' : ''}`;
}

const texteDae = (d) => `${d.acces === 'extérieur' ? "À l'extérieur" : "À l'intérieur"}${d.precision ? ` (${esc(d.precision)})` : ''} · ${d.horaires ? `accessible ${esc(d.horaires)}` : "horaires d'accès non renseignés"}`;
const lienCarte = (d, texte) => lien(`https://www.openstreetmap.org/?mlat=${d.latitude}&mlon=${d.longitude}#map=18/${d.latitude}/${d.longitude}`, texte);

// Défibrillateurs de la commune et des environs (content/defibrillateurs.json,
// base nationale Géo'DAE relue chaque semaine par
// .github/workflows/donnees-publiques.yml) : celui de la commune d'abord,
// puis les plus proches, avec la distance depuis la mairie.
function blocDefibrillateurs(ctx) {
  const dae = ctx.defibrillateurs;
  if (!dae || !dae.defibrillateurs || !dae.defibrillateurs.length) return '';
  const ligne = (d) => `<li class="dae${d.dansLaCommune ? ' dae--lecques' : ''}">
      <p class="dae__lieu"><strong>${esc(d.commune)}</strong> — ${esc(d.adresse)}${d.dansLaCommune ? '' : ` <span class="dae__distance">à ${nombreFr(d.distanceKm, 1)} km</span>`}</p>
      <p class="dae__acces">${texteDae(d)}</p>
      <p class="dae__carte">${lienCarte(d, `Voir sur la carte<span class="sr-only"> le défibrillateur de ${esc(d.commune)}, ${esc(d.adresse)}</span>`)}</p>
    </li>`;
  return `<h2 id="defibrillateurs">Les défibrillateurs les plus proches</h2>
  <p>En cas d'arrêt cardiaque : <strong>appelez le 15</strong>, commencez le massage cardiaque et faites chercher un défibrillateur. L'appareil guide son utilisateur à la voix, pas à pas : il n'est pas nécessaire d'être formé pour s'en servir.</p>
  <ul class="liste-dae">${dae.defibrillateurs.map(ligne).join('')}</ul>
  <p class="note-source">Source : base nationale des défibrillateurs Géo'DAE, relue automatiquement chaque semaine (dernière mise à jour le ${dateFr(dae.misAJour)}). Un appareil manque ou a changé de place&nbsp;? <a href="mailto:${esc(ctx.site.mairie.email)}?subject=${encodeURIComponent('Défibrillateur')}">Signalez-le à la mairie</a>.</p>`;
}

function blocSansReseau() {
  return `<h2 id="sans-reseau">Même sans réseau</h2>
  <p>Pendant un épisode d'orage violent, d'incendie ou de crue, le réseau mobile est souvent saturé. Sur la plupart des téléphones et ordinateurs récents, cette page et la <a href="/mairie/fiche-pratique.html">fiche pratique</a> restent consultables sans connexion dès votre première visite sur le site. Pour ne dépendre de rien, imprimez la fiche pratique et gardez-la près du téléphone.</p>`;
}

// Insère le widget juste avant le prochain <h2> suivant l'ancre donnée (ou en
// fin de contenu s'il n'y en a pas) : place la carte des prochains passages à
// la fin de la section « Les cars liO » du Markdown, sans que ce dernier ait
// besoin de connaître le widget (le renderer Markdown maison n'a pas de
// mécanisme d'inclusion de blocs HTML arbitraires, voir src/markdown.mjs).
const tailleMo = (octets) => {
  const mo = octets / 1e6;
  return `${mo < 10 ? mo.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : Math.round(mo)} Mo`;
};
const TYPES_ZONE = [
  ['U', 'Zones urbaines'],
  ['AU', 'Zone à urbaniser'],
  ['A', 'Zones agricoles'],
  ['N', 'Zones naturelles'],
];

// Plan de zonage du PLU, sur la page « Urbanisme et PLU » et sur la fiche
// « Consulter le PLU ». Zones et contours viennent du Géoportail de
// l'urbanisme (tools/fetch-zonage.mjs, content/zonage-plu.json, simplifiés à
// 3 m près), le fond (contour de la commune, voirie, cours d'eau) de
// content/carte-fond.json : tout est dessiné ici en SVG, sans service de
// cartographie tiers. Une seule carte, toute la commune : un zoom sur le
// village, affiché en plus, passait pour un doublon. Chaque zone donne
// son nom au survol ; la légende, qui la décrit en toutes lettres et renvoie
// à la page du règlement qui la concerne, tient lieu d'alternative
// textuelle. Le plan officiel (PDF, lourd) reste en lien : c'est lui qui
// fait foi.

// Une carte du plan de zonage, cadrée sur "cadre" (lon/lat). "largeur" est
// celle du repère SVG : plus elle est petite, plus textes et traits
// paraissent grands une fois la carte mise à l'échelle de la page.
function dessinZonage(ctx, cadre, { largeur, tailleEtiquette, id, titre }) {
  const { zonage, carteFond, site } = ctx;
  const latRef = (cadre.minlat + cadre.maxlat) / 2;
  const mLat = 111320;
  const mLon = 111320 * Math.cos((latRef * Math.PI) / 180);
  const echelle = largeur / ((cadre.maxlon - cadre.minlon) * mLon);
  const hauteur = Math.round((cadre.maxlat - cadre.minlat) * mLat * echelle);
  const proj = ([lon, lat]) => [Math.round((lon - cadre.minlon) * mLon * echelle), Math.round((cadre.maxlat - lat) * mLat * echelle)];
  // Coordonnées entières, points confondus à l'arrondi retirés.
  const chemin = (anneau) => {
    const pts = [];
    for (const p of anneau) {
      const q = proj(p).join(',');
      if (pts[pts.length - 1] !== q) pts.push(q);
    }
    return `M${pts.join('L')}Z`;
  };
  const ligne = (points) => points.map((p) => proj(p).join(',')).join(' ');

  const zonesSvg = zonage.zones.map((z) => z.polygones.map((poly) => (
    `<path class="plan-zonage__zone plan-zonage__zone--${esc(z.type.toLowerCase())}" data-code="${esc(z.code)}" data-intitule="${esc(z.description)}" d="${poly.anneaux.map(chemin).join('')}"><title>${esc(z.code)} — ${esc(z.description)}</title></path>`
  )).join('')).join('');
  // Une étiquette seulement là où la zone a la place de la porter (rayon
  // libre autour du point, calculé par tools/fetch-zonage.mjs).
  const etiquettesSvg = zonage.zones.flatMap((z) => z.polygones
    .filter((p) => p.etiquette && p.rayonM * echelle >= tailleEtiquette * 0.9)
    .map((p) => {
      const [x, y] = proj(p.etiquette);
      return `<text x="${x}" y="${y}">${esc(z.code)}</text>`;
    })).join('');
  const [mx, my] = proj([site.mairie.longitude, site.mairie.latitude]);

  return `<svg viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-labelledby="${id}">
          <title id="${id}">${esc(titre)}</title>
          <g>${zonesSvg}</g>
          <g class="carte-lecques__routes">${carteFond.routes.map((r) => `<polyline points="${ligne(r.points)}"/>`).join('')}</g>
          <g class="carte-lecques__riviere">${(carteFond.riviere || []).map((r) => `<polyline points="${ligne(r)}"/>`).join('')}</g>
          <polygon class="plan-zonage__contour" points="${ligne(carteFond.communeContour)}"/>
          <circle cx="${mx}" cy="${my}" r="${Math.round(tailleEtiquette / 3)}" class="carte-lecques__mairie-halo"/><circle cx="${mx}" cy="${my}" r="${Math.round(tailleEtiquette / 7)}" class="carte-lecques__mairie-point"/>
          <g class="plan-zonage__etiquettes" font-size="${tailleEtiquette}">${etiquettesSvg}</g>
        </svg>`;
}

function planZonage(ctx, { niveau = 3, fiche = false } = {}) {
  const { zonage, carteFond } = ctx;
  if (!zonage || !zonage.zones || !zonage.zones.length || !carteFond || !carteFond.bbox) return '';

  const doc = zonage.document || {};
  const reglement = doc.reglement;
  const h = `h${niveau}`;
  const hLegende = `h${niveau + 1}`;
  const legende = TYPES_ZONE.map(([type, titre]) => {
    const zones = zonage.zones.filter((z) => z.type === type);
    if (!zones.length) return '';
    return `<div>
      <${hLegende}>${esc(titre)}</${hLegende}>
      <dl>${zones.map((z) => `<div>
        <dt><span class="plan-zonage__puce plan-zonage__puce--${esc(type.toLowerCase())}" aria-hidden="true"></span>${esc(z.code)}</dt>
        <dd>${esc(z.description)}.${reglement && z.page ? ` ${lien(`${reglement.url}#page=${z.page}`, `Règlement, page ${z.page}`)}` : ''}</dd>
      </div>`).join('')}</dl>
    </div>`;
  }).join('');

  const approbation = doc.approbation
    ? new Date(`${doc.approbation}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : null;
  const pieces = [
    ...(doc.planches || []).map((p) => {
      const numero = (String(p.titre).match(/(\d+)\s*$/) || [])[1];
      return lien(p.url, `plan de zonage${numero ? `, planche ${numero}` : ''} (PDF${p.taille ? `, ${tailleMo(p.taille)}` : ''})`);
    }),
    ...(reglement ? [lien(reglement.url, `règlement écrit (PDF${reglement.taille ? `, ${tailleMo(reglement.taille)}` : ''})`)] : []),
  ];

  return `<section class="plan-zonage${fiche ? ' fiche__bloc' : ''}" aria-labelledby="plan-zonage-titre">
    <${h} id="plan-zonage-titre">Le plan de zonage</${h}>
    <div class="plan-zonage__duo">
      <figure class="plan-zonage__carte">
        ${dessinZonage(ctx, carteFond.bbox, { largeur: 700, tailleEtiquette: 26, id: 'plan-zonage-commune', titre: `Plan de zonage de toute la commune de ${ctx.site.commune.nom}, par type de zone. Détail de chaque zone dans la légende.` })}
        <figcaption>Survolez ou touchez une zone pour son intitulé complet. Le point noir marque la mairie${(ctx.site.riviere || {}).nom ? `, le trait bleu ${esc(ctx.site.riviere.nom)}` : ''} ; chaque zone est décrite dans la légende.</figcaption>
      </figure>
      <div class="plan-zonage__legende">${legende}</div>
    </div>
    <p class="carte__detail">Plan simplifié, d'après le Géoportail de l'urbanisme.${pieces.length ? ` Le plan officiel${approbation ? `, approuvé le ${esc(approbation)},` : ''} fait foi : ${pieces.join(' · ')}.` : ''}</p>
    <p class="carte__detail">Pour connaître la zone d'une adresse précise : <a href="/cadre-de-vie/risques.html#ma-maison-face-aux-risques">Ma maison face aux risques</a>.</p>
  </section>
  <script src="/assets/plan-zonage.js" defer></script>`;
}

// Carte « Autour de <commune> », sur la page Tourisme : sites, monuments et
// randonnées à moins de 30 minutes en voiture (content/tourisme-sites.json).
// Le fond (routes, rivières, villages, voie verte) et le temps de trajet
// depuis la mairie sont relevés une fois pour toutes dans OpenStreetMap et
// auprès de l'IGN (tools/fetch-carte-tourisme.mjs, content/carte-tourisme.json) :
// tout est dessiné ici en SVG, sans service de cartographie tiers. Les
// repères sont des liens HTML posés par-dessus, vers la fiche du site dans
// la liste qui suit la carte : sans JavaScript, c'est elle qui décrit
// chaque site et mène à son site officiel. src/scripts/carte-tourisme.js
// en fait une infobulle, ouverte au survol, au clic, au toucher ou au clavier.
const TYPES_TOURISME = [
  ['site', 'Sites et monuments'],
  ['rando', 'Randonnées balisées'],
];
const LARGEUR_TOURISME = 640; // repère SVG ; la carte s'affiche entre 36 et 42 rem de large

// « À 7,1 km de la mairie, environ 15 min en voiture » : au-delà de 10
// minutes, arrondi aux 5 minutes, l'heure de départ et la circulation
// comptant plus que la minute près.
function trajetTourisme(s, trajet) {
  if (!trajet) return '';
  const km = trajet.km.toLocaleString('fr-FR', { maximumFractionDigits: trajet.km < 10 ? 1 : 0 });
  const minutes = trajet.minutes < 10 ? `${Math.max(1, trajet.minutes)} min` : `environ ${Math.round(trajet.minutes / 5) * 5} min`;
  return `${s.type === 'rando' ? 'Départ à' : 'À'} ${km} km de la mairie, ${minutes} en voiture`;
}

// Espaces insécables entre un nombre et son unité (« 5,4 km », « 1 h 30 »,
// « 17,6 °C ») : ils ne se séparent pas en fin de ligne.
const insecables = (texte) => texte
  .replace(/(\d) (?=[a-zA-Z°]{1,3}\b)/g, '$1 ')
  .replace(/(\d) h (?=\d)/g, '$1 h ');

// Le fond de carte et ses repères. "numeros" donne le numéro affiché de
// chaque site, le même que dans la liste.
function planTourisme(ctx, sites, numeros) {
  const { carteTourisme: fond, carteFond, site } = ctx;
  const { bbox } = fond;
  const latRef = (bbox.minlat + bbox.maxlat) / 2;
  const mLat = 111320;
  const mLon = 111320 * Math.cos((latRef * Math.PI) / 180);
  const echelle = LARGEUR_TOURISME / ((bbox.maxlon - bbox.minlon) * mLon);
  const L = LARGEUR_TOURISME;
  const H = Math.round((bbox.maxlat - bbox.minlat) * mLat * echelle);
  const proj = ([lon, lat]) => [Math.round((lon - bbox.minlon) * mLon * echelle), Math.round((bbox.maxlat - lat) * mLat * echelle)];
  // Coordonnées entières, points confondus à l'arrondi retirés.
  const ligne = (points) => {
    const pts = [];
    for (const p of points) {
      const q = proj(p).join(',');
      if (pts[pts.length - 1] !== q) pts.push(q);
    }
    return pts.length > 1 ? `<polyline points="${pts.join(' ')}"/>` : '';
  };
  const lignes = (liste) => (liste || []).map(ligne).join('');

  // Repères : un rond (site) ou un carré (randonnée) de 28 px, numéroté.
  // Deux sites trop proches (deux sites à un kilomètre l'un de l'autre) se
  // chevaucheraient : on les écarte juste assez, et un trait fin relie le
  // repère déplacé à son emplacement exact. La mairie ne se couvre pas.
  const RAYON = 15, ECART = 32;
  const [mx, my] = proj([site.mairie.longitude, site.mairie.latitude]);
  const reperes = sites.map((s) => {
    const [x, y] = proj(s.position);
    return { s, x0: x, y0: y, x, y };
  });
  const borner = (v, max) => Math.min(Math.max(v, RAYON + 2), max - RAYON - 2);
  for (let tour = 0; tour < 80; tour++) {
    let bouge = false;
    for (let i = 0; i < reperes.length; i++) {
      const a = reperes[i];
      const dm = Math.hypot(a.x - mx, a.y - my) || 1;
      if (dm < ECART * 0.75) {
        const p = ECART * 0.75 - dm;
        a.x += ((a.x - mx) / dm) * p; a.y += ((a.y - my) / dm) * p; bouge = true;
      }
      for (let j = i + 1; j < reperes.length; j++) {
        const b = reperes[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= ECART) continue;
        if (d === 0) { dx = 0; dy = 1; d = 1; }
        const p = (ECART - d) / 2;
        a.x -= (dx / d) * p; a.y -= (dy / d) * p;
        b.x += (dx / d) * p; b.y += (dy / d) * p;
        bouge = true;
      }
    }
    for (const r of reperes) { r.x = borner(r.x, L); r.y = borner(r.y, H); }
    if (!bouge) break;
  }
  for (const r of reperes) { r.x = Math.round(r.x); r.y = Math.round(r.y); }
  const renvois = reperes
    .filter((r) => Math.hypot(r.x - r.x0, r.y - r.y0) > 4)
    .map((r) => `<line x1="${r.x0}" y1="${r.y0}" x2="${r.x}" y2="${r.y}"/><circle cx="${r.x0}" cy="${r.y0}" r="2.5"/>`)
    .join('');

  // Noms de villages : la commune d'abord, puis ceux qui accueillent un site,
  // puis les plus peuplés, chacun là où il ne recouvre ni un repère ni un
  // autre nom ; sinon, il n'est pas écrit.
  const communes = new Set(sites.map((s) => s.commune));
  const candidats = [
    { nom: site.commune.nom, position: [site.mairie.longitude, site.mairie.latitude], lecques: true },
    ...(fond.lieux || []).filter((l) => l.nom !== site.commune.nom && communes.has(l.nom)),
    ...(fond.lieux || []).filter((l) => l.nom !== site.commune.nom && !communes.has(l.nom) && l.population >= 1500),
  ];
  const posees = [];
  const libre = (rect) => rect.x1 >= 2 && rect.x2 <= L - 2 && rect.y1 >= 2 && rect.y2 <= H - 2
    && !posees.some((p) => rect.x1 < p.x2 && rect.x2 > p.x1 && rect.y1 < p.y2 && rect.y2 > p.y1)
    && !reperes.some((r) => r.x + RAYON + 2 > rect.x1 && r.x - RAYON - 2 < rect.x2 && r.y + RAYON + 2 > rect.y1 && r.y - RAYON - 2 < rect.y2);
  const noms = [];
  for (const c of candidats) {
    const [x, y] = proj(c.position);
    const taille = c.lecques ? 14 : 12;
    const largeur = c.nom.length * taille * 0.52 + 2;
    // À droite, à gauche, dessus, dessous ; puis, si un repère est posé sur
    // le village, les mêmes positions et les
    // diagonales, au-delà de lui.
    const essais = [6, RAYON + 6, 2 * RAYON + 6].flatMap((d) => [
      { tx: x + d, ty: y + taille * 0.35, ancre: 'start', x1: x + d - 1, x2: x + d + largeur, y1: y - taille * 0.65 },
      { tx: x - d, ty: y + taille * 0.35, ancre: 'end', x1: x - d - largeur, x2: x - d + 1, y1: y - taille * 0.65 },
      { tx: x, ty: y - d - 1, ancre: 'middle', x1: x - largeur / 2, x2: x + largeur / 2, y1: y - d - 1 - taille },
      { tx: x, ty: y + d + taille, ancre: 'middle', x1: x - largeur / 2, x2: x + largeur / 2, y1: y + d },
      ...(d > 6 ? [
        { tx: x + d * 0.7, ty: y - d * 0.7, ancre: 'start', x1: x + d * 0.7 - 1, x2: x + d * 0.7 + largeur, y1: y - d * 0.7 - taille },
        { tx: x - d * 0.7, ty: y - d * 0.7, ancre: 'end', x1: x - d * 0.7 - largeur, x2: x - d * 0.7 + 1, y1: y - d * 0.7 - taille },
        { tx: x + d * 0.7, ty: y + d * 0.7 + taille, ancre: 'start', x1: x + d * 0.7 - 1, x2: x + d * 0.7 + largeur, y1: y + d * 0.7 },
        { tx: x - d * 0.7, ty: y + d * 0.7 + taille, ancre: 'end', x1: x - d * 0.7 - largeur, x2: x - d * 0.7 + 1, y1: y + d * 0.7 },
      ] : []),
    ]);
    const retenu = essais.find((e) => libre({ x1: e.x1, x2: e.x2, y1: e.y1, y2: e.y1 + taille + 1 }));
    if (!retenu) continue;
    posees.push({ x1: retenu.x1, x2: retenu.x2, y1: retenu.y1, y2: retenu.y1 + taille + 1 });
    const point = c.lecques ? '' : `<circle cx="${x}" cy="${y}" r="2.5"/>`;
    noms.push(`${point}<text x="${retenu.tx}" y="${Math.round(retenu.ty)}"${retenu.ancre === 'start' ? '' : ` text-anchor="${retenu.ancre}"`}${c.lecques ? ' class="carte-tourisme__lecques"' : ''}>${esc(c.nom)}</text>`);
  }

  // Échelle de 5 km, en bas à gauche.
  const cinqKm = Math.round(5000 * echelle);
  const echelleSvg = `<g class="carte-tourisme__echelle"><path d="M12 ${H - 18}v6h${cinqKm}v-6"/><text x="${12 + cinqKm / 2}" y="${H - 22}" text-anchor="middle">5 km</text></g>`;

  const contour = carteFond && carteFond.communeContour
    ? `<polygon class="carte-lecques__contour" points="${carteFond.communeContour.map((p) => proj(p).join(',')).join(' ')}"/>`
    : '';
  const rivieres = fond.rivieres || [];
  const traces = sites.filter((s) => fond.traces && fond.traces[s.id]).map((s) => lignes(fond.traces[s.id])).join('');

  const nbSites = sites.filter((s) => s.type === 'site').length;
  const nbRandos = sites.length - nbSites;
  const pct = (v, total) => Math.round((v / total) * 10000) / 100;
  const marqueurs = reperes.map((r) => {
    const { s } = r;
    return `<li style="left:${pct(r.x, L)}%;top:${pct(r.y, H)}%"><a class="carte-tourisme__repere carte-tourisme__repere--${esc(s.type)}" href="#tourisme-${esc(s.id)}" data-site="${esc(s.id)}"><span aria-hidden="true">${numeros.get(s.id)}</span><span class="sr-only">${esc(s.nom)}${s.type === 'rando' ? ', randonnée' : ''}</span></a></li>`;
  }).join('');

  return `<div class="carte-tourisme__cadre">
      <div class="carte-tourisme__plan" data-centre="${pct(mx, L)}">
        <svg viewBox="0 0 ${L} ${H}" role="img" aria-labelledby="carte-tourisme-titre">
          <title id="carte-tourisme-titre">Carte des environs de ${esc(site.commune.nom)} : ${nbSites} sites et monuments et ${nbRandos} randonnées à moins de 30 minutes en voiture, décrits dans la liste qui suit la carte.</title>
          ${contour}
          <g class="carte-tourisme__limite">${lignes(fond.departements)}</g>
          <g class="carte-tourisme__rivieres">${rivieres.filter((r) => !r.principale).map((r) => lignes(r.lignes)).join('')}</g>
          <g class="carte-lecques__riviere">${rivieres.filter((r) => r.principale).map((r) => lignes(r.lignes)).join('')}</g>
          <g class="carte-tourisme__routes carte-tourisme__routes--locale">${lignes(fond.routes && fond.routes.locale)}</g>
          <g class="carte-tourisme__routes">${lignes(fond.routes && fond.routes.principale)}</g>
          <g class="carte-tourisme__routes carte-tourisme__routes--autoroute">${lignes(fond.routes && fond.routes.autoroute)}</g>
          <g class="carte-tourisme__trace">${traces}</g>
          <g class="carte-tourisme__renvois">${renvois}</g>
          <circle cx="${mx}" cy="${my}" r="7" class="carte-lecques__mairie-halo"/><circle cx="${mx}" cy="${my}" r="3.5" class="carte-lecques__mairie-point"/>
          <g class="carte-tourisme__noms">${noms.join('')}</g>
          ${echelleSvg}
        </svg>
        <ol class="carte-tourisme__reperes" aria-label="Repères de la carte">${marqueurs}</ol>
      </div>
    </div>`;
}

function carteTourisme(ctx) {
  const { tourismeSites, carteTourisme: fond } = ctx;
  if (!tourismeSites || !tourismeSites.sites || !tourismeSites.sites.length) return '';
  const trajets = (fond && fond.trajets) || {};
  // Numérotés dans l'ordre d'affichage : les sites, puis les randonnées.
  const groupes = TYPES_TOURISME
    .map(([type, titre]) => ({ type, titre, sites: tourismeSites.sites.filter((s) => s.type === type) }))
    .filter((g) => g.sites.length);
  const sites = groupes.flatMap((g) => g.sites);
  const numeros = new Map(sites.map((s, i) => [s.id, i + 1]));

  const fiche = (s) => `<li id="tourisme-${esc(s.id)}" class="tourisme-site tourisme-site--${esc(s.type)}">
        <span class="tourisme-site__numero" aria-hidden="true">${numeros.get(s.id)}</span>
        <div class="tourisme-site__corps">
          <h4 class="tourisme-site__nom">${esc(s.nom)}</h4>
          <p class="tourisme-site__infos">${insecables([s.commune, s.parcours].filter(Boolean).map(esc).join(' · '))}${trajets[s.id] ? `<br>${insecables(esc(trajetTourisme(s, trajets[s.id])))}` : ''}</p>
          <p>${insecables(esc(s.description))}</p>
          <p class="tourisme-site__lien">${lien(s.url, `${esc(s.source)}<span class="sr-only"> : ${esc(s.nom)}</span>`)}</p>
        </div>
      </li>`;
  const listes = groupes.map((g) => `<h3>${esc(g.titre)}</h3>
    <ol class="tourisme-sites"${numeros.get(g.sites[0].id) > 1 ? ` start="${numeros.get(g.sites[0].id)}"` : ''}>
      ${g.sites.map(fiche).join('')}
    </ol>`).join('');

  const avecTrace = sites.some((s) => fond && fond.traces && fond.traces[s.id]);
  const carte = fond && fond.bbox
    ? `<figure class="carte-tourisme__figure">
      ${planTourisme(ctx, sites, numeros)}
      <template id="carte-tourisme-fermer"><button type="button" class="infobulle-tourisme__fermer">${icone('fermer')}<span class="sr-only">Fermer</span></button></template>
      <figcaption>
        <p class="carte-tourisme__glisser">Faites glisser la carte pour voir tous les repères.</p>
        <p class="carte-lecques__legende">
          <span><span class="carte-tourisme__puce carte-tourisme__puce--site" aria-hidden="true"></span>Site ou monument</span>
          <span><span class="carte-tourisme__puce carte-tourisme__puce--rando" aria-hidden="true"></span>Départ de randonnée</span>
          ${avecTrace ? '<span><span class="carte-lecques__trait carte-tourisme__trait--trace" aria-hidden="true"></span>Voie verte</span>' : ''}
          <span><span class="carte-lecques__puce carte-lecques__puce--mairie" aria-hidden="true"></span>Mairie de ${esc(ctx.site.commune.nom)}</span>
          ${(ctx.site.riviere || {}).nom ? `<span><span class="carte-lecques__trait carte-lecques__trait--riviere" aria-hidden="true"></span>${esc(ctx.site.riviere.nom)}</span>` : ''}
          ${ctx.site.commune.limiteDepartements ? `<span><span class="carte-lecques__trait carte-tourisme__trait--limite" aria-hidden="true"></span>${esc(ctx.site.commune.limiteDepartements)}</span>` : ''}
        </p>
        <p class="carte__detail">Touchez ou survolez un repère pour sa description et le lien vers son site officiel. Fond de carte : ${lien('https://www.openstreetmap.org/copyright', 'les contributeurs d’OpenStreetMap')} ; temps de trajet calculés depuis la mairie avec l'itinéraire de l'IGN.</p>
      </figcaption>
    </figure>`
    : '';

  return `<div class="carte-tourisme" data-carte-tourisme>
    ${carte}
    ${listes}
  </div>
  ${carte ? '<script src="/assets/carte-tourisme.js" defer></script>' : ''}`;
}

function insererApresSection(html, ancreSection, widget) {
  const debut = html.indexOf(`id="${ancreSection}"`);
  if (debut === -1) return html + widget;
  const prochainH2 = html.indexOf('<h2', html.indexOf('</h2>', debut));
  return prochainH2 === -1
    ? html + widget
    : html.slice(0, prochainH2) + widget + html.slice(prochainH2);
}

export function pageMarkdown(ctx, p) {
  const { site, nav } = ctx;
  let { html, sommaire } = rendre(p.corps);
  if (p.slug === 'transports') html = insererApresSection(html, 'les-cars-lio', widgetTransportLio(ctx));
  if (p.slug === 'urbanisme') html = insererApresSection(html, 'avant-tout-projet-consultez-le-plu', planZonage(ctx));
  if (p.slug === 'tourisme') html = insererApresSection(html, `autour-de-${site.commune.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`, carteTourisme(ctx));
  if (p.slug === 'eau') {
    html = insererApresSection(html, 'l-eau-potable', widgetQualiteEau(ctx));
    html = insererApresSection(html, 'preserver-la-ressource', widgetRestrictionsEau(ctx));
  }
  if (p.slug === 'risques') {
    html = insererApresSection(html, (site.riviere && site.riviere.ancre) || 'les-cours-d-eau', widgetRiviere(ctx));
    html = insererApresSection(html, 'ma-maison-face-aux-risques', widgetRisquesAdresse(ctx));
    const dae = blocDefibrillateurs(ctx);
    html += dae + blocSansReseau();
    sommaire = [
      ...sommaire,
      ...(dae ? [{ id: 'defibrillateurs', texte: 'Défibrillateurs' }] : []),
      { id: 'sans-reseau', texte: 'Même sans réseau' }
    ];
  }
  const rub = nav.find((n) => n.id === p.meta.rubrique);
  const fil = [{ libelle: 'Accueil', url: '/' }];
  if (rub) fil.push({ libelle: rub.libelle, url: rub.url });
  fil.push({ libelle: p.meta.titre });

  // "bulletins" est une clé plate (comme "budgets"), pas "pages/bulletins" :
  // voir CLAUDE.md « Ajouter un document » et worker/README.md.
  // Le plus récent en premier, d'après la date de parution. Le Worker ajoute
  // chaque dépôt en fin de registre, sans date si le formulaire n'en a pas
  // reçu (elle y est facultative) : un numéro sans date est le dernier
  // déposé, il passe donc en tête.
  const documentsBulletins = p.slug === 'bulletins'
    ? [...((ctx.documents && ctx.documents.bulletins) || [])].sort((a, b) => (b.date || '9999').localeCompare(a.date || '9999'))
    : [];
  const documents = [
    ...normaliserDocuments(p.meta.documents),
    ...documentsBulletins,
    ...((ctx.documents && ctx.documents[`pages/${p.slug}`]) || []),
  ];

  const contenu = `<div class="conteneur conteneur--etroit">
  <article class="article">
    ${banniereMuette(ctx, p.meta.photo, p.meta.photoAlt, p.meta.photoCredit)}
    <header class="page-entete">
      <h1>${esc(p.meta.titre)}</h1>
      ${p.meta.description ? `<p class="page-entete__intro">${esc(p.meta.description)}</p>` : ''}
    </header>
    <div class="prose">${html}</div>
    ${blocLiens(p.meta)}
    ${blocDocuments(ctx, { url: p.url, actif: p.meta.rubrique, fil }, documents)}
  </article>
</div>`;

  return page({
    site, nav, actif: p.meta.rubrique, titre: p.meta.titre,
    description: p.meta.description, fil, contenu, sommaire
  });
}

export function rubriqueIndex(ctx, rub, entrees) {
  const { site, nav } = ctx;
  const contenu = `<div class="conteneur">
  ${banniereMuette(ctx, rub.photo, rub.photoAlt, rub.photoCredit)}
  <header class="page-entete">
    <h1>${esc(rub.libelle)}</h1>
    <p class="page-entete__intro">${esc(rub.description)}</p>
  </header>
  <ul class="grille-cartes grille-cartes--large">
    ${entrees.map(carteRubrique).join('')}
  </ul>
</div>`;
  return page({
    site, nav, actif: rub.id, titre: rub.libelle, description: rub.description,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: rub.libelle }],
    contenu
  });
}

function carteRubrique(c) {
  if (c.liens) {
    return `<li class="carte">
      <h2 class="carte__titre">${esc(c.libelle)}${c.compteur != null ? ` <span class="compteur" title="${c.compteur} acteur${c.compteur > 1 ? 's' : ''} économique${c.compteur > 1 ? 's' : ''} recensé${c.compteur > 1 ? 's' : ''} (répertoire Sirene)">${c.compteur}</span>` : ''}</h2>
      ${c.resume ? `<p class="carte__resume">${esc(c.resume)}</p>` : ''}
      <ul class="carte__liens">
        ${c.liens.map((l) => `<li><a class="carte__lien" href="${esc(l.url)}">${icone('fleche')}<span>${esc(l.libelle)}</span></a></li>`).join('')}
      </ul>
    </li>`;
  }
  const titreCompteur = c.compteurTitre || `${c.compteur} actualité${c.compteur > 1 ? 's' : ''} en cours`;
  return `<li class="carte">
      <h2 class="carte__titre"><a href="${esc(c.url)}">${esc(c.libelle)}</a>${c.compteur != null ? ` <span class="compteur" title="${esc(titreCompteur)}">${c.compteur}</span>` : ''}</h2>
      ${c.resume ? `<p class="carte__resume">${esc(c.resume)}</p>` : ''}
      ${c.actionSecondaire ? `<p class="carte__action"><a class="carte__lien" href="${esc(c.actionSecondaire.url)}">${icone(c.actionSecondaire.icone || 'courriel')}<span>${esc(c.actionSecondaire.libelle)}</span></a></p>` : ''}
    </li>`;
}

/* ------------------------------------------------------------ Actualités */

export function listeActualites(ctx) {
  const { site, nav, actualites } = ctx;
  const unes = actualites.filter((a) => a.epingle);
  const autres = actualites.filter((a) => !a.epingle);
  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <h1>Actualités <span class="compteur" title="${actualites.length} actualité${actualites.length > 1 ? 's' : ''} en cours">${actualites.length}</span></h1>
    <p class="page-entete__intro">La vie de la commune, les décisions et les informations pratiques.</p>
  </header>
  ${unes.length ? `<ul class="liste-actus liste-actus--une">${unes.map((a) => carteActu(a, { titreTag: 'h2' })).join('')}</ul>` : ''}
  <ul class="grille-actus">${autres.map((a) => carteActu(a, { titreTag: 'h2' })).join('')}</ul>
  <aside class="encadre">
    <h2>Vous organisez un événement&nbsp;?</h2>
    <p>Associations, écoles, habitants : signalez votre manifestation au secrétariat de mairie pour la faire figurer dans les actualités et dans le bulletin municipal.</p>
    <p><a class="bouton bouton--secondaire" href="mailto:${esc(site.mairie.email)}?subject=Annonce%20pour%20les%20actualit%C3%A9s">${icone('courriel')}<span>Annoncer un événement</span></a></p>
  </aside>
</div>`;
  return page({
    site, nav, actif: 'vie-locale', titre: 'Actualités',
    description: `Les actualités de la commune de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Vie locale', url: '/vie-locale/' }, { libelle: 'Actualités' }],
    contenu
  });
}

export function articleActualite(ctx, a) {
  const { site, nav } = ctx;
  // Gras, italique, listes, liens et retours à la ligne saisis dans le
  // formulaire d'administration (voir src/texte-actualite.mjs).
  const corps = a.corps ? texteActualiteEnHtml(a.corps, { lien: (url, html) => lien(url, html) }) : '';
  const fil = [{ libelle: 'Accueil', url: '/' }, { libelle: 'Actualités', url: '/vie-locale/actualites.html' }, { libelle: a.titre }];
  const parent = { url: `/vie-locale/actualites/${a.id}.html`, actif: 'vie-locale', fil, ancre: 'pour-aller-plus-loin' };
  // Un PDF joint s'ouvre dans sa page du site (voir lienDocumentLie).
  const lienSuite = (l) => {
    if (l.type === 'externe') return lien(l.url, esc(l.libelle));
    if (l.type !== 'document' || !String(l.url).startsWith('/documents/')) return `<a href="${esc(l.url)}">${esc(l.libelle)}</a>`;
    const d = { fichier: decodeURIComponent(l.url.slice('/documents/'.length)), libelle: l.libelle, octets: l.octets };
    return `<a href="${lienDocumentLie(ctx, parent, d)}">${esc(l.libelle)}</a> <span class="mention-fichier">(PDF${l.octets ? `, ${poidsFichier(l.octets)}` : ''})</span>`;
  };
  const contenu = `<div class="conteneur conteneur--etroit">
  <article class="article">
    <header class="page-entete">
      <p class="carte__meta"><span class="etiquette">${esc(a.categorie)}</span>${(a.themes || []).map((t) => ` <span class="etiquette">${esc(t)}</span>`).join('')} ${periodeActu(a)}</p>
      <h1>${esc(a.titre)}</h1>
    </header>
    <h2 class="sr-only">Détail de l'actualité</h2>
    <div class="article__corps">
      ${a.image ? `<figure class="article__image">
        <img src="${esc(a.image.chemin)}" alt="${esc(a.image.alt)}">
        <figcaption><a href="${esc(a.image.cheminOriginal)}" data-photo-zoom>Voir la photo en taille réelle</a>${a.image.credit ? `
          <span class="article__credit">Photo : ${a.image.source ? lien(a.image.source, esc(a.image.credit)) : esc(a.image.credit)}</span>` : ''}</figcaption>
      </figure>` : ''}
      ${a.chapeau ? `<p class="page-entete__intro">${esc(a.chapeau)}</p>` : ''}
      ${corps ? `<div class="prose">${corps}</div>` : ''}
    </div>
    ${a.dateDebut ? `<p class="article__agenda"><a class="bouton bouton--secondaire" href="/vie-locale/actualites/${esc(a.id)}.ics" download>${icone('horloge')}<span>Ajouter à mon agenda</span></a></p>` : ''}
    ${a.liens && a.liens.length ? `<nav class="liens-suite" aria-label="Pour aller plus loin">
      <h2 id="pour-aller-plus-loin">Pour aller plus loin</h2>
      <ul>${a.liens.map((l) => `<li>${lienSuite(l)}</li>`).join('')}</ul>
    </nav>` : ''}
    <p class="retour"><a href="/vie-locale/actualites.html">${icone('fleche')}<span>Toutes les actualités</span></a></p>
  </article>
</div>${a.image ? `<script src="/assets/photo.js" defer></script>` : ''}`;
  return page({
    site, nav, actif: 'vie-locale', titre: a.titre, description: a.chapeau,
    fil,
    contenu
  });
}

export function listeConsultations(ctx) {
  const { site, nav, consultations } = ctx;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const parEtat = (etat) => consultations.filter((c) => etatConsultation(c, aujourdhui) === etat);
  const enCours = [...parEtat('ouverte'), ...parEtat('a-venir')].sort((a, b) => a.dateFin.localeCompare(b.dateFin));
  const terminees = parEtat('terminee').sort((a, b) => b.dateFin.localeCompare(a.dateFin));
  const uneOuverte = parEtat('ouverte').sort((a, b) => a.dateFin.localeCompare(b.dateFin))[0];

  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <h1>🗣️ Consultations citoyennes</h1>
    <p class="page-entete__intro">Donnez votre avis sur les projets et décisions qui concernent le village.</p>
  </header>

  ${uneOuverte ? `<section class="carte carte--consultation-une" aria-labelledby="consultation-une-titre">
    <p class="carte__meta">${badgeEtatConsultation('ouverte')} <span class="etiquette">${esc(uneOuverte.theme)}</span></p>
    <h2 id="consultation-une-titre">${esc(uneOuverte.question)}</h2>
    ${uneOuverte.chapeau ? `<p>${esc(uneOuverte.chapeau)}</p>` : ''}
    <p><a class="bouton bouton--principal" href="/vie-locale/consultations/${esc(uneOuverte.id)}.html">${icone('fleche')}<span>Participer à la consultation</span></a></p>
    <p class="pied__note">${periodeConsultation(uneOuverte, 'ouverte')}</p>
  </section>` : ''}

  <section class="section" aria-labelledby="consultations-titre">
    <h2 id="consultations-titre">Consultations en cours</h2>
    ${enCours.length
      ? `<ul class="grille-cartes">${enCours.map((c) => carteConsultation(c, aujourdhui)).join('')}</ul>`
      : '<p>Aucune consultation en cours pour le moment.</p>'}
  </section>

  ${terminees.length ? `<section class="section" aria-labelledby="consultations-terminees-titre">
    <h2 id="consultations-terminees-titre">Consultations terminées</h2>
    <ul class="grille-cartes">${terminees.map((c) => carteConsultation(c, aujourdhui)).join('')}</ul>
  </section>` : ''}
</div>`;
  return page({
    site, nav, actif: 'vie-locale', titre: 'Consultations citoyennes',
    description: `Les consultations citoyennes en cours et passées à ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Vie locale', url: '/vie-locale/' }, { libelle: 'Consultations citoyennes' }],
    contenu
  });
}

export function pageConsultation(ctx, c) {
  const { site, nav } = ctx;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const etat = etatConsultation(c, aujourdhui);
  const urlBase = site.administration.urlBase;
  const urlVoter = `${urlBase}/consultation/${encodeURIComponent(c.id)}/voter`;
  const urlResultats = `${urlBase}/consultation/${encodeURIComponent(c.id)}/resultats`;

  const formulaireVote = etat === 'ouverte' ? `
    <form class="vote-options" method="post" action="${esc(urlVoter)}">
      <fieldset>
        <legend>${esc(c.question)}</legend>
        ${c.options.map((o, i) => `<label class="vote-options__option">
          <input type="radio" name="optionId" value="${esc(o.id)}"${i === 0 ? ' required' : ''}>
          <span>${esc(o.libelle)}</span>
        </label>`).join('')}
      </fieldset>
      <label class="vote-options__commentaire">
        Un commentaire à ajouter ?
        <span class="aide">Facultatif — lu uniquement par la mairie, jamais publié sur le site.</span>
        <textarea name="commentaire" maxlength="1000" rows="2"></textarea>
      </label>
      <p class="consultation-confirmation" id="consultation-confirmation" role="status" hidden>${icone('check', 'icone--mini')}<span data-texte>Merci, votre réponse a été enregistrée.</span></p>
      <button class="bouton bouton--principal" type="submit">${icone('fleche')}<span>Participer à la consultation</span></button>
    </form>` : '';

  // Résultats : soit définitifs (statiques, dès qu'ils sont saisis par la
  // mairie — voir CLAUDE.md), soit en direct pendant que la consultation est
  // ouverte. Le compteur/les barres en direct sont une pure amélioration
  // JavaScript (src/scripts/consultation.js) : sans JS, seul le message
  // <noscript> ci-dessous s'affiche — voter reste possible sans JS.
  const blocResultats = c.resultatsFinaux
    ? blocResultatsFinaux(c.options, c.resultatsFinaux, 'Résultats définitifs')
    : (etat === 'ouverte' ? `
    <section class="section" id="consultation-resultats" data-api="${esc(urlResultats)}" aria-labelledby="resultats-titre">
      <h2 id="resultats-titre">Les résultats</h2>
      <p class="consultation-compteur" data-total>
        <noscript>Le nombre de réponses s'affiche avec JavaScript activé. Les résultats définitifs seront publiés ici à la clôture de la consultation.</noscript>
      </p>
      <ul class="barres" data-barres hidden>
        ${c.options.map((o) => `<li data-option="${esc(o.id)}">
          <span class="barres__label">${esc(o.libelle)} — <span data-pourcentage>0&nbsp;%</span></span>
          <span class="barres__piste"><span class="barres__valeur" style="inline-size:0%" data-valeur></span></span>
        </li>`).join('')}
      </ul>
    </section>
    <script src="/assets/consultation.js" defer></script>` : '');

  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <p class="carte__meta">${badgeEtatConsultation(etat)} <span class="etiquette">${esc(c.theme)}</span></p>
    <h1>${esc(c.question)}</h1>
    <p class="page-entete__intro">${periodeConsultation(c, etat)}</p>
    ${/* Une incitation à participer ("Donnez votre avis en 2 minutes") n'a plus de sens une fois le vote clos. */
      c.chapeau && etat !== 'terminee' ? `<p>${esc(c.chapeau)}</p>` : ''}
  </header>
  ${formulaireVote}
  ${c.corps ? `<div class="prose">${c.corps.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
  ${blocResultats}
  ${blocConclusions(c.conclusions)}
  <p class="retour"><a href="/vie-locale/consultations.html">${icone('fleche')}<span>Toutes les consultations</span></a></p>
</div>`;

  return page({
    site, nav, actif: 'vie-locale', titre: c.question, description: c.chapeau || c.question,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Consultations citoyennes', url: '/vie-locale/consultations.html' }, { libelle: c.question }],
    contenu
  });
}

/* --------------------------------------------------------------- Annuaires */

function ligneContact(c) {
  const bits = [];
  if (c.adresse) bits.push(`<li>${icone('lieu', 'icone--mini')}<span>${esc(c.adresse)}</span></li>`);
  if (c.telephone) bits.push(`<li>${icone('telephone', 'icone--mini')}<a href="tel:${esc(c.telephone.replace(/[^0-9+]/g, ''))}">${esc(c.telephone)}</a></li>`);
  if (c.email) bits.push(`<li>${icone('courriel', 'icone--mini')}<a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>`);
  if (c.site) bits.push(`<li>${icone('externe', 'icone--mini')}${lien(c.site, esc(c.site.replace(/^https?:\/\//, '').replace(/\/$/, '')))}</li>`);
  for (const l of c.liens || []) bits.push(`<li>${icone('externe', 'icone--mini')}${lien(l.url, esc(l.libelle))}</li>`);
  if (c.horaires) bits.push(`<li>${icone('horloge', 'icone--mini')}<span>${esc(c.horaires)}</span></li>`);
  return bits.length ? `<ul class="contact-liste">${bits.join('')}</ul>` : '';
}

export function pageAssociations(ctx) {
  const { site, nav, annuaire } = ctx;
  const contenu = `<div class="conteneur">
  ${banniereMuette(ctx, 'village', `Le village de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Les associations de ${esc(site.commune.nom)}</h1>
    <p class="page-entete__intro">Les associations qui font vivre ${esc(site.commune.nom)}.</p>
  </header>
  <ul class="grille-cartes grille-cartes--large">
    ${(annuaire.associations || []).map((a) => `<li class="carte">
      <h2 class="carte__titre">${esc(a.nom)}</h2>
      ${a.resume ? `<p class="carte__resume">${esc(a.resume)}</p>` : ''}
      ${a.detail ? `<p class="carte__detail">${esc(a.detail)}</p>` : ''}
      ${a.cotisation ? `<p class="carte__detail"><strong>Cotisation :</strong> ${esc(a.cotisation)}</p>` : ''}
      ${ligneContact(a)}
    </li>`).join('')}
  </ul>
  <aside class="encadre">
    <h2>Créer une association, demander une subvention</h2>
    <p>La commune accompagne les associations du village : mise à disposition de salles, relais dans le bulletin municipal, subventions votées en conseil municipal.</p>
    <p><a class="bouton bouton--secondaire" href="/demarches/association.html">${icone('fleche')}<span>La démarche pas à pas</span></a></p>
  </aside>
</div>`;
  return page({
    site, nav, actif: 'vie-locale', titre: 'Associations',
    description: `Les associations de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Vie locale', url: '/vie-locale/' }, { libelle: 'Associations' }],
    contenu
  });
}

// Nom des voies principales, seulement là où la carte n'est pas trop dense
// (aucun marqueur ni aucune autre étiquette à proximité) : la place manque
// vite sur ~700 unités avec une centaine de points, mieux vaut une carte
// lisible avec quelques noms que du texte qui se chevauche partout. Pour
// chaque voie nommée, on essaie ses plus longs segments d'abord (plus de
// place pour poser le texte), on garde le premier qui ne touche ni un
// marqueur ni une étiquette déjà posée, et on renonce sinon — la voie reste
// visible en trait, simplement sans son nom.
// Une voie « Route de X » indique déjà une direction, mais sous une forme
// administrative — « Vers X » se lit plus vite sur une carte. Les voies à
// deux extrémités nommées (« Route de X à Y ») et les rues sans destination
// restent inchangées : il n'y a pas de direction unique à afficher pour
// elles sans risquer d'induire en erreur.
function libelleDirection(nom) {
  const m = nom.match(/^Route de (.+)$/);
  if (m && !nom.includes(' à ')) return `Vers ${m[1]}`;
  return nom;
}

function etiquettesVoies(routes, proj, marqueursXY, fenetre) {
  const parNom = new Map();
  for (const r of routes) {
    if (!r.nom) continue;
    if (!parNom.has(r.nom)) parNom.set(r.nom, []);
    parNom.get(r.nom).push(r);
  }

  const RAYON_MARQUEUR = 13; // rayon d'exclusion autour de chaque point de la carte
  const RAYON_ETIQUETTE = 40; // distance minimale entre deux étiquettes
  const posees = [];

  const rendues = [];
  for (const [nom, groupe] of parNom) {
    const candidats = [];
    for (const route of groupe) {
      const pts = route.points.map(proj);
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        const longueur = Math.hypot(x2 - x1, y2 - y1);
        if (longueur < 24) continue; // trop court pour accueillir un nom lisiblement
        let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        else if (angle < -90) angle += 180;
        candidats.push({ x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2), angle: Math.round(angle), longueur });
      }
    }
    candidats.sort((a, b) => b.longueur - a.longueur);

    const libelle = libelleDirection(nom);
    const demiLargeurEstimee = libelle.length * 2.6 + 4; // ~ demi-largeur du texte, en unités de la carte
    const retenu = candidats.find((c) => {
      // Marge sur les 4 bords : la rotation peut faire pencher l'étiquette
      // dans n'importe quel sens, la même marge (demi-largeur du texte) est
      // donc appliquée horizontalement et verticalement plutôt que de
      // calculer l'emprise exacte selon l'angle.
      if (c.x < fenetre.minX + demiLargeurEstimee || c.x > fenetre.maxX - demiLargeurEstimee) return false;
      if (c.y < fenetre.minY + demiLargeurEstimee || c.y > fenetre.maxY - demiLargeurEstimee) return false;
      const rayon = demiLargeurEstimee + RAYON_MARQUEUR;
      if (marqueursXY.some(([mx, my]) => Math.hypot(mx - c.x, my - c.y) < rayon)) return false;
      if (posees.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < RAYON_ETIQUETTE)) return false;
      return true;
    });
    if (!retenu) continue;
    posees.push(retenu);
    rendues.push(`<text x="${retenu.x}" y="${retenu.y}" transform="rotate(${retenu.angle} ${retenu.x} ${retenu.y})">${esc(libelle)}</text>`);
  }
  return rendues.join('');
}

// Carte de localisation des acteurs économiques. Fond de plan (contour de
// la commune + voirie) issu d'OpenStreetMap, récupéré une fois pour toutes
// par tools/fetch-carte-fond.mjs (content/carte-fond.json) : ce gabarit ne
// fait lui-même aucun appel réseau, conformément à la règle « zéro requête
// tierce » — cohérent avec la projection ci-dessous, faite à la main plutôt
// qu'avec une bibliothèque de cartographie. Chaque établissement localisé
// (coordonnées fournies par l'API Sirene, jamais devinées) devient un point
// cliquable vers sa fiche ; ceux dont l'adresse est trop vague pour être
// géocodée restent listés juste en dessous, sans être positionnés au hasard.
// Les classes CSS "carte-lecques" viennent du moteur partagé avec Lecques
// (voir CLAUDE.md) et sont réutilisées telles quelles plutôt que renommées.
function carteActeurs(ctx) {
  const { carteFond, entreprises, site } = ctx;
  if (!carteFond || !carteFond.communeContour || !carteFond.communeContour.length) return '';
  const total = entreprises.entreprises.length;
  const points = entreprises.entreprises.filter((e) => e.lat && e.lon);
  if (!points.length) return '';

  const { bbox, communeContour, routes, riviere } = carteFond;
  const latRef = (bbox.minlat + bbox.maxlat) / 2;
  const mLat = 111320; // mètres par degré de latitude, quasi constant
  const mLon = 111320 * Math.cos((latRef * Math.PI) / 180); // … de longitude, dépend de la latitude
  const largeurM = (bbox.maxlon - bbox.minlon) * mLon;
  const hauteurM = (bbox.maxlat - bbox.minlat) * mLat;
  const LARGEUR = 700;
  const echelle = LARGEUR / largeurM;
  const HAUTEUR = Math.round(hauteurM * echelle);
  // Coordonnées arrondies à l'entier (l'échelle rend le dixième de pixel
  // invisible) : sur des centaines de points de voirie et des dizaines de
  // marqueurs, l'économie de caractères n'est pas cosmétique, elle tient la
  // page dans son budget de poids. Même logique pour les marqueurs
  // eux-mêmes, réduits à un seul <use> vers l'un des deux points définis
  // une fois dans <defs>.
  const arr = (n) => Math.round(n);
  const proj = ([lon, lat]) => [arr((lon - bbox.minlon) * mLon * echelle), arr((bbox.maxlat - lat) * mLat * echelle)];

  const contourPts = communeContour.map((p) => proj(p).join(',')).join(' ');
  const routesSvg = routes.map((r) => `<polyline points="${r.points.map((p) => proj(p).join(',')).join(' ')}"/>`).join('');
  const riviereSvg = (riviere || []).map((r) => `<polyline points="${r.map((p) => proj(p).join(',')).join(' ')}"/>`).join('');

  const [mx, my] = proj([site.mairie.longitude, site.mairie.latitude]);
  const mairieSvg = `<circle cx="${mx}" cy="${my}" r="8" class="carte-lecques__mairie-halo"/><circle cx="${mx}" cy="${my}" r="3.5" class="carte-lecques__mairie-point"/>`;

  const marqueurs = points.map((ent) => {
    const [x, y] = proj([ent.lon, ent.lat]);
    const activite = ent.association ? 'Association' : (ent.nafLibelle || 'Activité économique');
    return `<a href="https://annuaire-entreprises.data.gouv.fr/entreprise/${esc(ent.siren)}" target="_blank" rel="noopener"><title>${esc(ent.nom)} — ${esc(activite)}</title><use href="#pz" x="${x}" y="${y}"/><use href="#pt" x="${x}" y="${y}" class="carte-lecques__point${ent.association ? ' carte-lecques__point--association' : ''}"/></a>`;
  }).join('');

  // La commune s'étend bien au-delà du village (voir carteFond.bbox) : sans
  // recadrage, l'ouverture de la carte montre d'abord des terrains vides, les
  // marqueurs regroupés loin dans un coin. On centre donc la fenêtre visible
  // sur l'emprise réelle des marqueurs (+ la mairie), avec une marge — le
  // contour et la voirie plus lointains restent dans le document, simplement
  // hors cadre au premier affichage, comme sur n'importe quel plan.
  const positionsInteret = [...points.map((ent) => proj([ent.lon, ent.lat])), [mx, my]];
  const xsInteret = positionsInteret.map((p) => p[0]);
  const ysInteret = positionsInteret.map((p) => p[1]);
  let fenMinX = Math.min(...xsInteret), fenMaxX = Math.max(...xsInteret);
  let fenMinY = Math.min(...ysInteret), fenMaxY = Math.max(...ysInteret);
  const margeX = Math.max((fenMaxX - fenMinX) * 0.25, 40);
  const margeY = Math.max((fenMaxY - fenMinY) * 0.25, 40);
  fenMinX -= margeX; fenMaxX += margeX; fenMinY -= margeY; fenMaxY += margeY;
  // Une carte trop haute et étroite (fréquent : les communes s'étirent
  // souvent plus en latitude qu'en longitude) se lit mal une fois insérée
  // dans une page ; on élargit plutôt que de la laisser filiforme.
  const RATIO_MAX = 1.3;
  if ((fenMaxY - fenMinY) / (fenMaxX - fenMinX) > RATIO_MAX) {
    const largeurCible = (fenMaxY - fenMinY) / RATIO_MAX;
    const centreX = (fenMinX + fenMaxX) / 2;
    fenMinX = centreX - largeurCible / 2;
    fenMaxX = centreX + largeurCible / 2;
  } else if ((fenMaxX - fenMinX) / (fenMaxY - fenMinY) > RATIO_MAX) {
    const hauteurCible = (fenMaxX - fenMinX) / RATIO_MAX;
    const centreY = (fenMinY + fenMaxY) / 2;
    fenMinY = centreY - hauteurCible / 2;
    fenMaxY = centreY + hauteurCible / 2;
  }
  // On ne montre jamais au-delà du plan effectivement dessiné (0..LARGEUR,
  // 0..HAUTEUR) : au-delà, il n'y a de toute façon rien à afficher.
  fenMinX = Math.max(0, fenMinX); fenMinY = Math.max(0, fenMinY);
  fenMaxX = Math.min(LARGEUR, fenMaxX); fenMaxY = Math.min(HAUTEUR, fenMaxY);
  const fenetre = { minX: fenMinX, minY: fenMinY, maxX: fenMaxX, maxY: fenMaxY };

  const etiquettesSvg = etiquettesVoies(routes, proj, points.map((ent) => proj([ent.lon, ent.lat])), fenetre);

  const nonLocalises = total - points.length;
  return `<div class="carte-lecques">
    <svg viewBox="${Math.round(fenMinX)} ${Math.round(fenMinY)} ${Math.round(fenMaxX - fenMinX)} ${Math.round(fenMaxY - fenMinY)}" role="group" aria-label="Carte de localisation des acteurs économiques de ${esc(site.commune.nom)}">
      <defs>
        <circle id="pt" r="6"/>
        <circle id="pz" r="12" fill="transparent"/>
      </defs>
      <polygon class="carte-lecques__contour" points="${contourPts}"/>
      <g class="carte-lecques__routes">${routesSvg}</g>
      <g class="carte-lecques__riviere">${riviereSvg}</g>
      <g class="carte-lecques__marqueurs">${marqueurs}</g>
      ${mairieSvg}
      <g class="carte-lecques__etiquettes">${etiquettesSvg}</g>
    </svg>
    <p class="carte-lecques__legende">
      <span><span class="carte-lecques__puce carte-lecques__puce--commerce" aria-hidden="true"></span>Commerce, artisan, profession libérale</span>
      <span><span class="carte-lecques__puce carte-lecques__puce--association" aria-hidden="true"></span>Association</span>
      <span><span class="carte-lecques__puce carte-lecques__puce--mairie" aria-hidden="true"></span>Mairie</span>
      <span><span class="carte-lecques__trait carte-lecques__trait--riviere" aria-hidden="true"></span>${esc((ctx.site.riviere && ctx.site.riviere.nom) || 'Cours d\'eau')}</span>
    </p>
    <p class="carte__detail">${points.length} établissement${points.length > 1 ? 's' : ''} localisé${points.length > 1 ? 's' : ''} sur ${total}${nonLocalises ? ` — les ${nonLocalises} autres n'ont qu'une adresse trop imprécise (lieu-dit) pour être positionnés, retrouvez-les dans la liste ci-dessous` : ''}.</p>
  </div>`;
}

export function pageCarteActeurs(ctx) {
  const { site, nav } = ctx;
  const carte = carteActeurs(ctx);
  const contenu = `<div class="conteneur">
  <header class="page-entete">
    <h1>Cartographie des acteurs économiques</h1>
    <p class="page-entete__intro">Commerces, artisans, professions libérales et associations de ${esc(site.commune.nom)}, positionnés sur la carte de la commune. Cliquez sur un point pour ouvrir sa fiche officielle.</p>
  </header>
  <h2>Répartition sur la commune</h2>
  ${carte || '<p>La carte n’est pas disponible pour le moment.</p>'}
  <p class="retour"><a href="/vie-locale/professionnels.html">${icone('fleche')}<span>Retour aux acteurs économiques</span></a></p>
</div>`;
  return page({
    site, nav, actif: 'vie-locale', titre: 'Cartographie des acteurs économiques',
    description: `Carte de localisation des commerces, artisans, professions libérales et associations de ${site.commune.nom}.`,
    fil: [
      { libelle: 'Accueil', url: '/' },
      { libelle: 'Vie locale', url: '/vie-locale/' },
      { libelle: 'Acteurs économiques', url: '/vie-locale/professionnels.html' },
      { libelle: 'Cartographie' }
    ],
    contenu
  });
}

const ligneEntreprise = (ent) => `<li class="ligne-entreprise">
        ${icone(ent.icone, 'icone--mini')}
        <span class="ligne-entreprise__corps">
          <span class="ligne-entreprise__nom">${lien(`https://annuaire-entreprises.data.gouv.fr/entreprise/${esc(ent.siren)}`, esc(ent.nom))}${ent.enseigne ? ` <span class="ligne-entreprise__enseigne">— ${esc(ent.enseigne)}</span>` : ''}</span>
          <span class="ligne-entreprise__meta">${ent.association ? 'Association' : esc(ent.nafLibelle || '')} · ${esc(ent.adresse)}${ent.dateCreation ? ` · créé le ${dateFr(ent.dateCreation)}` : ''}</span>
        </span>
      </li>`;

// Annuaire Sirene regroupé par section NAF (src/naf.mjs), précédé d'un
// filtre qui ne propose que les sections comptant au moins un
// établissement. Sans JavaScript, chaque pastille mène à son groupe ; avec,
// src/scripts/filtre-naf.js n'affiche plus que la section choisie (et la
// garde dans l'adresse de la page, #naf-f).
function annuaireSireneParSection(etablissements) {
  const groupes = grouperParSectionNaf(etablissements);
  const ancre = (s) => (s.lettre ? `naf-${s.lettre.toLowerCase()}` : 'naf-autre');
  const pluriel = (n) => `${n} établissement${n > 1 ? 's' : ''}`;
  // Chaque morceau de la pastille est un élément de la boîte flexible : les
  // compléments .sr-only (« , section A, », « établissements ») donnent aux
  // lecteurs d'écran une phrase complète que les espaces seuls ne donnent pas.
  const nombrePastille = (n) => `<span class="filtre-naf__nombre">${n}<span class="sr-only"> établissement${n > 1 ? 's' : ''}</span></span>`;
  return `<nav class="filtre-naf" aria-labelledby="filtre-naf-titre" data-filtre-naf>
      <p class="filtre-naf__titre" id="filtre-naf-titre">Filtrer par secteur d'activité (section NAF de l'Insee)</p>
      <ul class="filtre-naf__liste">
        <li><a href="#annuaire-sirene" data-section="" data-libelle="Tous les secteurs" data-nombre="${etablissements.length}" aria-current="true"><span>Tous<span class="sr-only"> les secteurs, </span></span>${nombrePastille(etablissements.length)}</a></li>
        ${groupes.map(({ section: s, etablissements: liste }) => `<li><a href="#${ancre(s)}" data-section="${ancre(s)}" data-libelle="${esc(s.lettre ? `Section ${s.lettre} — ${s.titre}` : s.titre)}" data-nombre="${liste.length}">${s.lettre ? `<span class="filtre-naf__lettre" aria-hidden="true">${s.lettre}</span>` : ''}<span>${esc(s.court)}${s.lettre ? `<span class="sr-only">, section ${s.lettre}, </span>` : ', '}</span>${nombrePastille(liste.length)}</a></li>`).join('')}
      </ul>
      <p class="filtre-naf__statut" role="status" aria-live="polite" data-statut></p>
    </nav>
    <div id="annuaire-sirene">
      ${groupes.map(({ section: s, etablissements: liste }) => `<section class="groupe-naf" id="${ancre(s)}" aria-labelledby="${ancre(s)}-titre" data-groupe-naf>
        <h3 class="groupe-naf__titre" id="${ancre(s)}-titre">${s.lettre ? `Section ${s.lettre} — ` : ''}${esc(s.titre)} <span class="groupe-naf__nombre">(${pluriel(liste.length)})</span></h3>
        <ul class="liste-entreprises">
          ${liste.map(ligneEntreprise).join('')}
        </ul>
      </section>`).join('')}
    </div>
    <script src="/assets/filtre-naf.js" defer></script>`;
}

// L'annuaire officiel Sirene d'abord (toutes les activités déclarées à
// la commune, à jour sans entretien), puis les quelques activités que la
// mairie présente plus en détail (content/annuaire.json → professionnels).
export function pageProfessionnels(ctx) {
  const { site, nav, annuaire, entreprises } = ctx;
  const avecSirene = !!(entreprises && entreprises.entreprises && entreprises.entreprises.length);
  const detail = annuaire.professionnels || [];
  const avecDetail = detail.length > 0;
  const contenu = `<div class="conteneur">
  ${banniereMuette(ctx, 'village', `Le village de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Acteurs économiques</h1>
    <p class="page-entete__intro">${avecSirene
      ? `Toutes les activités déclarées à ${site.commune.nom}, d'après le répertoire officiel Sirene${avecDetail ? ', puis quelques-unes présentées plus en détail' : ''}.`
      : `Les professionnels installés à ${site.commune.nom} et à proximité sont à votre écoute.`}</p>
  </header>

  ${avecSirene ? `<section class="section section--sirene">
    <h2>Annuaire officiel Sirene des activités économiques</h2>
    <p class="page-entete__intro">Cette liste est générée automatiquement à partir du répertoire Sirene de l'Insee (base officielle des entreprises, auto-entrepreneurs et associations). Elle n'est pas relue à la main : elle recense les établissements actifs déclarés à ${esc(site.commune.nom)}, mais certaines adresses ne sont pas rendues publiques par leurs titulaires, et une activité récente peut ne pas encore y figurer. ${avecDetail ? ' Quelques activités sont présentées plus en détail <a href="#quelques-activites">plus bas</a>.' : ''}${entreprises.misAJour ? `<br>Dernière modification constatée&nbsp;: ${dateFr(entreprises.misAJour)}.` : ''}</p>
    <p><a class="bouton bouton--secondaire" href="/vie-locale/carte-acteurs-economiques.html">${icone('carte')}<span>Cartographie des acteurs économiques</span></a></p>
    ${annuaireSireneParSection(entreprises.entreprises)}
    <p class="carte__detail">Une erreur, une fermeture, une activité manquante&nbsp;? <a href="mailto:${esc(site.mairie.email)}?subject=Annuaire%20Sirene%20-%20correction">Signalez-le au secrétariat de mairie</a>.</p>
  </section>` : ''}

  ${avecDetail ? `<section class="section section--activites" aria-labelledby="quelques-activites">
    <h2 id="quelques-activites">Quelques activités présentes sur la commune</h2>
    <ul class="grille-cartes grille-cartes--large">
      ${detail.map((p) => `<li class="carte">
        <p class="carte__meta"><span class="etiquette">${esc(p.activite)}</span></p>
        <h3 class="carte__titre">${esc(p.nom)}</h3>
        ${p.enseigne ? `<p class="carte__enseigne">${esc(p.enseigne)}</p>` : ''}
        ${p.note ? `<p class="carte__detail">${esc(p.note)}</p>` : ''}
        ${ligneContact(p)}
      </li>`).join('')}
    </ul>
  </section>` : ''}
  <aside class="encadre">
    <h2>Vous êtes professionnel à ${esc(site.commune.nom)}&nbsp;?</h2>
    <p>Signalez-vous au secrétariat de mairie pour figurer parmi les activités présentées en détail et dans le bulletin municipal. C'est gratuit.</p>
    <p><a class="bouton bouton--secondaire" href="mailto:${esc(site.mairie.email)}?subject=Inscription%20%C3%A0%20l%27annuaire%20des%20professionnels">${icone('courriel')}<span>Me faire connaître</span></a></p>
  </aside>
</div>`;
  return page({
    site, nav, actif: 'vie-locale', titre: 'Acteurs économiques',
    description: `Annuaire des professionnels et commerçants de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Vie locale', url: '/vie-locale/' }, { libelle: 'Acteurs économiques' }],
    contenu
  });
}

export function pagePetiteEnfance(ctx) {
  const { site, nav, annuaire } = ctx;
  const contenu = `<div class="conteneur conteneur--etroit">
  ${banniereMuette(ctx, 'village', `Le village de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Petite enfance</h1>
    <p class="page-entete__intro">Les modes d'accueil des tout-petits pour les familles de ${esc(site.commune.nom)} : relais petite enfance, assistantes maternelles et crèches.</p>
  </header>
  <ul class="grille-cartes">
    ${(annuaire.petiteEnfance || []).map((c) => `<li class="carte">
      <p class="carte__meta"><span class="etiquette">${esc(c.type)}</span></p>
      <h2 class="carte__titre">${esc(c.nom)}</h2>
      ${c.enseigne ? `<p class="carte__enseigne">${esc(c.enseigne)}</p>` : ''}
      ${c.note ? `<p class="carte__detail">${esc(c.note)}</p>` : ''}
      ${ligneContact(c)}
    </li>`).join('')}
  </ul>
  <aside class="encadre">
    <h2>Préinscription en crèche</h2>
    <p>Les crèches du territoire sont gérées par ${esc((site.commune.intercommunalite || {}).nom || 'la communauté de communes')}. La préinscription se demande auprès de son service Petite enfance.</p>
    <p><a class="bouton bouton--secondaire" href="/demarches/creche.html">${icone('fleche')}<span>La démarche pas à pas</span></a></p>
  </aside>
</div>`;
  return page({
    site, nav, actif: 'enfance-jeunesse', titre: 'Petite enfance',
    description: `Modes d'accueil des tout-petits pour les familles de ${site.commune.nom} : relais petite enfance, assistantes maternelles et crèches.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Enfance & jeunesse', url: '/enfance-jeunesse/' }, { libelle: 'Petite enfance' }],
    contenu
  });
}

export function pageEtablissements(ctx) {
  const { site, nav, annuaire } = ctx;
  const contenu = `<div class="conteneur conteneur--etroit">
  ${banniereMuette(ctx, 'village', `Le village de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Collèges et lycées</h1>
    <p class="page-entete__intro">Les établissements les plus proches pour les jeunes de ${esc(site.commune.nom)} après l'école primaire. Le collège de secteur dépend de l'adresse : renseignez-vous auprès de la mairie.</p>
  </header>
  <ul class="grille-cartes grille-cartes--large">
    ${(annuaire.etablissementsScolaires || []).map((et) => `<li class="carte">
      <p class="carte__meta"><span class="etiquette">${esc(et.type)}</span></p>
      <h2 class="carte__titre">${esc(et.nom)}</h2>
      ${et.note ? `<p class="carte__detail">${esc(et.note)}</p>` : ''}
      ${ligneContact(et)}
    </li>`).join('')}
  </ul>
  <aside class="encadre">
    <h2>Transport scolaire</h2>
    <p>Les circuits de transport scolaire sont organisés par la Région et ${esc((site.commune.intercommunalite || {}).nom || 'la communauté de communes')}. Les horaires sont disponibles en mairie et sur le site de la communauté de communes.</p>
  </aside>
</div>`;
  return page({
    site, nav, actif: 'enfance-jeunesse', titre: 'Collèges et lycées',
    description: `Collèges et lycées les plus proches de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Enfance & jeunesse', url: '/enfance-jeunesse/' }, { libelle: 'Collèges et lycées' }],
    contenu
  });
}

export function pageLoisirsJeunesse(ctx) {
  const { site, nav, annuaire } = ctx;
  const contenu = `<div class="conteneur conteneur--etroit">
  ${banniereMuette(ctx, 'village', `Le village de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Centres de loisirs</h1>
    <p class="page-entete__intro">Les mercredis, les vacances et les activités qui rendent les enfants et les jeunes acteurs de leurs loisirs.</p>
  </header>
  <ul class="grille-cartes">
    ${(annuaire.loisirsJeunesse || []).map((c) => `<li class="carte">
      <h2 class="carte__titre">${esc(c.nom)}</h2>
      ${c.note ? `<p class="carte__detail">${esc(c.note)}</p>` : ''}
      ${ligneContact(c)}
    </li>`).join('')}
  </ul>
  <aside class="encadre">
    <h2>Inscrire mon enfant</h2>
    <p>Les dossiers sont généralement valables pour l'année scolaire, et les places pour les vacances partent vite.</p>
    <p><a class="bouton bouton--secondaire" href="/demarches/centre-loisirs.html">${icone('fleche')}<span>La démarche pas à pas</span></a></p>
  </aside>
</div>`;
  return page({
    site, nav, actif: 'enfance-jeunesse', titre: 'Centres de loisirs',
    description: `Accueils de loisirs pour les enfants et les jeunes de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Enfance & jeunesse', url: '/enfance-jeunesse/' }, { libelle: 'Centres de loisirs' }],
    contenu
  });
}

/* ------------------------------------------------------------ La mairie */

export function pageContact(ctx) {
  const { site, nav, annuaire } = ctx;
  const m = site.mairie;
  const contenu = `<div class="conteneur">
  ${banniereMuette(ctx, 'mairie', `La mairie de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Contact et horaires</h1>
    <p class="page-entete__intro">Le secrétariat de mairie est le point d'entrée pour toutes vos démarches, y compris celles qui ne relèvent pas de la commune.</p>
  </header>

  <div class="contact-grille">
    <section class="carte carte--contact" aria-labelledby="coord-titre">
      <h2 id="coord-titre">Nous trouver et nous joindre</h2>
      <address>
        <strong>${esc(m.nom)}</strong><br>
        ${esc(m.adresse)}<br>${esc(m.codePostal)} ${esc(m.ville)}
      </address>
      <ul class="pratique__contacts">
        <li>${icone('telephone')}<a href="tel:${esc(m.telephoneLien)}">${esc(m.telephone)}</a></li>
        <li>${icone('courriel')}<a href="mailto:${esc(m.email)}">${esc(m.email)}</a></li>
      </ul>
      <p>${lien(m.itineraire, `${icone('lieu')}<span>Calculer mon itinéraire</span>`, { classe: 'bouton bouton--secondaire' })}</p>
    </section>

    <section class="carte carte--contact" aria-labelledby="horaires-titre">
      <h2 id="horaires-titre">Horaires d'ouverture</h2>
      <p class="pratique__statut" data-statut-mairie data-horaires="${esc(donneesHoraires(m.horaires))}">
        <span class="pastille" aria-hidden="true"></span>
        <span data-statut-texte>${esc(m.horairesIntro)}</span>
      </p>
      <ul class="pratique__horaires">
        ${m.horaires.map((h) => `<li${h.ouvert ? '' : ' class="ferme"'}><span>${esc(h.jour)}</span><span>${esc(h.libelle)}</span></li>`).join('')}
      </ul>
      <p class="pied__note">${esc(m.horairesNote)}</p>
    </section>

    <section class="carte carte--contact" aria-labelledby="ecrire-titre">
      <h2 id="ecrire-titre">Nous écrire</h2>
      <p>Toutes vos idées sont les bienvenues. Écrivez au secrétariat pour :</p>
      <ul class="pieces">
        <li>${icone('check', 'icone--mini')}<span>demander un rendez-vous pour une démarche</span></li>
        <li>${icone('check', 'icone--mini')}<span>demander un rendez-vous avec un élu</span></li>
        <li>${icone('check', 'icone--mini')}<span>signaler un problème dans le village</span></li>
        <li>${icone('check', 'icone--mini')}<span>nous faire part de vos remarques</span></li>
      </ul>
      <p><a class="bouton bouton--principal bouton--large" href="mailto:${esc(m.email)}">${icone('courriel')}<span>Écrire à la mairie</span></a></p>
      <p class="pied__note">Précisez vos coordonnées et l'objet de votre demande : cela évite un aller-retour et accélère la réponse.</p>
    </section>

    <section class="carte carte--contact carte--urgence" aria-labelledby="urgence-titre">
      <h2 id="urgence-titre">Numéros d'urgence</h2>
      <ul class="urgences">
        ${annuaire.urgences.map((u) => `<li><a href="tel:${esc(u.numero)}"><strong>${esc(u.numero)}</strong> <span>${esc(u.libelle)}</span></a></li>`).join('')}
      </ul>
      <p class="pied__note">La mairie n'est pas un service d'urgence : en cas de danger immédiat, composez directement l'un de ces numéros.</p>
    </section>
  </div>
</div>`;
  return page({
    site, nav, actif: 'mairie', titre: 'Contact et horaires',
    description: `Adresse, téléphone, courriel et horaires d'ouverture de la mairie de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' }, { libelle: 'Contact' }],
    contenu
  });
}

export function pageElus(ctx) {
  const { site, nav, elus, documents } = ctx;
  const documentsElus = (documents && documents.elus) || [];
  const fil = [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' }, { libelle: 'Les élus' }];
  const contenu = `<div class="conteneur conteneur--etroit">
  ${banniereMuette(ctx, 'mairie', `La mairie de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Les élus</h1>
    <p class="page-entete__intro">${esc(elus.intro)}</p>
  </header>
  <section class="section" aria-labelledby="conseil-titre">
    <h2 id="conseil-titre">Le conseil municipal</h2>
    <ul class="grille-cartes grille-cartes--elus">
      ${elus.conseil.map((p) => `<li class="carte carte--elu">
        ${p.photo ? `<img class="carte__portrait" src="/img/elus/${esc(p.photo)}" alt="" width="240" height="240" loading="lazy" decoding="async">` : ''}
        <div>
          <p class="carte__nom">${esc(p.prenom)} ${esc(p.nom)}</p>
          <p class="carte__fonction">${esc(p.fonction)}</p>
        </div>
      </li>`).join('')}
    </ul>
  </section>
  ${blocDocuments(ctx, { url: '/mairie/elus.html', actif: 'mairie', fil }, documentsElus)}
  <aside class="encadre">
    <h2>Rencontrer un élu</h2>
    <p>Le maire et ses adjoints reçoivent sur rendez-vous. Les séances du conseil municipal sont publiques et ouvertes à tous les habitants.</p>
    <p><a class="bouton bouton--secondaire" href="/demarches/rendez-vous-elu.html">${icone('fleche')}<span>Demander un rendez-vous</span></a></p>
  </aside>
</div>`;
  return page({
    site, nav, actif: 'mairie', titre: 'Les élus',
    description: `Le conseil municipal de ${site.commune.nom} : le maire, les adjoints et les conseillers municipaux.`,
    fil,
    contenu
  });
}

export function pageCommissions(ctx) {
  const { site, nav, elus, documents } = ctx;
  const documentsCommissions = (documents && documents.commissions) || [];
  const fil = [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' }, { libelle: 'Commissions' }];
  const contenu = `<div class="conteneur conteneur--etroit">
  ${banniereMuette(ctx, 'mairie', `La mairie de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Commissions et représentations</h1>
    <p class="page-entete__intro">Le conseil municipal formalise le travail préparatoire des commissions. Les élus représentent également la commune dans les syndicats intercommunaux.</p>
  </header>

  <section class="section" aria-labelledby="commissions-titre">
    <h2 id="commissions-titre">Les commissions municipales</h2>
    <ul class="grille-cartes grille-cartes--large">
      ${elus.commissions.map((c) => `<li class="carte">
        <h3 class="carte__titre">${esc(c.nom)}</h3>
        <p class="carte__detail">${esc(c.domaines)}</p>
        <p class="carte__meta"><strong>Présidence :</strong> ${esc(c.presidence)}</p>
        <p class="carte__meta"><strong>Membres :</strong> ${c.membres.map(esc).join(', ')}</p>
      </li>`).join('')}
    </ul>
  </section>

  <section class="section" aria-labelledby="repres-titre">
    <h2 id="repres-titre">Représentations et syndicats</h2>
    <ul class="liste-detail">
      ${elus.representations.map((r) => `<li>
        <h3>${esc(r.nom)}</h3>
        <p><strong>Titulaire${r.titulaires.length > 1 ? 's' : ''} :</strong> ${r.titulaires.map(esc).join(', ')}</p>
        ${r.suppleants.length ? `<p><strong>Suppléant${r.suppleants.length > 1 ? 's' : ''} :</strong> ${r.suppleants.map(esc).join(', ')}</p>` : ''}
      </li>`).join('')}
    </ul>
  </section>

  ${blocDocuments(ctx, { url: '/mairie/commissions.html', actif: 'mairie', fil }, documentsCommissions)}
</div>`;
  return page({
    site, nav, actif: 'mairie', titre: 'Commissions',
    description: `Commissions municipales et représentations de la commune de ${site.commune.nom} dans les syndicats intercommunaux.`,
    fil,
    contenu
  });
}

export function pageConseils(ctx) {
  const { site, nav, conseils, documents } = ctx;
  const contenu = `<div class="conteneur conteneur--etroit">
  ${banniereMuette(ctx, 'mairie', `La mairie de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Conseils municipaux</h1>
    <p class="page-entete__intro">Les procès-verbaux des séances, du plus récent au plus ancien. Les séances sont publiques et ouvertes à tous les habitants : n'hésitez pas à venir y assister.</p>
  </header>
  ${conseils.length ? `<div id="recherche-pv" data-recherche-documents data-index="/recherche-pv.json"
    data-libelle="Rechercher dans les PV des conseils municipaux" data-exemple="ex. budget, voirie, cimetière…"
    data-singulier="compte-rendu" data-pluriel="comptes-rendus"
    data-aucun="Essayez un autre mot, ou parcourez les séances année par année ci-dessous."></div>
  <nav class="ancres" aria-label="Années">
    <ul>${conseils.map((a) => `<li><a href="#annee-${a.annee}">${a.annee}</a></li>`).join('')}</ul>
  </nav>` : `<section class="section" aria-labelledby="aucune-seance-titre">
    <h2 id="aucune-seance-titre">Aucune séance enregistrée pour le moment</h2>
    <p>Les comptes-rendus seront publiés ici au fil des séances.</p>
  </section>`}
  ${conseils.map((a) => {
    const docsAnnee = (documents && documents[`conseils/${a.annee}`]) || [];
    return `<section class="section section--annee" id="annee-${a.annee}" aria-labelledby="titre-${a.annee}">
    <h2 id="titre-${a.annee}">${a.annee}</h2>
    <div class="tableau-defilant" role="region" aria-labelledby="titre-${a.annee}" tabindex="0">
    <table class="tableau tableau--conseils">
      <caption class="sr-only">Séances du conseil municipal de ${esc(site.commune.nom)} en ${a.annee}</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Compte-rendu</th></tr></thead>
      <tbody>
        ${a.seances.map((s) => {
          const local = docsAnnee.find((d) => d.date === s.date);
          const date = `<td>${dateFr(s.date)}</td>`;
          if (local) return `<tr>${date}<td><a href="${urlSeanceConseil(s.date)}">${icone('document', 'icone--mini')}<span>${esc(s.libelle)}</span> <span class="poids">${esc(formatEtPoids(local))}</span></a></td></tr>`;
          if (s.url) return `<tr>${date}<td>${lien(s.url, `${icone('telecharger', 'icone--mini')}<span>${esc(s.libelle)}</span>`)}</td></tr>`;
          // Sans note : séance récente dont le PV n'est pas encore publié.
          // Avec note : PV absent pour une autre raison (lien d'origine erroné…).
          return `<tr class="indisponible">${date}<td>${icone(s.note ? 'mairie' : 'horloge', 'icone--mini')}<em>${esc(s.note || 'À paraître')}</em></td></tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>
  </section>`;
  }).join('')}
</div>
<script src="/assets/recherche-pv.js" defer></script>`;
  return page({
    site, nav, actif: 'mairie', titre: 'Conseils municipaux',
    description: `Procès-verbaux des séances du conseil municipal de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' }, { libelle: 'Conseils municipaux' }],
    contenu
  });
}

/** Séances dont le PV est déposé sur le site (catégorie "conseils/<année>"
 *  de content/documents.json, rapprochée de content/conseils.json par la
 *  date) : chacune a sa page, voir pageSeanceConseil. */
export function seancesAvecPv(conseils, documents) {
  return (conseils || []).flatMap((a) => {
    const docs = (documents && documents[`conseils/${a.annee}`]) || [];
    return a.seances
      .map((s) => ({ annee: a.annee, seance: s, doc: docs.find((d) => d.date === s.date) }))
      .filter((x) => x.doc);
  });
}

/** Page d'une séance : sa date, unique comme la séance elle-même. */
export function urlSeanceConseil(date) {
  return `/mairie/conseils-municipaux/seance-${date}.html`;
}

// Page d'une séance du conseil municipal : le PV affiché dans le site, comme
// un document de la bibliothèque (voir pageDocument). Le lien direct vers le
// PDF, qui le téléchargeait, laissait l'habitant sur téléphone dans une
// visionneuse sans retour possible au site.
export function pageSeanceConseil(ctx, s, d, annee) {
  return pageDocument(ctx, {
    d, titre: s.libelle, titrePage: `Conseil municipal — ${s.libelle}`,
    meta: '<span class="etiquette">Procès-verbal</span>',
    retour: { url: `/mairie/conseils-municipaux.html#annee-${annee}`, bouton: 'Retour aux conseils municipaux', lien: 'Toutes les séances du conseil municipal' },
    description: `Procès-verbal du conseil municipal de ${ctx.site.commune.nom} — ${s.libelle} (${formatEtPoids(d)}).`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' },
      { libelle: 'Conseils municipaux', url: '/mairie/conseils-municipaux.html' }, { libelle: s.libelle }]
  });
}

/** Documents de la bibliothèque documentaire communale, regroupés par année
 *  (clés "bibliotheque/<année>" de content/documents.json, voir CLAUDE.md
 *  « Ajouter un document »), années et documents du plus récent au plus
 *  ancien. */
export function anneesBibliotheque(documents) {
  return Object.entries(documents || {})
    .filter(([categorie, docs]) => /^bibliotheque\/\d{4}$/.test(categorie) && docs.length)
    .map(([categorie, docs]) => ({
      annee: Number(categorie.slice('bibliotheque/'.length)),
      docs: [...docs].sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.libelle.localeCompare(b.libelle, 'fr'))
    }))
    .sort((a, b) => b.annee - a.annee);
}

/** Page d'un document de la bibliothèque : le nom du fichier, sans point
 *  (« ruisseau-capotier.mp4 » → « ruisseau-capotier-mp4 ») — unique, comme
 *  le fichier lui-même dans public/documents/, et sans extension trompeuse
 *  pour Cloudflare ou Apache, qui servent les pages sans « .html ». */
export function urlDocumentBibliotheque(d) {
  return `/mairie/bibliotheque-documentaire/${String(d.fichier).replace(/\./g, '-').toLowerCase()}.html`;
}

// « PDF, 1,2 Mo », « Vidéo MP4, 14 Mo » : ce qu'est le fichier et ce qu'il
// pèse, annoncés avant de l'ouvrir (d.octets posé par src/build.mjs).
function formatEtPoids(d) {
  const format = formatBibliotheque(d.fichier);
  const libelle = format ? format.libelle : 'Fichier';
  return d.octets ? `${libelle}, ${poidsFichier(d.octets)}` : libelle;
}

// « 350 Ko », « 10,6 Mo ». Espace insécable : le nombre ne se sépare
// jamais de son unité.
function poidsFichier(octets) {
  return octets < 1024 * 1024
    ? `${Math.max(1, Math.round(octets / 1024))}\u00a0Ko`
    : `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}\u00a0Mo`;
}

// Même présentation que les conseils municipaux (une section par année, et
// la recherche dans le texte des PDF de recherche-pv.js), plus les thèmes de
// chaque document, repris des catégories des actualités.
export function pageBibliothequeDocumentaire(ctx) {
  const { site, nav, documents, categoriesActualites } = ctx;
  const annees = anneesBibliotheque(documents);
  // Thèmes proposés par le filtre de la recherche : seulement ceux qui ont
  // au moins un document (un thème vide ne donnerait jamais de résultat),
  // dans l'ordre de content/categories-actualites.json.
  const themesUtilises = new Set(annees.flatMap((a) => a.docs.flatMap((d) => d.themes || [])));
  const themesFiltre = [
    ...(categoriesActualites || []).filter((t) => themesUtilises.has(t)),
    ...[...themesUtilises].filter((t) => !(categoriesActualites || []).includes(t)).sort((a, b) => a.localeCompare(b, 'fr'))
  ];
  const contenu = `<div class="conteneur conteneur--etroit">
  ${banniereMuette(ctx, 'mairie', `La mairie de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Bibliothèque documentaire communale</h1>
    <p class="page-entete__intro">Les documents publiés par la commune, classés par année, du plus récent au plus ancien : rapports, études, plans, arrêtés, photos, enregistrements et autres documents de référence. Tous s'ouvrent directement dans votre navigateur.</p>
  </header>
  ${annees.length ? `<div id="recherche-bibliotheque" data-recherche-documents data-index="/recherche-bibliotheque.json"
    data-libelle="Rechercher dans la bibliothèque documentaire" data-exemple="ex. sécheresse, voirie, école…"
    data-singulier="document" data-pluriel="documents"
    data-aucun="Essayez un autre mot ou un autre thème, ou parcourez les documents année par année ci-dessous."
    data-themes="${esc(JSON.stringify(themesFiltre))}"></div>
  <nav class="ancres" aria-label="Années">
    <ul>${annees.map((a) => `<li><a href="#annee-${a.annee}">${a.annee}</a></li>`).join('')}</ul>
  </nav>
  ${annees.map((a) => `<section class="section section--annee" id="annee-${a.annee}" aria-labelledby="titre-${a.annee}">
    <h2 id="titre-${a.annee}">${a.annee}</h2>
    <div class="tableau-defilant" role="region" aria-labelledby="titre-${a.annee}" tabindex="0">
    <table class="tableau tableau--conseils tableau--bibliotheque">
      <caption class="sr-only">Documents de la bibliothèque documentaire communale en ${a.annee}</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Document</th><th scope="col">Thèmes</th></tr></thead>
      <tbody>
        ${a.docs.map((d) => `<tr>
          <td>${d.date ? dateFr(d.date) : ''}</td>
          <td><a href="${urlDocumentBibliotheque(d)}">${icone('document', 'icone--mini')}<span>${esc(d.libelle)}</span> <span class="poids">${esc(formatEtPoids(d))}</span></a></td>
          <td>${(d.themes || []).map((t) => `<span class="etiquette">${esc(t)}</span>`).join(' ')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>
  </section>`).join('')}
</div>
<script src="/assets/recherche-pv.js" defer></script>` : `<section class="section" aria-labelledby="titre-vide">
    <h2 id="titre-vide">Aucun document pour le moment</h2>
    <p>Les documents de la commune apparaîtront ici, classés par année, dès leur publication.</p>
  </section>
</div>`}`;
  return page({
    site, nav, actif: 'mairie', titre: 'Bibliothèque documentaire communale',
    description: `Les documents publiés par la commune de ${site.commune.nom}, classés par année et par thème, avec une recherche dans leur texte.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' }, { libelle: 'Bibliothèque documentaire communale' }],
    contenu
  });
}

// Page d'un document de la bibliothèque. "texte" : contenu d'un .txt, lu au
// build (voir src/build.mjs), affiché tel quel.
export function pageDocumentBibliotheque(ctx, d, annee, texte) {
  return pageDocument(ctx, {
    d, texte, titre: d.libelle,
    meta: `${(d.themes || []).map((t) => `<span class="etiquette">${esc(t)}</span>`).join(' ')}${d.date ? ` <span>${dateFr(d.date)}</span>` : ''}`,
    retour: { url: `/mairie/bibliotheque-documentaire.html#annee-${annee}`, bouton: 'Retour à la bibliothèque', lien: 'Toute la bibliothèque documentaire' },
    description: `${d.libelle} — Bibliothèque documentaire communale de ${ctx.site.commune.nom} (${formatEtPoids(d)}).`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' },
      { libelle: 'Bibliothèque documentaire communale', url: '/mairie/bibliotheque-documentaire.html' }, { libelle: d.libelle }]
  });
}

// Un document affiché dans le site, avec l'en-tête, le menu et un retour à
// la liste d'où l'on vient. Ouvert seul, un PDF, une image ou une vidéo
// occupe tout l'écran sans aucun moyen de revenir au site — surtout sur
// téléphone (même constat que pour les photos des actualités, voir
// src/scripts/photo.js). "meta" : HTML déjà échappé, au-dessus du titre.
function pageDocument(ctx, { d, texte = null, titre, titrePage = titre, actif = 'mairie', meta, retour, description, fil }) {
  const { site, nav } = ctx;
  const format = formatBibliotheque(d.fichier);
  const type = format ? format.type : '';
  const src = `/documents/${esc(d.fichier)}`;
  const libelle = esc(titre);
  const ouvrir = (texteLien) => `<a href="${src}" target="_blank" rel="noopener">${texteLien}</a>`;
  let vue;
  if (type.startsWith('image/')) {
    vue = `<img class="document__image" src="${src}" alt="${libelle}">`;
  } else if (type.startsWith('video/')) {
    vue = `<video class="document__video" src="${src}" controls preload="metadata">
      <p>Ce navigateur ne lit pas cette vidéo dans la page : ${ouvrir('ouvrez-la dans un nouvel onglet')}.</p>
    </video>`;
  } else if (type.startsWith('audio/')) {
    vue = `<audio class="document__audio" src="${src}" controls preload="metadata">
      <p>Ce navigateur ne lit pas cet enregistrement dans la page : ${ouvrir('ouvrez-le dans un nouvel onglet')}.</p>
    </audio>`;
  } else if (type === 'text/plain' && texte != null) {
    vue = `<pre class="document__texte" tabindex="0">${esc(texte)}</pre>`;
  } else if (type === 'application/pdf') {
    // Les navigateurs d'ordinateur affichent le PDF dans la page ; ceux qui
    // ne savent pas (Chrome sur Android) montrent le paragraphe de repli.
    vue = `<object class="document__pdf" data="${src}" type="application/pdf" aria-label="${libelle}">
      <p>Ce navigateur n'affiche pas le PDF dans la page : ${ouvrir('ouvrez-le dans un nouvel onglet')} ou téléchargez-le avec le bouton ci-dessus.</p>
    </object>`;
  } else {
    vue = `<p>${ouvrir('Ouvrir le document dans un nouvel onglet')}.</p>`;
  }
  const contenu = `<div class="conteneur conteneur--etroit">
  <article class="article document">
    <header class="page-entete">
      ${meta ? `<p class="carte__meta">${meta}</p>` : ''}
      <h1>${libelle}</h1>
    </header>
    <p class="document__actions">
      <a class="bouton bouton--secondaire" href="${retour.url}">${icone('fleche', 'icone--retour')}<span>${esc(retour.bouton)}</span></a>
      <a class="bouton bouton--secondaire" href="${src}" target="_blank" rel="noopener">${icone('externe')}<span>Ouvrir dans un nouvel onglet</span></a>
      <a class="bouton bouton--fantome" href="${src}" download>${icone('telecharger')}<span>Télécharger <span class="poids">(${esc(formatEtPoids(d))})</span></span></a>
    </p>
    <h2 class="sr-only">Le document</h2>
    <div class="document__vue">${vue}</div>
    <p class="retour"><a href="${retour.url}">${icone('fleche', 'icone--retour')}<span>${esc(retour.lien)}</span></a></p>
  </article>
</div>`;
  return page({ site, nav, actif, titre: titrePage, description, fil, contenu });
}

// Parts entières qui totalisent exactement 100 (méthode du plus fort reste) :
// arrondir chaque part séparément donnerait parfois 99 ou 101 €.
function surCent(montants) {
  const total = montants.reduce((n, m) => n + m, 0) || 1;
  const exactes = montants.map((m) => (m * 100) / total);
  const parts = exactes.map(Math.floor);
  const ordre = exactes.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < 100 - parts.reduce((n, x) => n + x, 0); k++) parts[ordre[k][1]]++;
  return parts;
}

// « Les comptes en clair » (content/finances.json, relu chaque semaine
// depuis l'OFGL par .github/workflows/donnees-publiques.yml) : le réalisé
// de l'exercice, en complément du budget voté saisi par la mairie.
function blocComptes(ctx) {
  const f = ctx.finances;
  if (!f) return '';
  const euros0 = (n) => `${n.toLocaleString('fr-FR')} €`;
  const repartition = (titre, id, bloc) => {
    const parts = surCent(bloc.postes.map((p) => p.montant));
    return `<div class="comptes__bloc">
      <h3 id="${id}">${titre}</h3>
      <ul class="repartition" aria-labelledby="${id}">
        ${bloc.postes.map((p, i) => `<li>
          <span class="repartition__libelle">${esc(p.libelle)}</span>
          <span class="repartition__part">${parts[i]} €</span>
          <span class="repartition__piste" aria-hidden="true"><span class="repartition__valeur" style="inline-size:${parts[i]}%"></span></span>
        </li>`).join('')}
      </ul>
      <p class="note-source">Sur un total de ${euros0(bloc.total)} en ${f.exercice}.</p>
    </div>`;
  };
  const strate = f.strate && f.strate.libelle;
  return `<section class="section" aria-labelledby="comptes-titre">
    <h2 id="comptes-titre">Les comptes ${f.exercice} en clair</h2>
    <p>Ce que la commune a réellement dépensé et encaissé pour son fonctionnement courant en ${f.exercice}, d'après les comptes publiés par l'État.</p>
    <div class="comptes">
      ${repartition('Sur 100 € dépensés', 'comptes-depenses', f.depenses)}
      ${repartition('Sur 100 € encaissés', 'comptes-recettes', f.recettes)}
    </div>
    ${strate ? `<h3 class="comptes__titre" id="comparaison-titre">${esc(ctx.site.commune.nom)} et les communes de sa taille</h3>
    <div class="tableau-defilant" role="region" aria-labelledby="comparaison-titre" tabindex="0">
    <table class="tableau">
      <caption class="sr-only">Montants par habitant en ${f.exercice} : ${esc(ctx.site.commune.nom)} comparée à la moyenne des communes de ${esc(strate)}</caption>
      <thead><tr><th scope="col">Par habitant, en ${f.exercice}</th><th scope="col">${esc(ctx.site.commune.nom)}</th><th scope="col">Communes de ${esc(strate)}</th></tr></thead>
      <tbody>
        ${f.comparaisons.map((c) => `<tr><th scope="row">${esc(c.libelle)}</th><td>${euros0(c.commune)}</td><td>${c.strate == null ? '—' : euros0(c.strate)}</td></tr>`).join('')}
      </tbody>
    </table>
    </div>
    <p class="note-source">Moyenne calculée sur ${f.strate.nombreCommunes ? `${f.strate.nombreCommunes.toLocaleString('fr-FR')} communes` : 'les communes'} de ${esc(strate)} dont les comptes ${f.exercice} sont publiés. Les dépenses d'équipement varient beaucoup d'une année à l'autre, au rythme des chantiers.</p>` : ''}
    ${f.historique && f.historique.length > 1 ? `<details class="comptes__historique">
      <summary>Évolution depuis ${f.historique[0].exercice}</summary>
      <div class="tableau-defilant" role="region" aria-label="Évolution des comptes depuis ${f.historique[0].exercice}" tabindex="0">
      <table class="tableau">
        <caption class="sr-only">Dépenses d'équipement, dette restant due et épargne brute de la commune, par année</caption>
        <thead><tr><th scope="col">Année</th><th scope="col">Dépenses d'équipement</th><th scope="col">Dette restant due</th><th scope="col">Épargne brute</th></tr></thead>
        <tbody>${f.historique.slice().reverse().map((h) => `<tr><th scope="row">${h.exercice}</th><td>${euros0(h.equipement)}</td><td>${euros0(h.dette)}</td><td>${euros0(h.epargne)}</td></tr>`).join('')}</tbody>
      </table>
      </div>
    </details>` : ''}
    <p class="note-source">Source : ${lien('https://data.ofgl.fr/explore/dataset/ofgl-base-communes/', 'comptes des communes publiés par l’OFGL')}, d'après les comptes de gestion de la DGFiP (budget principal). Chiffres relus automatiquement chaque semaine — dernière vérification le ${dateFr(f.misAJour)}.</p>
  </section>`;
}

export function pageBudgets(ctx) {
  const { site, nav, budgets, documents } = ctx;
  const documentsBudgets = (documents && documents.budgets) || [];
  const fil = [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' }, { libelle: 'Budgets' }];
  const euros = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  // Le budget détaillé (sections, commentaire, projets) est saisi à la main
  // par la mairie : tant qu'elle ne l'a pas transmis, la page ne montre que
  // les comptes publics (OFGL) et les documents déposés — jamais de montant
  // reconstitué ou inventé.
  const detaille = Array.isArray(budgets.sections) && budgets.sections.length > 0;
  const max = detaille ? Math.max(...budgets.sections.map((s) => s.montant)) : 0;
  const titreBudget = detaille ? `Budget ${budgets.annee}` : 'Budgets et comptes';
  const contenu = `<div class="conteneur conteneur--etroit">
  ${banniereMuette(ctx, 'mairie', `La mairie de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>${titreBudget}</h1>
    <p class="page-entete__intro">${detaille
      ? `Voté le ${dateFr(budgets.voteLe)}, pour un total de ${euros(budgets.total)}.`
      : `Les comptes de la commune de ${esc(site.commune.nom)} en clair, et les documents budgétaires publiés par la mairie.`}</p>
  </header>

  ${detaille ? `<section class="section" aria-labelledby="sections-titre">
    <h2 id="sections-titre">Répartition</h2>
    <div class="tableau-defilant" role="region" aria-labelledby="sections-titre" tabindex="0">
    <table class="tableau">
      <caption class="sr-only">Budget ${budgets.annee} de la commune de ${esc(site.commune.nom)}, par section, comparé à l'exercice précédent</caption>
      <thead><tr><th scope="col">Section</th><th scope="col">Montant ${budgets.annee}</th><th scope="col">Exercice précédent</th></tr></thead>
      <tbody>
        ${budgets.sections.map((s) => `<tr>
          <th scope="row">${esc(s.nom)}</th>
          <td>${euros(s.montant)}</td>
          <td>${euros(s.montantPrecedent)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr><th scope="row">Total</th><td>${euros(budgets.total)}</td><td></td></tr></tfoot>
    </table>
    </div>
    <ul class="barres" aria-hidden="true">
      ${budgets.sections.map((s) => `<li><span class="barres__label">${esc(s.nom)}</span><span class="barres__piste"><span class="barres__valeur" style="inline-size:${Math.round((s.montant / max) * 100)}%"></span></span></li>`).join('')}
    </ul>
  </section>` : ''}

  ${detaille && budgets.commentaire ? `<section class="section prose" aria-labelledby="commentaire-titre">
    <h2 id="commentaire-titre">Ce qu'il faut retenir</h2>
    ${budgets.commentaire.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}
  </section>` : ''}

  ${detaille && (budgets.projets || []).length ? `<section class="section" aria-labelledby="projets-titre">
    <h2 id="projets-titre">Projets d'investissement</h2>
    <ul class="liste-detail">
      ${budgets.projets.map((p) => `<li><h3>${esc(p.titre)}</h3><p>${esc(p.detail)}</p></li>`).join('')}
    </ul>
  </section>` : ''}

  ${blocComptes(ctx)}

  <section class="documents" aria-labelledby="docs-budget">
    <h2 id="docs-budget">Documents à consulter</h2>
    ${documentsBudgets.length ? `<ul class="liste-documents">${documentsBudgets.map((d) => ligneDocument(ctx, { url: '/mairie/budgets.html', actif: 'mairie', fil, ancre: 'docs-budget' }, d)).join('')}</ul>` : ''}
    <p class="pied__note">Le budget détaillé de l'exercice en cours est consultable en mairie aux heures d'ouverture.</p>
  </section>
</div>`;
  return page({
    site, nav, actif: 'mairie', titre: titreBudget,
    description: detaille
      ? `Le budget ${budgets.annee} de la commune de ${site.commune.nom} : fonctionnement, investissement et projets.`
      : `Les comptes de la commune de ${site.commune.nom} en clair et les documents budgétaires.`,
    fil,
    contenu
  });
}

/* --------------------------------------- Agenda, fiche pratique, hors ligne */

const listeUrgences = (annuaire) => `<ul class="urgences">
  ${annuaire.urgences.map((u) => `<li><a href="tel:${esc(u.numero)}"><strong>${esc(u.numero)}</strong> <span>${esc(u.libelle)}</span></a></li>`).join('')}
</ul>`;

const daeDeLaCommune = (ctx) => ((ctx.defibrillateurs && ctx.defibrillateurs.defibrillateurs) || []).filter((d) => d.dansLaCommune);

// Les calendriers (src/calendrier.mjs, écrits par src/build.mjs dans
// /calendriers/) : l'abonnement webcal:// fait relire le fichier par
// l'agenda chaque jour, sans rien transmettre à la mairie. L'adresse est
// rendue pour site.url, puis réécrite par src/scripts/outils.js pour le
// domaine réellement consulté (utile sur le site de développement).
export function pageCalendriers(ctx) {
  const { site, nav, actualites } = ctx;
  const hote = site.url.replace(/^https?:\/\//, '');
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const aVenir = actualites
    .filter((a) => a.dateDebut && (a.dateFin || a.dateDebut) >= aujourdhui)
    .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));

  const carte = ({ id, titre, resume, fichier, contenu }) => `<section class="carte carte--calendrier" aria-labelledby="cal-${id}">
    <h2 id="cal-${id}">${titre}</h2>
    <p>${resume}</p>
    ${contenu}
    <p class="calendrier__actions">
      <a class="bouton bouton--principal" href="webcal://${esc(hote)}/calendriers/${fichier}" data-webcal="/calendriers/${fichier}">${icone('horloge')}<span>S'abonner<span class="sr-only"> au calendrier « ${titre} »</span></span></a>
      <a class="bouton bouton--secondaire" href="/calendriers/${fichier}" download>${icone('telecharger')}<span>Télécharger<span class="sr-only"> le calendrier « ${titre} »</span></span></a>
    </p>
    <p class="note-source">Adresse à copier dans votre agenda : <code class="adresse-agenda" data-adresse="/calendriers/${fichier}">${esc(site.url)}/calendriers/${fichier}</code></p>
  </section>`;

  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <h1>Les dates du village dans votre agenda</h1>
    <p class="page-entete__intro">Abonnez votre téléphone ou votre ordinateur aux calendriers de la commune : les rendez-vous s'ajoutent à votre agenda et se mettent à jour tout seuls.</p>
  </header>

  <div class="calendriers">
    ${carte({
      id: 'reguliers', titre: 'Les rendez-vous réguliers', fichier: 'rendez-vous-reguliers.ics',
      resume: 'Les services qui reviennent chaque semaine ou chaque mois.',
      contenu: `<ul class="liste-rdv">${(site.rendezVousReguliers || []).map((r) => `<li><a href="${esc(r.url)}">${esc(r.titre)}</a> — ${esc(quandRendezVous(r.regle))}</li>`).join('')}</ul>`
    })}
    ${carte({
      id: 'evenements', titre: 'Les événements du village', fichier: 'evenements.ics',
      resume: 'Manifestations, réunions et rendez-vous annoncés dans les actualités de la commune.',
      contenu: aVenir.length
        ? `<ul class="liste-rdv">${aVenir.map((a) => `<li><a href="/vie-locale/actualites/${esc(a.id)}.html">${esc(a.titre)}</a> — ${periodeActu(a)}</li>`).join('')}</ul>`
        : `<p>Aucun événement n'est annoncé pour le moment. Dès qu'une manifestation sera publiée dans les actualités, elle apparaîtra dans votre agenda.</p>`
    })}
  </div>

  <section class="section prose" aria-labelledby="comment-titre">
    <h2 id="comment-titre">Comment s'abonner&nbsp;?</h2>
    <ul>
      <li><strong>iPhone, iPad, Mac</strong> : touchez « S'abonner », puis confirmez.</li>
      <li><strong>Android (Google Agenda)</strong> : copiez l'adresse du calendrier. Sur un ordinateur, ouvrez Google Agenda, choisissez « Autres agendas », puis « À partir de l'URL », et collez l'adresse. Il apparaît ensuite sur votre téléphone.</li>
      <li><strong>Outlook</strong> : « Ajouter un calendrier », puis « S'abonner à partir du web », et collez l'adresse.</li>
      <li><strong>Pour une seule fois</strong> : « Télécharger » ajoute les dates actuelles, sans mise à jour automatique.</li>
    </ul>
    <p>S'abonner ne transmet aucune information à la mairie : votre agenda relit simplement ce fichier de temps en temps. Chaque événement daté des actualités propose aussi un bouton « Ajouter à mon agenda ».</p>
  </section>
</div>`;

  return page({
    site, nav, actif: 'vie-locale', titre: 'Les dates dans votre agenda',
    description: `Abonnez votre agenda aux rendez-vous réguliers et aux événements de la commune de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Vie locale', url: '/vie-locale/' }, { libelle: 'Les dates dans votre agenda' }],
    contenu
  });
}

// La « fiche frigo » : l'essentiel sur une page A4 à imprimer, entièrement
// tirée de site.json, annuaire.json et defibrillateurs.json — rien à
// maintenir à part. Mise en page d'impression : src/styles/impression.css.
export function pageFichePratique(ctx) {
  const { site, nav, annuaire } = ctx;
  const m = site.mairie;
  const dae = daeDeLaCommune(ctx);
  const horaires = grouperHoraires(m.horaires)
    .map((g) => `<li><span>${esc(joursTexte(g.jours))}</span><span>${esc(g.libelle)}</span></li>`).join('');

  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <h1>L'essentiel de ${esc(site.commune.nom)}</h1>
    <p class="page-entete__intro">Les numéros et les rendez-vous utiles sur une seule page, à imprimer et à garder près du téléphone ou sur le réfrigérateur.</p>
    <p><button type="button" class="bouton bouton--principal" data-imprimer hidden>${icone('document')}<span>Imprimer cette fiche</span></button></p>
  </header>

  <div class="fiche-pratique">
    <section class="fiche-pratique__bloc fiche-pratique__bloc--urgence" aria-labelledby="fp-urgences">
      <h2 id="fp-urgences">En cas d'urgence</h2>
      ${listeUrgences(annuaire)}
    </section>

    <section class="fiche-pratique__bloc" aria-labelledby="fp-mairie">
      <h2 id="fp-mairie">La mairie</h2>
      <p>${esc(m.adresse)}, ${esc(m.codePostal)} ${esc(m.ville)}</p>
      <p><a href="tel:${esc(m.telephoneLien)}"><strong>${esc(m.telephone)}</strong></a><br><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></p>
      <ul class="fiche-pratique__horaires">${horaires}</ul>
    </section>

    ${dae.length ? `<section class="fiche-pratique__bloc" aria-labelledby="fp-dae">
      <h2 id="fp-dae">Défibrillateur</h2>
      ${dae.map((d) => `<p><strong>${esc(d.adresse)}</strong><br>${texteDae(d)}</p>`).join('')}
      <p class="note-source">Arrêt cardiaque : appelez le 15, massez, défibrillez.</p>
    </section>` : ''}

    <section class="fiche-pratique__bloc" aria-labelledby="fp-rdv">
      <h2 id="fp-rdv">Rendez-vous réguliers</h2>
      <ul class="fiche-pratique__liste">${(site.rendezVousReguliers || []).map((r) => `<li><strong>${esc(r.titre)}</strong> — ${esc(quandRendezVous(r.regle))}. ${esc(r.detail || '')}</li>`).join('')}</ul>
    </section>

    ${site.riviere && site.riviere.fichePratique ? `<section class="fiche-pratique__bloc" aria-labelledby="fp-crue">
      <h2 id="fp-crue">${esc(site.riviere.fichePratique.titre)}</h2>
      <p>${esc(site.riviere.fichePratique.texte)}</p>
    </section>` : ''}

    <section class="fiche-pratique__bloc" aria-labelledby="fp-site">
      <h2 id="fp-site">Sur internet</h2>
      <p><strong>${esc(site.url.replace(/^https?:\/\//, ''))}</strong> : démarches, actualités, conseils municipaux, et l'abonnement aux actualités par courriel.</p>
    </section>
  </div>
  <p class="note-source">Fiche générée le ${dateFr(new Date().toISOString().slice(0, 10))} à partir des informations du site.</p>
</div>`;

  return page({
    site, nav, actif: 'mairie', titre: 'Fiche pratique à imprimer', classeCorps: 'page-fiche-pratique',
    description: `Numéros d'urgence, horaires de la mairie, défibrillateur et rendez-vous réguliers de ${site.commune.nom} sur une page à imprimer.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' }, { libelle: 'Fiche pratique' }],
    contenu
  });
}

// Page servie par le service worker (src/scripts/sw.js) quand une page
// demandée n'est ni en ligne ni déjà enregistrée sur l'appareil. Tout son
// contenu doit rester utile sans réseau : les appels téléphoniques
// fonctionnent, les liens pointent vers des pages mises en cache.
export function pageHorsLigne(ctx) {
  const { site, nav, annuaire } = ctx;
  const m = site.mairie;
  const dae = daeDeLaCommune(ctx);
  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <h1>Pas de connexion pour le moment</h1>
    <p class="page-entete__intro">Cette page n'a pas pu être chargée. Voici l'essentiel, enregistré sur votre appareil.</p>
  </header>

  <div class="contact-grille">
    <section class="carte carte--contact carte--urgence" aria-labelledby="hl-urgences">
      <h2 id="hl-urgences">Numéros d'urgence</h2>
      ${listeUrgences(annuaire)}
      <p class="note-source">Les appels d'urgence fonctionnent même sans connexion internet.</p>
    </section>

    <section class="carte carte--contact" aria-labelledby="hl-pages">
      <h2 id="hl-pages">Consultable sans connexion</h2>
      <ul class="liste-rdv">
        <li><a href="/cadre-de-vie/risques.html">Consignes en cas de crue ou de canicule</a></li>
        <li><a href="/mairie/fiche-pratique.html">Fiche pratique : numéros et rendez-vous utiles</a></li>
        <li><a href="/mairie/contact.html">Contact et horaires de la mairie</a></li>
        <li><a href="/">Accueil du site</a></li>
      </ul>
    </section>

    ${dae.length ? `<section class="carte carte--contact" aria-labelledby="hl-dae">
      <h2 id="hl-dae">Défibrillateur</h2>
      ${dae.map((d) => `<p><strong>${esc(d.adresse)}</strong><br>${texteDae(d)}</p>`).join('')}
    </section>` : ''}

    <section class="carte carte--contact" aria-labelledby="hl-mairie">
      <h2 id="hl-mairie">${esc(m.nom)}</h2>
      <p><a href="tel:${esc(m.telephoneLien)}"><strong>${esc(m.telephone)}</strong></a></p>
      <p>${esc(m.adresse)}, ${esc(m.codePostal)} ${esc(m.ville)}</p>
    </section>
  </div>
</div>`;
  return page({
    site, nav, titre: 'Pas de connexion',
    description: 'Page affichée hors connexion : numéros d\'urgence et pages enregistrées sur votre appareil.',
    contenu
  });
}

/* -------------------------------------------------- Thèmes, plan, erreur */

export function pageDesigns(ctx) {
  const { site, nav } = ctx;
  const themes = [
    { id: 'republique', nom: 'République', sous: 'Institutionnel', texte: "Reprend les codes du système de design de l'État : bleu France, rouge Marianne, angles nets, hiérarchie sobre. C'est la direction la plus immédiatement reconnaissable comme « site public », celle qui rassure le plus les usagers habitués à service-public.fr ou aux sites de préfecture." },
    { id: 'garrigue', nom: 'Châtaigneraie', sous: 'Identitaire', texte: "Châtaigneraie, schiste et volcans éteints : les couleurs de l'Ardèche. Titres à empattements, cartes adoucies, plus de place laissée au paysage et au patrimoine — jusqu'à la météorite de Juvinas. Donne une âme au village sans jamais sacrifier la lisibilité ni les contrastes." },
    { id: 'guichet', nom: 'Guichet', sous: 'Utilitaire', texte: "Une interface d'application : recherche dominante, tuiles denses, typographie franche, mode sombre natif. C'est la direction la plus rapide pour agir, et la plus efficace sur un petit écran tenu à une main." }
  ];
  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <h1>Les trois identités visuelles</h1>
    <p class="page-entete__intro">Un seul site, un seul contenu, trois habillages. Choisissez-en un : il s'applique immédiatement à l'ensemble des pages, et votre choix est conservé sur cet appareil.</p>
  </header>

  <div class="choix-themes">
    ${themes.map((t) => `<section class="carte carte--theme" aria-labelledby="theme-${t.id}">
      <div class="apercu apercu--${t.id}" aria-hidden="true">
        <span class="apercu__barre"></span>
        <span class="apercu__titre"></span>
        <span class="apercu__champ"></span>
        <span class="apercu__tuiles"><i></i><i></i><i></i><i></i></span>
      </div>
      <p class="carte__meta"><span class="etiquette">${esc(t.sous)}</span></p>
      <h2 id="theme-${t.id}" class="carte__titre">${esc(t.nom)}</h2>
      <p class="carte__resume">${esc(t.texte)}</p>
      <p><button class="bouton bouton--principal" type="button" data-theme-choix="${t.id}" aria-pressed="false">Appliquer « ${esc(t.nom)} »</button></p>
    </section>`).join('')}
  </div>

  <p class="sr-only" aria-live="polite" data-annonce-theme></p>

  <aside class="encadre">
    <h2>Ce que les trois thèmes ont en commun</h2>
    <p>Les trois respectent les mêmes exigences : contrastes conformes au niveau AA, focus visible, cibles tactiles d'au moins 44 pixels, fonctionnement sans JavaScript. <strong>Le choix est esthétique, jamais fonctionnel.</strong></p>
    <p>Chacun s'adapte aussi au réglage clair ou sombre de l'appareil du visiteur : les vignettes ci-dessus montrent l'apparence correspondant au vôtre.</p>

    <h2>Fixer le thème définitivement</h2>
    <p>Le thème choisi ici ne vaut que pour votre navigateur. Pour appliquer un thème à tous les visiteurs, modifiez le champ <code>theme</code> dans <code>content/site.json</code>, puis relancez <code>npm run build</code>.</p>
  </aside>
</div>`;
  return page({
    site, nav, titre: 'Les trois identités visuelles',
    description: `Comparer et appliquer les trois directions visuelles du site de la mairie de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Thèmes du site' }],
    contenu, classeCorps: 'page-designs'
  });
}

export function planDuSite(ctx, entrees) {
  const { site, nav } = ctx;
  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <h1>Plan du site</h1>
    <p class="page-entete__intro">Toutes les pages du site, en un seul endroit.</p>
  </header>
  ${entrees.map((groupe) => `<section class="section">
    <h2>${esc(groupe.titre)}</h2>
    <ul class="liste-simple">
      ${groupe.pages.map((p) => `<li><a href="${esc(p.url)}">${esc(p.titre)}</a></li>`).join('')}
    </ul>
  </section>`).join('')}
</div>`;
  return page({
    site, nav, titre: 'Plan du site',
    description: `Plan complet du site de la mairie de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Plan du site' }],
    contenu
  });
}

export function page404(ctx) {
  const { site, nav, demarches } = ctx;
  const parId = Object.fromEntries(demarches.map((d) => [d.id, d]));
  const tuiles = site.accueil.tuiles.slice(0, 4).map((id) => parId[id]).filter(Boolean);
  const contenu = `<div class="conteneur conteneur--etroit">
  <header class="page-entete">
    <h1>Cette page n'existe pas</h1>
    <p class="page-entete__intro">Le lien est peut-être ancien, ou l'adresse comporte une erreur. Voici de quoi retrouver votre chemin.</p>
  </header>
  ${champRecherche(site, { id: 'recherche', label: 'Rechercher ce que vous cherchiez' })}
  <section class="section">
    <h2>Les démarches les plus demandées</h2>
    <ul class="tuiles">${tuiles.map(tuile).join('')}</ul>
  </section>
  <p><a class="bouton bouton--secondaire" href="/">${icone('accueil')}<span>Retour à l'accueil</span></a>
     <a class="bouton bouton--secondaire" href="/plan-du-site.html">${icone('carte')}<span>Plan du site</span></a></p>
</div>`;
  return page({ site, nav, titre: 'Page introuvable', description: 'La page demandée est introuvable.', contenu });
}
