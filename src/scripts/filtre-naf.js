// Filtre de l'annuaire Sirene par section NAF, sur la page « Acteurs
// économiques » (voir src/templates/views.mjs, annuaireSireneParSection).
// Chargé uniquement sur cette page, pas dans le bundle commun. Sans
// JavaScript, la liste reste entière et regroupée par section, chaque
// pastille menant à son groupe : ce script ne fait qu'ajouter le filtre.
(function () {
  var filtre = document.querySelector('[data-filtre-naf]');
  if (!filtre) return;
  var liens = Array.prototype.slice.call(filtre.querySelectorAll('a[data-section]'));
  var groupes = Array.prototype.slice.call(document.querySelectorAll('[data-groupe-naf]'));
  var statut = filtre.querySelector('[data-statut]');

  function lienDe(section) {
    for (var i = 0; i < liens.length; i++) {
      if (liens[i].getAttribute('data-section') === section) return liens[i];
    }
    return null;
  }

  // section : identifiant d'un groupe (« naf-f ») ou "" pour tout afficher.
  // "annoncer" : faux au chargement de la page, pour ne pas lire le statut
  // à qui arrive sur une adresse déjà filtrée.
  function appliquer(section, annoncer) {
    var actif = lienDe(section) || lienDe('');
    section = actif.getAttribute('data-section');
    groupes.forEach(function (g) { g.hidden = section !== '' && g.id !== section; });
    liens.forEach(function (l) {
      if (l === actif) l.setAttribute('aria-current', 'true');
      else l.removeAttribute('aria-current');
    });
    var nombre = parseInt(actif.getAttribute('data-nombre'), 10);
    var texte = actif.getAttribute('data-libelle') + ' : ' + nombre + ' établissement' + (nombre > 1 ? 's' : '') + '.';
    statut.textContent = annoncer ? texte : '';
  }

  liens.forEach(function (l) {
    l.addEventListener('click', function (evenement) {
      evenement.preventDefault();
      var section = l.getAttribute('data-section');
      // L'adresse garde le filtre (page partagée, retour arrière) sans
      // faire défiler la page jusqu'au groupe.
      history.replaceState(null, '', section ? '#' + section : location.pathname + location.search);
      appliquer(section, true);
    });
  });

  var depuisAdresse = function () { appliquer(location.hash.replace('#', ''), false); };
  window.addEventListener('hashchange', depuisAdresse);
  if (/^#naf-/.test(location.hash)) depuisAdresse();
})();
