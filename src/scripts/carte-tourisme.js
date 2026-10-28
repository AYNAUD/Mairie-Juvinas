// Infobulles de la carte « Autour de la commune » (page Tourisme, voir
// src/templates/views.mjs, carteTourisme). Sans ce script, chaque repère
// est un lien vers la fiche du site, dans la liste sous la carte. Avec, il
// devient un bouton qui ouvre sur place une infobulle reprenant cette fiche
// (trajet, description, lien vers le site officiel) :
// - au survol de la souris, le temps de passer dessus (elle reste ouverte
//   tant que le pointeur est sur le repère ou sur elle) ;
// - au clic, au toucher, ou avec Entrée ou Espace au clavier : le focus
//   passe alors dans l'infobulle, lue par les lecteurs d'écran.
// Échap la ferme et rend le focus au repère ; un clic ailleurs aussi.
(function () {
  var carte = document.querySelector('[data-carte-tourisme]');
  if (!carte) return;
  var figure = carte.querySelector('.carte-tourisme__figure');
  var cadre = carte.querySelector('.carte-tourisme__cadre');
  var plan = carte.querySelector('.carte-tourisme__plan');
  var reperes = carte.querySelectorAll('.carte-tourisme__repere');
  var modeleFermer = document.getElementById('carte-tourisme-fermer');
  if (!figure || !cadre || !reperes.length) return;

  var bulle = document.createElement('div');
  bulle.className = 'infobulle-tourisme';
  bulle.id = 'infobulle-tourisme';
  bulle.setAttribute('role', 'dialog');
  bulle.setAttribute('aria-labelledby', 'infobulle-tourisme-titre');
  bulle.tabIndex = -1;
  bulle.hidden = true;
  var contenu = document.createElement('div');
  var fermer = modeleFermer && modeleFermer.content
    ? modeleFermer.content.firstElementChild.cloneNode(true)
    : document.createElement('button');
  if (!fermer.className) {
    fermer.type = 'button';
    fermer.className = 'infobulle-tourisme__fermer';
    fermer.textContent = 'Fermer';
  }
  bulle.appendChild(contenu);
  bulle.appendChild(fermer);
  // Juste après la carte : du dernier élément de l'infobulle, Tab mène à
  // la légende puis à la liste, dans l'ordre de lecture.
  figure.insertBefore(bulle, cadre.nextSibling);

  var ouvert = null;     // repère dont l'infobulle est affichée
  var epingle = false;   // ouverte au clic ou au clavier (pas seulement survolée)
  var minuterie = null;

  // Le contenu est copié de la fiche du site dans la liste : une seule
  // source, et rien à dupliquer dans la page.
  function remplir(id) {
    var fiche = document.getElementById('tourisme-' + id);
    contenu.innerHTML = '';
    if (!fiche) return;
    var corps = fiche.querySelector('.tourisme-site__corps').cloneNode(true);
    var nom = corps.querySelector('.tourisme-site__nom');
    var titre = document.createElement('p');
    titre.className = 'infobulle-tourisme__titre';
    titre.id = 'infobulle-tourisme-titre';
    titre.textContent = nom.textContent;
    nom.parentNode.replaceChild(titre, nom);
    contenu.appendChild(corps);
  }

  function placer() {
    if (!ouvert) return;
    var f = figure.getBoundingClientRect();
    var r = ouvert.getBoundingClientRect();
    var largeur = bulle.offsetWidth, hauteur = bulle.offsetHeight;
    var cx = r.left + r.width / 2 - f.left;
    var gauche = Math.min(Math.max(8, cx - largeur / 2), f.width - largeur - 8);
    // Sous le repère si elle y tient à l'écran, sinon du côté le plus
    // dégagé, sans compter ce que cache l'en-tête collant.
    var entete = document.querySelector('.entete');
    var placeDessus = r.top - (entete ? Math.max(0, entete.getBoundingClientRect().bottom) : 0) - 10;
    var placeDessous = window.innerHeight - r.bottom - 10;
    var dessous = placeDessous >= hauteur || placeDessous >= placeDessus;
    var haut = dessous ? r.bottom - f.top + 10 : r.top - f.top - hauteur - 10;
    bulle.style.left = Math.round(gauche) + 'px';
    bulle.style.top = Math.round(haut) + 'px';
    bulle.style.setProperty('--fleche', Math.round(Math.min(Math.max(cx - gauche, 16), largeur - 16)) + 'px');
    bulle.classList.toggle('infobulle-tourisme--dessus', !dessous);
  }

  function ouvrir(repere, auClavier) {
    clearTimeout(minuterie);
    if (ouvert !== repere) {
      if (ouvert) ouvert.setAttribute('aria-expanded', 'false');
      ouvert = repere;
      remplir(repere.getAttribute('data-site'));
      repere.setAttribute('aria-expanded', 'true');
    }
    bulle.hidden = false;
    placer();
    if (auClavier) {
      epingle = true;
      // Défilement à part : celui du focus ignore l'en-tête collant, qui
      // masquerait le haut de l'infobulle (scroll-margin, dans le CSS).
      bulle.focus({ preventScroll: true });
      bulle.scrollIntoView({ block: 'nearest' });
    }
  }

  function refermer(rendreFocus) {
    clearTimeout(minuterie);
    if (!ouvert) return;
    var repere = ouvert;
    ouvert = null;
    epingle = false;
    repere.setAttribute('aria-expanded', 'false');
    bulle.hidden = true;
    if (rendreFocus) repere.focus();
  }

  function refermerBientot() {
    clearTimeout(minuterie);
    if (!epingle) minuterie = setTimeout(function () { refermer(false); }, 300);
  }

  Array.prototype.forEach.call(reperes, function (repere) {
    repere.setAttribute('role', 'button');
    repere.setAttribute('aria-expanded', 'false');
    repere.setAttribute('aria-controls', bulle.id);
    repere.addEventListener('click', function (e) {
      e.preventDefault();
      if (ouvert === repere && epingle) refermer(false);
      else ouvrir(repere, true);
    });
    // Un lien ne réagit qu'à Entrée : Espace aussi, comme pour un bouton.
    repere.addEventListener('keydown', function (e) {
      if (e.key === ' ') {
        e.preventDefault();
        ouvrir(repere, true);
      }
    });
    repere.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse' && !epingle) ouvrir(repere, false);
    });
    repere.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') refermerBientot();
    });
  });

  bulle.addEventListener('pointerenter', function () { clearTimeout(minuterie); });
  bulle.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse') refermerBientot();
  });
  fermer.addEventListener('click', function () { refermer(true); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ouvert) {
      var dedans = bulle.contains(document.activeElement) || document.activeElement === ouvert;
      refermer(dedans);
    }
  });
  document.addEventListener('click', function (e) {
    if (ouvert && !bulle.contains(e.target) && !e.target.closest('.carte-tourisme__repere')) refermer(false);
  });
  // Le focus quitte l'infobulle (Tab, Maj+Tab) vers autre chose que son
  // repère : elle se ferme. Pas quand la fenêtre perd le focus, à
  // l'ouverture du site officiel dans un nouvel onglet par exemple.
  bulle.addEventListener('focusout', function (e) {
    if (e.relatedTarget && !bulle.contains(e.relatedTarget) && e.relatedTarget !== ouvert) refermer(false);
  });

  cadre.addEventListener('scroll', placer, { passive: true });
  window.addEventListener('resize', placer);

  // Sur un écran étroit, le plan défile dans son cadre : on l'ouvre centré
  // sur la commune plutôt que sur son bord gauche.
  var centre = parseFloat(plan.getAttribute('data-centre'));
  if (cadre.scrollWidth > cadre.clientWidth && !isNaN(centre)) {
    cadre.scrollLeft = (centre / 100) * cadre.scrollWidth - cadre.clientWidth / 2;
  }
})();
