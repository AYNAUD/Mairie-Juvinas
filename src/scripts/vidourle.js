// Hauteur du Vidourle en direct, sur la page « Risques et sécurité » (voir
// src/templates/views.mjs, widgetVidourle, et worker/donnees-publiques.mjs).
// Chargé uniquement sur cette page, pas dans le bundle commun. Si l'appel
// échoue (Worker indisponible, pas encore basculé sur le site de
// production…), la page garde ses liens vers Vigicrues : rien ne manque
// sans JavaScript.
(function () {
  var section = document.querySelector('[data-vidourle]');
  if (!section) return;
  var urlApi = section.getAttribute('data-vidourle');
  var SVG = 'http://www.w3.org/2000/svg';

  function metres(n) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  }

  function element(balise, classe, texte) {
    var el = document.createElement(balise);
    if (classe) el.className = classe;
    if (texte) el.textContent = texte;
    return el;
  }

  function heureMesure(iso) {
    var d = new Date(iso);
    var heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    // Une station muette depuis plus de 3 heures doit se voir : on donne
    // alors la date complète plutôt qu'une heure qui semblerait récente.
    if (Date.now() - d.getTime() > 3 * 3600 * 1000) {
      return 'Dernière mesure le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + ' à ' + heure;
    }
    return 'Mesurée à ' + heure;
  }

  function texteTendance(s) {
    if (s.tendance === 'hausse') return 'En hausse : +' + metres(s.variation3h) + ' en 3 heures';
    if (s.tendance === 'baisse') return 'En baisse : −' + metres(Math.abs(s.variation3h)) + ' en 3 heures';
    return 'Stable depuis 3 heures';
  }

  // Courbe des 24 dernières heures : décorative (aria-hidden), doublée d'une
  // phrase lisible par tous (minimum et maximum).
  function courbe(serie) {
    var L = 300, H = 64, M = 4;
    var t0 = serie[0][0], t1 = serie[serie.length - 1][0];
    var min = Infinity, max = -Infinity;
    serie.forEach(function (p) { min = Math.min(min, p[1]); max = Math.max(max, p[1]); });
    // Sous 10 cm d'écart, on n'amplifie pas le bruit de mesure en montagnes
    // russes : l'échelle verticale garde au moins 10 cm.
    if (max - min < 0.1) { var milieu = (max + min) / 2; min = milieu - 0.05; max = milieu + 0.05; }
    var points = serie.map(function (p) {
      var x = M + ((p[0] - t0) / ((t1 - t0) || 1)) * (L - 2 * M);
      var y = H - M - ((p[1] - min) / (max - min)) * (H - 2 * M);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + L + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'station__svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var ligne = document.createElementNS(SVG, 'polyline');
    ligne.setAttribute('class', 'station__ligne');
    ligne.setAttribute('points', points);
    svg.appendChild(ligne);
    return svg;
  }

  fetch(urlApi)
    .then(function (r) {
      if (!r.ok) throw new Error('réponse ' + r.status);
      return r.json();
    })
    .then(function (donnees) {
      if (!donnees.disponible) return;
      (donnees.stations || []).forEach(function (s) {
        var li = section.querySelector('[data-station="' + s.code + '"]');
        if (!li || !s.disponible) return;

        var mesure = li.querySelector('[data-mesure]');
        mesure.textContent = '';
        mesure.appendChild(element('strong', 'station__hauteur', metres(s.hauteur)));
        mesure.appendChild(element('span', 'station__tendance station__tendance--' + s.tendance, texteTendance(s)));
        mesure.appendChild(element('span', 'station__heure', heureMesure(s.date)));

        var zone = li.querySelector('[data-courbe]');
        if (zone && s.serie && s.serie.length > 1) {
          zone.textContent = '';
          zone.appendChild(courbe(s.serie));
          zone.appendChild(element('p', 'station__resume', s.min24h === s.max24h
            ? 'Niveau inchangé depuis 24 heures.'
            : 'Sur 24 heures : entre ' + metres(s.min24h) + ' et ' + metres(s.max24h) + '.'));
          zone.hidden = false;
        }
      });
    })
    .catch(function () {
      // Silencieux : les liens vers Vigicrues déjà rendus restent affichés.
    });
})();
