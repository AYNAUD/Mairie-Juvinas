// Situation du moment en tête de la page d'accueil : vigilance météo
// orange ou rouge, Vidourle qui monte (voir src/templates/views.mjs,
// bandeauSituation, et worker/donnees-publiques.mjs, resumerSituation).
// Chargé uniquement sur l'accueil. Les phrases viennent toutes rédigées du
// Worker, les mêmes que dans les alertes par courriel. Le bandeau reste
// caché quand rien n'est à signaler, et en cas d'échec.
(function () {
  var bandeau = document.querySelector('[data-situation]');
  if (!bandeau) return;
  var urlApi = bandeau.getAttribute('data-situation');
  var zone = bandeau.querySelector('[data-contenu]');
  if (!zone) return;

  fetch(urlApi)
    .then(function (r) {
      if (!r.ok) throw new Error('réponse ' + r.status);
      return r.json();
    })
    .then(function (d) {
      if (!d.disponible || d.niveau < 3 || !d.phrases || !d.phrases.length) return;

      zone.textContent = '';
      var premier = document.createElement('p');
      var titre = document.createElement('strong');
      titre.textContent = d.niveau === 4 ? 'Alerte rouge' : 'Alerte orange';
      premier.appendChild(titre);
      premier.appendChild(document.createTextNode(' ' + d.phrases[0]));
      zone.appendChild(premier);
      d.phrases.slice(1).forEach(function (phrase) {
        var p = document.createElement('p');
        p.textContent = phrase;
        zone.appendChild(p);
      });

      if (d.niveau === 4) bandeau.classList.add('alerte--urgence');
      bandeau.hidden = false;
    })
    .catch(function () {
      // Silencieux : l'accueil reste celui d'un jour ordinaire.
    });
})();
