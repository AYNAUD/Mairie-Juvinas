/* Agrandissement de la photo d'une actualité, en place plutôt que par
   navigation vers le fichier image seul : sur certains navigateurs mobiles,
   ce fichier s'affiche sans aucun bouton retour et rend impossible le retour
   à l'article. Sans JavaScript, le lien garde son comportement d'origine
   (il ouvre directement l'image). */
(function () {
  'use strict';
  var declencheurs = document.querySelectorAll('[data-photo-zoom]');
  if (!declencheurs.length) return;

  var SELECTEUR_FOCUS = 'a[href], button:not([disabled])';

  var overlay = document.createElement('div');
  overlay.className = 'overlay overlay--photo';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Photo en taille réelle');
  overlay.innerHTML =
    '<div class="overlay__voile" data-ferme-photo></div>' +
    '<button type="button" class="overlay__fermer" data-ferme-photo aria-label="Fermer la photo">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m5.5 5.5 13 13M18.5 5.5l-13 13"/></svg>' +
    '</button>' +
    '<img class="overlay__photo" alt="" data-ferme-photo>';
  document.body.appendChild(overlay);

  var img = overlay.querySelector('.overlay__photo');
  var boutonFermer = overlay.querySelector('.overlay__fermer');
  var declencheur = null;

  function ouvrir(lien) {
    var figure = lien.closest('figure');
    var source = figure ? figure.querySelector('img') : null;
    declencheur = lien;
    img.src = lien.getAttribute('href');
    img.alt = source ? source.alt : '';
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    boutonFermer.focus();
  }

  function fermer() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    img.src = '';
    if (declencheur && document.contains(declencheur)) declencheur.focus();
  }

  Array.prototype.forEach.call(declencheurs, function (lien) {
    lien.addEventListener('click', function (ev) { ev.preventDefault(); ouvrir(lien); });
  });

  overlay.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-ferme-photo]')) fermer();
  });

  document.addEventListener('keydown', function (ev) {
    if (overlay.hidden) return;
    if (ev.key === 'Escape') { fermer(); return; }
    if (ev.key !== 'Tab') return;
    var focusables = overlay.querySelectorAll(SELECTEUR_FOCUS);
    if (focusables.length < 2) { ev.preventDefault(); return; }
    var premier = focusables[0], dernier = focusables[focusables.length - 1];
    if (ev.shiftKey && document.activeElement === premier) { ev.preventDefault(); dernier.focus(); }
    else if (!ev.shiftKey && document.activeElement === dernier) { ev.preventDefault(); premier.focus(); }
  });
})();
