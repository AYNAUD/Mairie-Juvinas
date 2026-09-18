/* Menu mobile et fenêtre de recherche : ouverture, fermeture, piège de focus. */
(function () {
  'use strict';
  var SELECTEUR_FOCUS = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  /* --- Menu principal ---------------------------------------------------- */
  var boutonMenu = document.querySelector('[data-ouvre-menu]');
  var menu = document.getElementById('menu-principal');

  if (boutonMenu && menu) {
    boutonMenu.addEventListener('click', function () {
      var ouvert = boutonMenu.getAttribute('aria-expanded') === 'true';
      boutonMenu.setAttribute('aria-expanded', String(!ouvert));
      menu.classList.toggle('est-ouvert', !ouvert);
    });
    menu.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { boutonMenu.setAttribute('aria-expanded', 'false'); menu.classList.remove('est-ouvert'); boutonMenu.focus(); }
    });
  }

  /* --- Fenêtre de recherche ----------------------------------------------- */
  var overlay = document.getElementById('overlay-recherche');
  if (!overlay) return;
  var declencheur = null;

  function ouvrir(depuis) {
    declencheur = depuis || document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    var champ = overlay.querySelector('input[type="search"]');
    if (champ) { champ.focus(); champ.select(); }
  }

  function fermer() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (declencheur && document.contains(declencheur)) declencheur.focus();
  }

  document.addEventListener('click', function (ev) {
    var ouvreur = ev.target.closest('[data-ouvre-recherche]');
    if (ouvreur) { ev.preventDefault(); ouvrir(ouvreur); return; }
    if (ev.target.closest('[data-ferme-recherche]')) { ev.preventDefault(); fermer(); }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !overlay.hidden) { fermer(); return; }

    // Raccourci « / » pour ouvrir la recherche, comme dans les outils du quotidien.
    var cible = ev.target;
    var saisie = cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.isContentEditable);
    if (ev.key === '/' && !saisie && overlay.hidden) { ev.preventDefault(); ouvrir(cible); return; }

    if (ev.key === 'Tab' && !overlay.hidden) {
      var focusables = Array.prototype.filter.call(
        overlay.querySelectorAll(SELECTEUR_FOCUS),
        function (el) { return el.offsetParent !== null; }
      );
      if (!focusables.length) return;
      var premier = focusables[0], dernier = focusables[focusables.length - 1];
      if (ev.shiftKey && document.activeElement === premier) { ev.preventDefault(); dernier.focus(); }
      else if (!ev.shiftKey && document.activeElement === dernier) { ev.preventDefault(); premier.focus(); }
    }
  });
})();
