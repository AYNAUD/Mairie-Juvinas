/* Préférences d'affichage : taille du texte, contraste, police, animations, thème.
   Tout est stocké localement, rien n'est envoyé nulle part. */
(function () {
  'use strict';
  var CLE = 'mairie-prefs';
  var racine = document.documentElement;

  function lire() {
    try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch (e) { return {}; }
  }
  function ecrire(p) {
    try { localStorage.setItem(CLE, JSON.stringify(p)); } catch (e) { /* navigation privée */ }
  }

  var prefs = lire();

  // Un ?theme=... dans l'URL force temporairement l'affichage, pour comparer
  // les 3 sites par simple lien — sans jamais toucher au réglage enregistré.
  var themeForce = new URLSearchParams(location.search).get('theme');
  if (['republique', 'garrigue', 'guichet'].indexOf(themeForce) === -1) themeForce = null;

  function appliquer() {
    racine.setAttribute('data-taille', prefs.taille || 'normal');
    if (prefs.contraste) racine.setAttribute('data-contraste', '1'); else racine.removeAttribute('data-contraste');
    if (prefs.dyslexie) racine.setAttribute('data-dyslexie', '1'); else racine.removeAttribute('data-dyslexie');
    if (prefs.anime) racine.setAttribute('data-anime', '0'); else racine.removeAttribute('data-anime');
    if (themeForce) racine.setAttribute('data-theme', themeForce);
    else if (prefs.theme) racine.setAttribute('data-theme', prefs.theme);
    synchroniser();
  }

  function synchroniser() {
    document.querySelectorAll('[data-taille]').forEach(function (b) {
      if (b.tagName !== 'BUTTON') return;
      b.setAttribute('aria-pressed', String((prefs.taille || 'normal') === b.dataset.taille));
    });
    document.querySelectorAll('[data-bascule]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(!!prefs[b.dataset.bascule]));
    });
    document.querySelectorAll('[data-theme-choix]').forEach(function (b) {
      var actif = racine.getAttribute('data-theme') === b.dataset.themeChoix;
      b.setAttribute('aria-pressed', String(actif));
      b.textContent = actif ? 'Thème appliqué' : 'Appliquer « ' + b.dataset.themeChoix.charAt(0).toUpperCase() + b.dataset.themeChoix.slice(1) + ' »';
    });
  }

  // Le panneau se refermait seulement en touchant de nouveau « Affichage » :
  // « Fermer » et Échap le referment aussi, et rendent la main au bouton
  // qui l'a ouvert.
  function fermerPanneau() {
    var panneau = document.getElementById('panneau-a11y');
    var ouvreur = document.querySelector('[data-ouvre-a11y]');
    if (!panneau || panneau.hidden) return false;
    panneau.hidden = true;
    if (ouvreur) { ouvreur.setAttribute('aria-expanded', 'false'); ouvreur.focus(); }
    return true;
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && fermerPanneau()) ev.preventDefault();
  });

  document.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-ferme-a11y]')) { fermerPanneau(); return; }
    var b = ev.target.closest('[data-taille], [data-bascule], [data-theme-choix], [data-ouvre-a11y]');
    if (!b) return;

    if (b.hasAttribute('data-ouvre-a11y')) {
      var panneau = document.getElementById('panneau-a11y');
      var ouvert = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', String(!ouvert));
      panneau.hidden = ouvert;
      if (!ouvert) { var p = panneau.querySelector('button'); if (p) p.focus(); }
      return;
    }
    if (b.dataset.taille) prefs.taille = b.dataset.taille;
    else if (b.dataset.bascule) prefs[b.dataset.bascule] = !prefs[b.dataset.bascule];
    else if (b.dataset.themeChoix) {
      prefs.theme = b.dataset.themeChoix;
      var annonce = document.querySelector('[data-annonce-theme]');
      if (annonce) annonce.textContent = 'Thème « ' + b.dataset.themeChoix + ' » appliqué à tout le site.';
    }
    ecrire(prefs);
    appliquer();
  });

  appliquer();
})();
