// Restrictions d'eau en vigueur dans la commune, sur la page « Eau et
// assainissement » (voir src/templates/views.mjs, widgetRestrictionsEau,
// et worker/donnees-publiques.mjs). Chargé uniquement sur cette page. En cas
// d'échec, le renvoi vers VigiEau déjà rendu reste affiché.
(function () {
  var section = document.querySelector('[data-restrictions]');
  if (!section) return;
  var urlApi = section.getAttribute('data-restrictions');
  var zone = section.querySelector('[data-contenu]');
  if (!zone) return;

  function element(balise, classe, texte) {
    var el = document.createElement(balise);
    if (classe) el.className = classe;
    if (texte) el.textContent = texte;
    return el;
  }

  function dateFr(iso) {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  var PHRASES = {
    vigilance: 'Aucune interdiction pour l’instant, mais chacun est appelé à économiser l’eau.',
    alerte: 'Certains usages de l’eau sont limités.',
    alerte_renforcee: 'De nombreux usages de l’eau sont limités ou interdits.',
    crise: 'Seuls les usages prioritaires sont autorisés : santé, salubrité, sécurité civile, eau potable.'
  };

  fetch(urlApi)
    .then(function (r) {
      if (!r.ok) throw new Error('réponse ' + r.status);
      return r.json();
    })
    .then(function (d) {
      if (!d.disponible) return;
      zone.textContent = '';

      if (!d.niveau) {
        zone.appendChild(element('p', 'secheresse__aucune', 'Aucune restriction d’usage de l’eau n’est en vigueur à ' + (document.documentElement.getAttribute('data-commune') || 'la commune') + ' aujourd’hui.'));
        return;
      }

      var niveau = element('p', 'secheresse__niveau secheresse__niveau--' + d.niveau);
      niveau.appendChild(element('span', 'secheresse__badge', 'Niveau : ' + d.libelleNiveau));
      niveau.appendChild(element('span', null, PHRASES[d.niveau] || ''));
      zone.appendChild(niveau);

      if (d.arrete && (d.arrete.debut || d.arrete.url)) {
        var arrete = element('p', 'secheresse__arrete');
        var periode = d.arrete.debut && d.arrete.fin
          ? 'Arrêté préfectoral en vigueur du ' + dateFr(d.arrete.debut) + ' au ' + dateFr(d.arrete.fin) + '. '
          : 'Arrêté préfectoral en vigueur. ';
        arrete.appendChild(document.createTextNode(periode));
        if (d.arrete.url) {
          var a = element('a', 'lien-externe', 'Lire l’arrêté (PDF)');
          a.href = d.arrete.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.appendChild(element('span', 'sr-only', ' (nouvelle fenêtre)'));
          arrete.appendChild(a);
        }
        zone.appendChild(arrete);
      }

      // Usages regroupés par thème (« Arroser », « Nettoyer »…), dans
      // l'ordre où VigiEau les donne.
      var groupes = [];
      (d.usages || []).forEach(function (u) {
        var g = groupes.filter(function (x) { return x.titre === u.thematique; })[0];
        if (!g) { g = { titre: u.thematique, usages: [] }; groupes.push(g); }
        g.usages.push(u);
      });
      groupes.forEach(function (g) {
        zone.appendChild(element('h4', 'secheresse__theme', g.titre));
        var ul = element('ul', 'secheresse__usages');
        g.usages.forEach(function (u) {
          var li = element('li');
          li.appendChild(element('strong', null, u.nom));
          li.appendChild(document.createTextNode(' : '));
          li.appendChild(element('span', 'secheresse__description', u.description));
          ul.appendChild(li);
        });
        zone.appendChild(ul);
      });
    })
    .catch(function () {
      // Silencieux : le renvoi vers VigiEau reste affiché.
    });
})();
