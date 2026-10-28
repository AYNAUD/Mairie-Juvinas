/* Menu principal (mobile et sous-rubriques) et fenêtre de recherche :
   ouverture, fermeture, piège de focus. */
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
  }

  /* --- Sous-rubriques ------------------------------------------------------
     Sur ordinateur, chaque entrée déroule son panneau au survol de la souris :
     ouverture après un court temps (balayer la barre n'ouvre rien),
     fermeture différée (passer de l'entrée au panneau, ou y revenir après un
     écart, ne le referme pas). Le bouton chevron l'ouvre au clavier et au
     toucher ; Échap, un clic ailleurs ou la sortie du focus le referment.
     Sur téléphone, le même bouton déplie les sous-rubriques dans le menu.
     Sans ce script, le CSS ouvre les panneaux au survol et au focus.
     Portée à part : nommées ouvrir/fermer dans la même fonction que la
     fenêtre de recherche, ces fonctions avaient été écrasées par les siennes
     et le survol du menu ouvrait la recherche. */
  (function () {
    var DELAI_OUVERTURE = 100, DELAI_FERMETURE = 300;
    var grandEcran = window.matchMedia('(min-width: 64em)');
    var entrees = menu ? Array.prototype.filter.call(
      menu.querySelectorAll('.menu__entree'),
      function (entree) { return entree.querySelector('.menu__deplier'); }
    ) : [];
    var minuterie = null;

    function boutonDe(entree) { return entree.querySelector('.menu__deplier'); }
    function panneauDe(entree) { return entree.querySelector('.menu__sous'); }
    function estDepliee(entree) { return entree.classList.contains('est-deplie'); }

    // Un panneau qui sortirait de l'écran (dernière entrée, texte agrandi qui
    // fait passer la barre sur deux lignes) s'aligne sur l'autre bord de son entrée.
    function placer(panneau) {
      panneau.classList.remove('menu__sous--droite', 'menu__sous--gauche');
      var cadre = panneau.getBoundingClientRect();
      if (cadre.right > document.documentElement.clientWidth) panneau.classList.add('menu__sous--droite');
      else if (cadre.left < 0) panneau.classList.add('menu__sous--gauche');
    }

    // « par » vaut 'survol' ou 'clic' : un panneau ouvert au survol se referme
    // quand la souris s'en va, un panneau ouvert par le bouton reste ouvert.
    function deplier(entree, par) {
      if (grandEcran.matches) entrees.forEach(function (autre) { if (autre !== entree) replier(autre); });
      entree.classList.add('est-deplie');
      entree.setAttribute('data-ouvert-par', par);
      boutonDe(entree).setAttribute('aria-expanded', 'true');
      if (grandEcran.matches) placer(panneauDe(entree));
    }

    function replier(entree) {
      entree.classList.remove('est-deplie');
      entree.removeAttribute('data-ouvert-par');
      boutonDe(entree).setAttribute('aria-expanded', 'false');
    }

    function replierTout() { clearTimeout(minuterie); entrees.forEach(replier); }

    entrees.forEach(function (entree) {
      boutonDe(entree).addEventListener('click', function () {
        clearTimeout(minuterie);
        // Un clic sur le chevron d'un panneau ouvert au survol le garde ouvert.
        if (estDepliee(entree) && entree.getAttribute('data-ouvert-par') !== 'survol') replier(entree);
        else deplier(entree, 'clic');
      });

      entree.addEventListener('pointerenter', function (ev) {
        if (ev.pointerType !== 'mouse' || !grandEcran.matches) return;
        clearTimeout(minuterie);
        if (estDepliee(entree)) return;
        // D'une entrée ouverte à sa voisine : pas d'attente.
        var dejaOuvert = entrees.some(estDepliee);
        if (dejaOuvert) deplier(entree, 'survol');
        else minuterie = setTimeout(function () { deplier(entree, 'survol'); }, DELAI_OUVERTURE);
      });

      entree.addEventListener('pointerleave', function (ev) {
        if (ev.pointerType !== 'mouse' || !grandEcran.matches) return;
        clearTimeout(minuterie);
        if (entree.getAttribute('data-ouvert-par') === 'survol') {
          minuterie = setTimeout(function () {
            // Focus placé entre-temps dans le panneau : il reste ouvert, et se
            // refermera quand le focus en sortira.
            if (panneauDe(entree).contains(document.activeElement)) entree.setAttribute('data-ouvert-par', 'clic');
            else replier(entree);
          }, DELAI_FERMETURE);
        }
      });

      // Au clavier, le panneau se referme quand le focus quitte l'entrée.
      entree.addEventListener('focusout', function (ev) {
        if (grandEcran.matches && estDepliee(entree) && !entree.contains(ev.relatedTarget)
          && entree.getAttribute('data-ouvert-par') !== 'survol') replier(entree);
      });
    });

    if (menu) {
      if (entrees.length) menu.classList.add('menu--pilote');

      // Échap referme d'abord le panneau où se trouve le focus (le focus revient
      // sur son bouton), puis, au téléphone, le menu lui-même.
      menu.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape') return;
        var entree = ev.target.closest('.menu__entree');
        if (entree && estDepliee(entree)) {
          ev.stopPropagation();
          if (panneauDe(entree).contains(document.activeElement)) boutonDe(entree).focus();
          replier(entree);
          return;
        }
        if (boutonMenu && boutonMenu.getAttribute('aria-expanded') === 'true') {
          boutonMenu.setAttribute('aria-expanded', 'false');
          menu.classList.remove('est-ouvert');
          boutonMenu.focus();
        }
      });

      // Panneau ouvert au survol alors que le focus est ailleurs : Échap le
      // referme aussi, comme un clic (ou un toucher) en dehors de l'entrée.
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && grandEcran.matches) replierTout();
      });
      document.addEventListener('pointerdown', function (ev) {
        if (!grandEcran.matches) return;
        entrees.forEach(function (entree) { if (!entree.contains(ev.target)) replier(entree); });
      });

      // Sous-rubrique qui mène à une section de la page affichée (catégories
      // de « Mes démarches » depuis /demarches/) : la page ne se recharge pas,
      // on referme donc le panneau, et le menu du téléphone, qui cacheraient
      // la section atteinte.
      menu.addEventListener('click', function (ev) {
        var lien = ev.target.closest('.menu__sous a');
        if (!lien || !lien.hash || lien.pathname !== location.pathname) return;
        replierTout();
        if (boutonMenu && boutonMenu.getAttribute('aria-expanded') === 'true') {
          boutonMenu.setAttribute('aria-expanded', 'false');
          menu.classList.remove('est-ouvert');
        }
      });

      // Passage du téléphone à l'ordinateur (ou l'inverse) : on repart à zéro.
      if (grandEcran.addEventListener) grandEcran.addEventListener('change', replierTout);
      else if (grandEcran.addListener) grandEcran.addListener(replierTout);
    }
  })();

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
