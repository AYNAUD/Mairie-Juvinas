import { page, esc, lien, icone, champRecherche, suggestions, grouperHoraires, joursTexte } from './layout.mjs';
import { rendre } from '../markdown.mjs';

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
// simplement de leur position par rapport à aujourd'hui.
function etatConsultation(c, aujourdhui) {
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
<section class="heros" aria-labelledby="heros-titre">
  <div class="conteneur">
    <h1 id="heros-titre" class="heros__titre">Que souhaitez-vous faire&nbsp;?</h1>
    <p class="heros__intro">Toutes vos démarches à ${esc(site.commune.nom)}, en trois clics au maximum.</p>
    ${champRecherche(site, { id: 'recherche', label: 'Rechercher une démarche ou une information' })}
    <p class="pratique__statut heros__statut" data-statut-mairie data-horaires="${esc(donneesHoraires(site.mairie.horaires))}">
      <span class="pastille" aria-hidden="true"></span>
      <span data-statut-texte>${esc(resumeHoraires(site.mairie.horaires))}</span>
      <a href="#pratique-titre">Voir le détail</a>
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

  return page({ site, nav, titre: '', description: site.description, contenu, actif: '', classeCorps: 'page-accueil', actualitesCount: actualites.length, consultationsCount: nbConsultationsOuvertes });
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

  const contenu = `<div class="conteneur conteneur--etroit">
  <article class="fiche">
    ${banniereMuette(ctx, cat.photo, cat.photoAlt)}
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
      <h2 id="docs-${esc(d.id)}">Documents à télécharger</h2>
      <ul class="liste-documents">
        ${d.documents.map((doc) => `<li><a href="/documents/${esc(doc.fichier)}" download>${icone('telecharger', 'icone--mini')}<span>${esc(doc.libelle)}</span> <span class="poids">PDF</span></a></li>`).join('')}
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
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Mes démarches', url: '/demarches/' }, { libelle: d.titreCourt }],
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
      <p class="champ-piege">
        <label for="abonnement-site">Ne remplissez pas ce champ, réservé à la détection automatisée</label>
        <input type="text" id="abonnement-site" name="site_web" tabindex="-1" autocomplete="off">
      </p>
      <button type="submit" class="bouton bouton--principal bouton--large">M'abonner</button>
    </form>
    <p class="formulaire-simple__note">Un courriel de confirmation vous sera envoyé : votre inscription n'est effective qu'après avoir cliqué sur le lien qu'il contient. Vous pourrez vous désabonner à tout moment, en un clic, depuis n'importe quel courriel reçu. En savoir plus sur <a href="/donnees-personnelles.html">le traitement de vos données</a>.</p>
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
  return `<figure class="banniere-page">
    <img src="/img/${esc(nom)}-1200.jpg"
         srcset="/img/${esc(nom)}-700.jpg 700w, /img/${esc(nom)}-1200.jpg 1200w"
         sizes="(min-width: 48em) 48rem, 100vw"
         width="${d.largeur}" height="${d.hauteur}" loading="lazy" decoding="async"
         alt="${esc(alt || '')}">
    ${credit ? `<figcaption>${esc(credit)}</figcaption>` : ''}
  </figure>`;
}

// Un document peut venir du front-matter Markdown (chaîne "fichier.pdf | Libellé",
// ou tableau de telles chaînes) ou du registre content/documents.json (objets
// {fichier, libelle} déjà normalisés) — normaliserDocuments ramène les deux
// formes à la même forme d'objet, sans toucher au parseur de front-matter.
function normaliserDocuments(source) {
  if (!source) return [];
  return (Array.isArray(source) ? source : [source]).map((d) => {
    if (d && typeof d === 'object') return d;
    const [fichier, ...reste] = String(d).split('|');
    return { fichier: fichier.trim(), libelle: reste.join('|').trim() || fichier.trim() };
  });
}

function ligneDocument(d) {
  return `<li><a href="/documents/${esc(d.fichier)}" download>${icone('telecharger', 'icone--mini')}<span>${esc(d.libelle)}</span> <span class="poids">PDF</span></a></li>`;
}

function blocDocuments(items) {
  if (!items || !items.length) return '';
  return `<section class="documents" aria-labelledby="documents-titre">
    <h2 id="documents-titre">Documents à télécharger</h2>
    <ul class="liste-documents">${items.map(ligneDocument).join('')}</ul>
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

export function pageMarkdown(ctx, p) {
  const { site, nav } = ctx;
  let { html, sommaire } = rendre(p.corps);
  const rub = nav.find((n) => n.id === p.meta.rubrique);
  const fil = [{ libelle: 'Accueil', url: '/' }];
  if (rub) fil.push({ libelle: rub.libelle, url: rub.url });
  fil.push({ libelle: p.meta.titre });

  // "bulletins" est une clé plate (comme "budgets"), pas "pages/bulletins" :
  // voir CLAUDE.md « Ajouter un document » et worker/README.md.
  const documentsBulletins = p.slug === 'bulletins' ? (ctx.documents && ctx.documents.bulletins) || [] : [];
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
    ${blocDocuments(documents)}
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
  const corps = a.corps ? a.corps.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('\n') : '';
  const contenu = `<div class="conteneur conteneur--etroit">
  <article class="article">
    <header class="page-entete">
      <p class="carte__meta"><span class="etiquette">${esc(a.categorie)}</span> ${periodeActu(a)}</p>
      <h1>${esc(a.titre)}</h1>
    </header>
    <h2 class="sr-only">Détail de l'actualité</h2>
    <div class="article__corps">
      ${a.image ? `<figure class="article__image">
        <img src="${esc(a.image.chemin)}" alt="${esc(a.image.alt)}">
        <figcaption><a href="${esc(a.image.cheminOriginal)}">Voir la photo en taille réelle</a></figcaption>
      </figure>` : ''}
      ${a.chapeau ? `<p class="page-entete__intro">${esc(a.chapeau)}</p>` : ''}
      ${corps ? `<div class="prose">${corps}</div>` : ''}
    </div>
    ${a.liens && a.liens.length ? `<nav class="liens-suite" aria-label="Pour aller plus loin">
      <h2>Pour aller plus loin</h2>
      <ul>${a.liens.map((l) => `<li>${l.type === 'externe' ? lien(l.url, esc(l.libelle)) : `<a href="${esc(l.url)}">${esc(l.libelle)}</a>`}</li>`).join('')}</ul>
    </nav>` : ''}
    <p class="retour"><a href="/vie-locale/actualites.html">${icone('fleche')}<span>Toutes les actualités</span></a></p>
  </article>
</div>`;
  return page({
    site, nav, actif: 'vie-locale', titre: a.titre, description: a.chapeau,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Actualités', url: '/vie-locale/actualites.html' }, { libelle: a.titre }],
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
    ${c.chapeau ? `<p>${esc(c.chapeau)}</p>` : ''}
  </header>
  ${formulaireVote}
  ${c.corps ? `<div class="prose">${c.corps.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
  ${blocResultats}
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
  if (c.horaires) bits.push(`<li>${icone('horloge', 'icone--mini')}<span>${esc(c.horaires)}</span></li>`);
  return bits.length ? `<ul class="contact-liste">${bits.join('')}</ul>` : '';
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

  const [mx, my] = proj([site.commune.longitude, site.commune.latitude]);
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
      <span><span class="carte-lecques__trait carte-lecques__trait--riviere" aria-hidden="true"></span>La Bésorgues</span>
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

export function pageProfessionnels(ctx) {
  const { site, nav, annuaire, entreprises } = ctx;
  const professionnels = (annuaire.professionnels || []);
  const contenu = `<div class="conteneur">
  ${banniereMuette(ctx, 'village', `Le village de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Acteurs économiques</h1>
    <p class="page-entete__intro">Les professionnels installés à ${esc(site.commune.nom)} sont à votre écoute.</p>
  </header>
  ${professionnels.length ? `<ul class="grille-cartes grille-cartes--large">
    ${professionnels.map((p) => `<li class="carte">
      <p class="carte__meta"><span class="etiquette">${esc(p.activite)}</span></p>
      <h2 class="carte__titre">${esc(p.nom)}</h2>
      ${p.enseigne ? `<p class="carte__enseigne">${esc(p.enseigne)}</p>` : ''}
      ${p.note ? `<p class="carte__detail">${esc(p.note)}</p>` : ''}
      ${ligneContact(p)}
    </li>`).join('')}
  </ul>` : ''}
  <aside class="encadre">
    <h2>Vous êtes professionnel à ${esc(site.commune.nom)}&nbsp;?</h2>
    <p>Signalez-vous au secrétariat de mairie pour figurer dans cet annuaire et dans le bulletin municipal. La présence dans l'annuaire est gratuite.</p>
    <p><a class="bouton bouton--secondaire" href="mailto:${esc(site.mairie.email)}?subject=Inscription%20%C3%A0%20l%27annuaire%20des%20professionnels">${icone('courriel')}<span>Me faire connaître</span></a></p>
  </aside>

  ${entreprises && entreprises.entreprises && entreprises.entreprises.length ? `<section class="section section--sirene">
    <h2>Annuaire officiel Sirene des activités économiques</h2>
    <p class="page-entete__intro">Cette liste complémentaire est générée automatiquement à partir du répertoire Sirene de l'Insee (base officielle des entreprises, auto-entrepreneurs et associations).${professionnels.length ? ' Contrairement à la liste ci-dessus, elle' : ' Elle'} n'est pas relue à la main : elle recense les établissements actifs déclarés à ${esc(site.commune.nom)}, mais certaines adresses ne sont pas rendues publiques par leurs titulaires, et une activité récente peut ne pas encore y figurer.${entreprises.misAJour ? `<br>Dernière mise à jour&nbsp;: ${dateFr(entreprises.misAJour)}.` : ''}</p>
    <p><a class="bouton bouton--secondaire" href="/vie-locale/carte-acteurs-economiques.html">${icone('carte')}<span>Cartographie des acteurs économiques</span></a></p>
    <ul class="liste-entreprises">
      ${entreprises.entreprises.map((ent) => `<li class="ligne-entreprise">
        ${icone(ent.icone, 'icone--mini')}
        <span class="ligne-entreprise__corps">
          <span class="ligne-entreprise__nom">${lien(`https://annuaire-entreprises.data.gouv.fr/entreprise/${esc(ent.siren)}`, esc(ent.nom))}${ent.enseigne ? ` <span class="ligne-entreprise__enseigne">— ${esc(ent.enseigne)}</span>` : ''}</span>
          <span class="ligne-entreprise__meta">${ent.association ? 'Association' : esc(ent.nafLibelle || '')} · ${esc(ent.adresse)}${ent.dateCreation ? ` · créé le ${dateFr(ent.dateCreation)}` : ''}</span>
        </span>
      </li>`).join('')}
    </ul>
    <p class="carte__detail">Une erreur, une fermeture, une activité manquante&nbsp;? <a href="mailto:${esc(site.mairie.email)}?subject=Annuaire%20Sirene%20-%20correction">Signalez-le au secrétariat de mairie</a>.</p>
  </section>` : ''}
</div>`;
  return page({
    site, nav, actif: 'vie-locale', titre: 'Acteurs économiques',
    description: `Annuaire des professionnels et commerçants de ${site.commune.nom}.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'Vie locale', url: '/vie-locale/' }, { libelle: 'Acteurs économiques' }],
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
  const contenu = `<div class="conteneur conteneur--etroit">
  ${banniereMuette(ctx, 'mairie', `La mairie de ${site.commune.nom}.`)}
  <header class="page-entete">
    <h1>Les élus</h1>
    <p class="page-entete__intro">${esc(elus.intro)}</p>
  </header>
  <section class="section" aria-labelledby="conseil-titre">
    <h2 id="conseil-titre">Le conseil municipal</h2>
    <ul class="grille-cartes grille-cartes--compacte">
      ${elus.conseil.map((p) => `<li class="carte carte--elu">
        <p class="carte__nom">${esc(p.prenom)} ${esc(p.nom)}</p>
        <p class="carte__fonction">${esc(p.fonction)}</p>
      </li>`).join('')}
    </ul>
  </section>
  ${blocDocuments(documentsElus)}
  <aside class="encadre">
    <h2>Rencontrer un élu</h2>
    <p>Le maire et ses adjoints reçoivent sur rendez-vous. Les séances du conseil municipal sont publiques et ouvertes à tous les habitants.</p>
    <p><a class="bouton bouton--secondaire" href="/demarches/rendez-vous-elu.html">${icone('fleche')}<span>Demander un rendez-vous</span></a></p>
  </aside>
</div>`;
  return page({
    site, nav, actif: 'mairie', titre: 'Les élus',
    description: `Le conseil municipal de ${site.commune.nom} : le maire, les adjoints et les conseillers municipaux.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' }, { libelle: 'Les élus' }],
    contenu
  });
}

export function pageCommissions(ctx) {
  const { site, nav, elus, documents } = ctx;
  const documentsCommissions = (documents && documents.commissions) || [];
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

  ${blocDocuments(documentsCommissions)}
</div>`;
  return page({
    site, nav, actif: 'mairie', titre: 'Commissions',
    description: `Commissions municipales et représentations de la commune de ${site.commune.nom} dans les syndicats intercommunaux.`,
    fil: [{ libelle: 'Accueil', url: '/' }, { libelle: 'La mairie', url: '/mairie/' }, { libelle: 'Commissions' }],
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
  <div id="recherche-pv"></div>
  ${conseils.length ? `<nav class="ancres" aria-label="Années">
    <ul>${conseils.map((a) => `<li><a href="#annee-${a.annee}">${a.annee}</a></li>`).join('')}</ul>
  </nav>` : `<section class="section" aria-labelledby="aucune-seance-titre">
    <h2 id="aucune-seance-titre">Aucune séance enregistrée pour le moment</h2>
    <p>Les comptes-rendus seront publiés ici au fil des séances.</p>
  </section>`}
  ${conseils.map((a) => {
    const docsAnnee = (documents && documents[`conseils/${a.annee}`]) || [];
    return `<section class="section section--annee" id="annee-${a.annee}" aria-labelledby="titre-${a.annee}">
    <h2 id="titre-${a.annee}">${a.annee}</h2>
    <div class="tableau-defilant tableau-defilant--vertical" role="region" aria-labelledby="titre-${a.annee}" tabindex="0">
    <table class="tableau tableau--conseils">
      <caption class="sr-only">Séances du conseil municipal de ${esc(site.commune.nom)} en ${a.annee}</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Compte-rendu</th></tr></thead>
      <tbody>
        ${a.seances.map((s) => {
          const local = docsAnnee.find((d) => d.date === s.date);
          const date = `<td>${dateFr(s.date)}</td>`;
          if (local) return `<tr>${date}<td><a href="/documents/${esc(local.fichier)}" download>${icone('telecharger', 'icone--mini')}<span>${esc(s.libelle)}</span> <span class="poids">PDF</span></a></td></tr>`;
          if (s.url) return `<tr>${date}<td>${lien(s.url, `${icone('telecharger', 'icone--mini')}<span>${esc(s.libelle)}</span>`)}</td></tr>`;
          return `<tr class="indisponible">${date}<td>${icone('horloge', 'icone--mini')}<em>${esc(s.note || 'À paraître')}</em></td></tr>`;
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

// pageBudgets (Lecques) retirée de ce fork : elle affichait des montants
// réels par section, qu'aucune source publique ne permet de reconstituer
// pour une autre commune. À réécrire une fois que la mairie de Juvinas aura
// fourni son budget détaillé (voir content/budgets.json).

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
