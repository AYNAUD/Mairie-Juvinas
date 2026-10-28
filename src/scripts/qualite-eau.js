// Qualité de l'eau du robinet, sur la page « Eau et assainissement » (voir
// src/templates/views.mjs, widgetQualiteEau, et worker/donnees-publiques.mjs,
// resumerQualiteEau). Chargé uniquement sur cette page. En cas d'échec, le
// renvoi vers le site du ministère de la Santé déjà rendu reste affiché.
(function () {
  var section = document.querySelector('[data-qualite-eau]');
  if (!section) return;
  var urlApi = section.getAttribute('data-qualite-eau');
  var zone = section.querySelector('[data-contenu]');
  if (!zone) return;

  function element(balise, classe, texte) {
    var el = document.createElement(balise);
    if (classe) el.className = classe;
    if (texte) el.textContent = texte;
    return el;
  }

  function nomCommune() {
    return document.documentElement.getAttribute('data-commune') || 'la commune';
  }

  function dateFr(iso) {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function nombre(n) {
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  }

  // Hub'Eau écrit les noms en capitales (« SYNDICAT DES EAUX »).
  var PETITS_MOTS = ['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'sur'];
  function nomPropre(texte) {
    return String(texte).toLowerCase().replace(/[^\s-]+/g, function (mot, position) {
      return position > 0 && PETITS_MOTS.indexOf(mot) > -1 ? mot : mot.charAt(0).toUpperCase() + mot.slice(1);
    });
  }

  // Échelle courante de la dureté, en degrés français.
  function qualifierDurete(f) {
    if (f < 7) return 'très douce';
    if (f < 15) return 'douce';
    if (f < 25) return 'moyennement calcaire';
    if (f < 35) return 'calcaire';
    return 'très calcaire';
  }

  fetch(urlApi)
    .then(function (r) {
      if (!r.ok) throw new Error('réponse ' + r.status);
      return r.json();
    })
    .then(function (d) {
      if (!d.disponible || !d.commune) return;
      zone.textContent = '';

      var reseaux = d.reseaux || {};
      if (reseaux.controles) {
        var tous = reseaux.conformes === reseaux.controles;
        var bilan = element('p', 'qualite-eau__verdict qualite-eau__verdict--' + (tous ? 'conforme' : 'alerte'),
          tous
            ? 'Conforme : ' + reseaux.controles + ' contrôles sur 12 mois, tous conformes aux limites de qualité.'
            : 'Attention : ' + (reseaux.controles - reseaux.conformes) + ' contrôle(s) sur ' + reseaux.controles + ' non conforme(s) aux limites de qualité ces 12 derniers mois.');
        zone.appendChild(bilan);
        var noms = (d.commune.reseaux || []).map(nomPropre).join(' et ');
        zone.appendChild(element('p', null,
          'Contrôles faits sur les réseaux qui alimentent ' + nomCommune() + (noms ? ' (' + noms + ')' : '') + ', le dernier le ' + dateFr(reseaux.dernier) + '.'));
      }

      var c = d.commune;
      var ligne = 'Dernier prélèvement à ' + nomCommune() + ' même, le ' + dateFr(c.date) + ' : ' + (c.conclusion || (c.conformeLimites ? 'eau conforme aux limites de qualité.' : 'eau non conforme aux limites de qualité.'));
      zone.appendChild(element('p', null, ligne));
      if (c.ecarts && c.ecarts.length) {
        zone.appendChild(element('p', null, 'Écart constaté : ' + c.ecarts.map(function (e) {
          return e.parametre.toLowerCase() + ' ' + e.valeur + '\u00a0' + e.unite + ' (référence : ' + e.reference.replace('<=', '≤\u00a0').replace('>=', '≥\u00a0').replace(/ (?=\S+$)/, '\u00a0') + ')';
        }).join(' ; ') + '.'));
      }

      var mesures = [];
      if (d.durete) {
        mesures.push('Dureté : ' + nombre(d.durete.valeur) + '\u00a0°f, eau ' + qualifierDurete(d.durete.valeur) + ' (mesure du ' + dateFr(d.durete.date) + ').');
      }
      if (d.nitrates) {
        mesures.push('Nitrates : ' + nombre(d.nitrates.valeur) + '\u00a0mg/L, pour une limite de 50\u00a0mg/L (mesure du ' + dateFr(d.nitrates.date) + ').');
      }
      if (mesures.length) {
        var ul = element('ul', 'qualite-eau__mesures');
        mesures.forEach(function (m) { ul.appendChild(element('li', null, m)); });
        zone.appendChild(ul);
      }
    })
    .catch(function () {
      // Silencieux : le renvoi vers le site du ministère reste affiché.
    });
})();
