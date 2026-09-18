/* Indique si la mairie est ouverte en ce moment, et met en évidence le jour courant.
   Purement décoratif : les horaires complets restent affichés en HTML.
   Les créneaux viennent de l'attribut data-horaires de chaque bloc
   (ex. "1:810-1050,3:810-1050"), lui-même produit à partir de
   content/site.json → mairie.horaires (voir src/templates/views.mjs,
   donneesHoraires) : rien n'est codé en dur ici, une seule commune n'aurait
   jamais les mêmes horaires qu'une autre. */
(function () {
  'use strict';
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  function analyser(data) {
    var horaires = {};
    (data || '').split(',').filter(Boolean).forEach(function (bit) {
      var parts = bit.split(':'); var creneau = parts[1].split('-');
      horaires[Number(parts[0])] = [Number(creneau[0]), Number(creneau[1])];
    });
    return horaires;
  }

  function minutes(d) { return d.getHours() * 60 + d.getMinutes(); }

  function prochaineOuverture(horaires, maintenant) {
    for (var i = 0; i <= 7; i++) {
      var jour = (maintenant.getDay() + i) % 7;
      var creneau = horaires[jour];
      if (!creneau) continue;
      if (i === 0 && minutes(maintenant) >= creneau[1]) continue;
      var h = Math.floor(creneau[0] / 60), m = creneau[0] % 60;
      var quand = i === 0 ? "aujourd'hui" : i === 1 ? 'demain' : JOURS[jour];
      return quand + ' à ' + h + 'h' + (m ? String(m).padStart(2, '0') : '');
    }
    return null;
  }

  var maintenant = new Date();

  document.querySelectorAll('[data-statut-mairie]').forEach(function (bloc) {
    var horaires = analyser(bloc.getAttribute('data-horaires'));
    var creneau = horaires[maintenant.getDay()];
    var ouverte = !!creneau && minutes(maintenant) >= creneau[0] && minutes(maintenant) < creneau[1];
    bloc.setAttribute('data-ouverte', ouverte ? '1' : '0');
    var texte = bloc.querySelector('[data-statut-texte]');
    if (!texte) return;
    if (ouverte) {
      var fin = Math.floor(creneau[1] / 60), fm = creneau[1] % 60;
      texte.textContent = 'Le secrétariat est ouvert — jusqu’à ' + fin + 'h' + (fm ? String(fm).padStart(2, '0') : '') + '.';
    } else {
      var suite = prochaineOuverture(horaires, maintenant);
      texte.textContent = 'Le secrétariat est fermé' + (suite ? ' — réouverture ' + suite + '.' : '.');
    }
  });

  document.querySelectorAll('.pratique__horaires').forEach(function (liste) {
    var item = liste.children[maintenant.getDay() === 0 ? 6 : maintenant.getDay() - 1];
    if (item) item.setAttribute('data-aujourdhui', '');
  });
})();
