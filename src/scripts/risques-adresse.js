// « Ma maison face aux risques », sur la page « Risques et sécurité » (voir
// src/templates/views.mjs, widgetRisquesAdresse, et
// worker/risques-adresse.mjs). Chargé uniquement sur cette page. La section
// est cachée tant que ce script n'a pas pris la main : sans lui, la page
// renvoie vers Géorisques, le service officiel.
(function () {
  var section = document.querySelector('[data-risques-adresse]');
  if (!section) return;
  var urlApi = section.getAttribute('data-risques-adresse');
  var form = section.querySelector('form');
  var champ = form && form.querySelector('input[name="q"]');
  var zone = section.querySelector('[data-resultat]');
  if (!form || !champ || !zone) return;
  section.hidden = false;

  function element(balise, classe, texte) {
    var el = document.createElement(balise);
    if (classe) el.className = classe;
    if (texte) el.textContent = texte;
    return el;
  }

  function message(texte) {
    zone.textContent = '';
    zone.appendChild(element('p', null, texte));
  }

  var RADON = {
    1: 'faible (catégorie 1 sur 3)',
    2: 'faible, avec des facteurs pouvant faciliter le transfert du radon (catégorie 2 sur 3)',
    3: 'significatif (catégorie 3 sur 3)'
  };

  // Chaque ligne : un constat (en gras, coloré s'il y a lieu), puis le détail.
  function ligne(constat, classe, detail) {
    var li = element('li');
    li.appendChild(element('strong', classe, constat));
    if (detail) li.appendChild(document.createTextNode(' ' + detail));
    return li;
  }

  function ligneInondation(i) {
    if (!i) return ligne('Zone inondable : information indisponible pour le moment.', null, 'Réessayez plus tard.');
    if (i.alea || i.ppri) {
      var constat = i.alea && i.alea !== 'non précisé' ? 'En zone inondable, aléa ' + i.alea + '.' : 'En zone inondable.';
      var detail = i.ppri
        ? 'Selon le plan local d’urbanisme, dans le périmètre d’un plan de prévention des risques d’inondation (PPRI).'
        : 'Selon le plan local d’urbanisme.';
      if (i.reculCoursEau) detail += ' Un recul par rapport aux cours d’eau s’impose aux constructions.';
      detail += ' Avant tout projet de construction ou de travaux, renseignez-vous en mairie : le règlement fixe ce qui est permis à cet endroit.';
      return ligne(constat, 'resultat-risques__alerte', detail);
    }
    return ligne('Hors des zones inondables connues.', 'resultat-risques__ok',
      'Ni le plan local d’urbanisme ni le PPRI ne classent cet endroit en zone inondable, ce qui ne met pas à l’abri du ruissellement lors d’un épisode cévenol.');
  }

  function afficher(d) {
    zone.textContent = '';
    if (!d || !d.trouve) {
      message((d && d.message) || 'Adresse introuvable à ' + (document.documentElement.getAttribute('data-commune') || 'la commune') + '.');
      return;
    }
    var retenue = element('p');
    retenue.appendChild(element('strong', null, 'Adresse retenue : '));
    retenue.appendChild(document.createTextNode(d.adresse));
    zone.appendChild(retenue);

    var ul = element('ul');
    ul.appendChild(ligneInondation(d.inondation));

    if (d.argiles) {
      ul.appendChild(ligne(
        'Retrait-gonflement des argiles : ' + d.argiles.exposition.toLowerCase() + '.',
        d.argiles.niveau >= 3 ? 'resultat-risques__alerte' : null,
        d.argiles.niveau >= 2 ? 'Dans ces zones, la loi impose une étude de sol pour vendre un terrain à bâtir, et une étude ou des règles de construction adaptées pour une maison neuve.' : ''
      ));
    }

    if (d.plu && d.plu.zone) {
      ul.appendChild(ligne('Zone ' + d.plu.zone + ' du plan local d’urbanisme.', null,
        d.plu.description ? d.plu.description.charAt(0).toUpperCase() + d.plu.description.slice(1) + '.' : ''));
    }

    var c = d.commune || {};
    var commune = [];
    if (c.sismicite) commune.push('sismicité ' + c.sismicite.replace(/^(\d)\s*-\s*/, 'zone $1, ').toLowerCase() + ' (échelle de 1 à 5)');
    if (c.radon) commune.push('potentiel radon ' + (RADON[c.radon] || 'catégorie ' + c.radon));
    if (c.catnat != null) commune.push(c.catnat + ' reconnaissances de l’état de catastrophe naturelle');
    if (commune.length) ul.appendChild(ligne('Pour toute la commune :', null, commune.join(' ; ') + '.'));

    zone.appendChild(ul);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = champ.value.trim();
    if (q.length < 3) {
      message('Indiquez une adresse à ' + (document.documentElement.getAttribute('data-commune') || 'la commune') + ' (numéro et nom de la voie).');
      return;
    }
    message('Recherche en cours…');
    fetch(urlApi + '?q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(afficher)
      .catch(function () {
        message('Le service ne répond pas pour le moment. Réessayez dans un instant, ou consultez Géorisques (lien ci-dessus).');
      });
  });
})();
