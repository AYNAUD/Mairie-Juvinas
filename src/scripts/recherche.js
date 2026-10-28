/* =====================================================================
   Moteur de recherche en langage naturel.
   Index statique (/search-index.json), aucun service tiers, aucune donnée
   qui sort du navigateur. Tolère les formulations courantes et les fautes.
   ===================================================================== */
(function () {
  'use strict';

  var MOTS_VIDES = ['je', 'j', 'me', 'ma', 'mon', 'mes', 'ou', 'où', 'le', 'la', 'les', 'un', 'une', 'des',
    'de', 'du', 'au', 'aux', 'a', 'à', 'en', 'et', 'pour', 'par', 'sur', 'dans', 'avec', 'que', 'qui',
    'quoi', 'comment', 'quand', 'est', 'ce', 'cest', 'se', 'sa', 'son', 'ses', 'faire', 'fait', 'veux',
    'voudrais', 'souhaite', 'peux', 'puis', 'dois', 'doit', 'il', 'elle', 'nous', 'vous', 'on', 'y',
    'ai', 'as', 'avoir', 'etre', 'suis', 'the', 'mairie'];

  var index = null, reponses = [], chargement = null;

  function normaliser(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  // Réduction sommaire : pluriels et féminins les plus courants.
  function racine(mot) {
    if (mot.length > 4 && /(aux)$/.test(mot)) return mot.slice(0, -3) + 'l';
    if (mot.length > 3 && /(s|x)$/.test(mot)) return mot.slice(0, -1);
    return mot;
  }

  function jetons(q) {
    return normaliser(q).split(' ')
      .filter(function (m) { return m.length > 1 && MOTS_VIDES.indexOf(m) === -1; })
      .map(racine);
  }

  // Distance de Levenshtein bornée : au-delà de `max`, on abandonne.
  function distance(a, b, max) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var precedente = [], courante = [], i, j;
    for (j = 0; j <= b.length; j++) precedente[j] = j;
    for (i = 1; i <= a.length; i++) {
      courante[0] = i;
      var meilleur = i;
      for (j = 1; j <= b.length; j++) {
        var cout = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        courante[j] = Math.min(courante[j - 1] + 1, precedente[j] + 1, precedente[j - 1] + cout);
        if (courante[j] < meilleur) meilleur = courante[j];
      }
      if (meilleur > max) return max + 1;
      precedente = courante.slice();
    }
    return precedente[b.length];
  }

  function toleranceDe(mot) { return mot.length >= 8 ? 2 : mot.length >= 5 ? 1 : 0; }

  function scorer(entree, requeteNorm, mots) {
    var score = 0, motsTrouves = 0;

    // 1. Formulation reconnue telle quelle (dictionnaire de synonymes).
    // La comparaison se fait aussi sur la forme « collée », sans espaces :
    // « quelquun est decede » retrouve ainsi « quelqu'un est décédé ».
    var requeteCollee = requeteNorm.replace(/ /g, '');
    // On retient la MEILLEURE formulation reconnue, jamais leur somme : sinon
    // une fiche qui cite trois fois le mot devance celle qui porte le sujet.
    var meilleurExpr = 0;
    for (var e = 0; e < entree.e.length; e++) {
      var expr = entree.e[e];
      if (!expr) continue;
      var exprCollee = expr.replace(/ /g, '');
      if (expr === requeteNorm || exprCollee === requeteCollee) { meilleurExpr = 160; break; }
      if (requeteCollee.length > 4 && (exprCollee.indexOf(requeteCollee) !== -1 || requeteCollee.indexOf(exprCollee) !== -1)) {
        meilleurExpr = Math.max(meilleurExpr, 70);
      }
    }
    if (meilleurExpr) {
      score += meilleurExpr;
      motsTrouves = meilleurExpr === 160 ? mots.length : Math.max(motsTrouves, 1);
    }

    // 2. Mot à mot, du plus sûr au plus tolérant.
    var titreNorm = normaliser(entree.t);
    for (var i = 0; i < mots.length; i++) {
      var mot = mots[i], meilleur = 0;
      for (var k = 0; k < entree.k.length; k++) {
        var cle = racine(entree.k[k]);
        if (cle === mot) { meilleur = Math.max(meilleur, 14); continue; }
        if (cle.indexOf(mot) === 0 && mot.length > 2) { meilleur = Math.max(meilleur, 9); continue; }
        if (mot.length > 3 && cle.indexOf(mot) !== -1) { meilleur = Math.max(meilleur, 6); continue; }
        var tol = toleranceDe(mot);
        if (tol && meilleur < 5 && distance(mot, cle, tol) <= tol) meilleur = Math.max(meilleur, 5);
      }
      // Mots du corps de texte : couverture utile, mais poids volontairement faible.
      if (meilleur < 4 && entree.b) {
        for (var f = 0; f < entree.b.length; f++) {
          if (racine(entree.b[f]) === mot) { meilleur = Math.max(meilleur, 3); break; }
        }
      }
      if (titreNorm.indexOf(mot) !== -1) meilleur += 10;
      if (meilleur) { motsTrouves++; score += meilleur; }
    }

    if (!motsTrouves) return 0;
    // Une requête dont tous les mots sont retrouvés vaut nettement mieux qu'une correspondance partielle.
    score *= (0.45 + 0.55 * (motsTrouves / mots.length));
    return score * entree.p;
  }

  function chercher(requete) {
    var mots = jetons(requete);
    if (!mots.length || !index) return { resultats: [], reponse: null };
    var requeteNorm = normaliser(requete);

    var reponse = null, meilleurR = 0;
    for (var r = 0; r < reponses.length; r++) {
      for (var q = 0; q < reponses[r].q.length; q++) {
        var question = reponses[r].q[q];
        var communs = question.split(' ').filter(function (m) { return requeteNorm.indexOf(m) !== -1 && MOTS_VIDES.indexOf(m) === -1; }).length;
        var poids = question === requeteNorm ? 100 : communs * 10;
        if (poids > meilleurR && communs >= 1) { meilleurR = poids; reponse = reponses[r]; }
      }
    }
    if (meilleurR < 20) reponse = null;

    var notes = [];
    for (var i = 0; i < index.length; i++) {
      var s = scorer(index[i], requeteNorm, mots);
      if (s > 0) notes.push({ entree: index[i], score: s });
    }
    // Rien ne correspond : la page affiche « Aucun résultat » (notes[0]
    // n'existant pas, la suite plantait et laissait les anciens résultats).
    if (!notes.length) return { resultats: [], reponse: reponse };
    notes.sort(function (a, b) { return b.score - a.score; });
    // On écarte la traîne : un résultat très en dessous du meilleur est du bruit,
    // et le bruit fait douter l'usager de tous les autres résultats.
    var seuil = notes.length ? notes[0].score * 0.12 : 0;
    var retenus = notes.filter(function (n) { return n.score >= seuil; });
    // On propose toujours au moins trois pistes quand elles existent : un
    // résultat unique laisse l'usager sans recours s'il n'est pas le bon.
    if (retenus.length < 3 && notes.length) {
      var plancher = notes[0].score * 0.05;
      retenus = notes.filter(function (n) { return n.score >= plancher; }).slice(0, 3);
    }
    retenus = retenus.slice(0, 8);
    return { resultats: retenus.map(function (n) { return n.entree; }), reponse: reponse };
  }

  function charger() {
    if (index) return Promise.resolve();
    if (chargement) return chargement;
    chargement = fetch('/search-index.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data.entrees; reponses = data.reponses || []; })
      .catch(function () { index = []; });
    return chargement;
  }

  function echapper(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function htmlResultat(e, id, selectionne) {
    return '<a class="resultat" role="option" id="' + id + '" href="' + echapper(e.u) + '"' +
      (selectionne ? ' aria-selected="true"' : ' aria-selected="false"') + '>' +
      '<span class="resultat__titre">' + echapper(e.t) + '</span>' +
      (e.r ? '<span class="resultat__resume">' + echapper(e.r) + '</span>' : '') +
      '<span class="resultat__cat">' + echapper(e.c) + '</span></a>';
  }

  function htmlReponse(rep) {
    return '<a class="resultat resultat--reponse" role="option" id="res-reponse" aria-selected="false" href="' + echapper(rep.u) + '">' +
      '<span class="resultat__titre">' + echapper(rep.t) + '</span>' +
      '<span class="resultat__resume">' + echapper(rep.x) + '</span></a>';
  }

  /* --- Branchement sur chaque formulaire de recherche --------------------- */
  document.querySelectorAll('[data-recherche]').forEach(function (form) {
    var champ = form.querySelector('input[type="search"]');
    var boite = form.querySelector('.recherche__resultats');
    var annonce = form.querySelector('[data-annonce-recherche]');
    if (!champ || !boite) return;

    var options = [], actif = -1, prefixe = champ.id + '-opt';

    function fermer() {
      boite.hidden = true;
      champ.setAttribute('aria-expanded', 'false');
      champ.removeAttribute('aria-activedescendant');
      actif = -1;
    }

    function marquer() {
      options.forEach(function (o, i) { o.setAttribute('aria-selected', String(i === actif)); });
      if (actif >= 0) {
        champ.setAttribute('aria-activedescendant', options[actif].id);
        options[actif].scrollIntoView({ block: 'nearest' });
      } else champ.removeAttribute('aria-activedescendant');
    }

    function afficher() {
      var valeur = champ.value.trim();
      if (valeur.length < 2) { fermer(); return; }
      var res = chercher(valeur);
      var morceaux = [];
      if (res.reponse) morceaux.push(htmlReponse(res.reponse));
      res.resultats.forEach(function (e, i) { morceaux.push(htmlResultat(e, prefixe + i, false)); });

      if (!morceaux.length) {
        boite.innerHTML = '<p class="resultat__vide">Aucun résultat pour « ' + echapper(valeur) + ' ». ' +
          'Essayez un mot plus simple, ou <a href="/demarches/">parcourez toutes les démarches</a>.</p>';
        if (annonce) annonce.textContent = 'Aucun résultat.';
      } else {
        boite.innerHTML = morceaux.join('');
        if (annonce) annonce.textContent = res.resultats.length + ' résultat' + (res.resultats.length > 1 ? 's' : '') + '. Utilisez les flèches pour naviguer.';
      }
      boite.hidden = false;
      champ.setAttribute('aria-expanded', 'true');
      options = Array.prototype.slice.call(boite.querySelectorAll('.resultat'));
      actif = -1;
    }

    champ.addEventListener('input', function () { charger().then(afficher); });
    champ.addEventListener('focus', function () { charger(); });

    champ.addEventListener('keydown', function (ev) {
      if (boite.hidden || !options.length) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); actif = (actif + 1) % options.length; marquer(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); actif = (actif - 1 + options.length) % options.length; marquer(); }
      else if (ev.key === 'Enter' && actif >= 0) { ev.preventDefault(); options[actif].click(); }
      else if (ev.key === 'Escape') { fermer(); }
    });

    document.addEventListener('click', function (ev) { if (!form.contains(ev.target)) fermer(); });
  });

  /* --- Page /recherche.html : résultats complets -------------------------- */
  var zone = document.querySelector('[data-resultats-page]');
  if (zone) {
    var section = document.getElementById('resultats-page');
    var champPage = document.querySelector('#recherche-champ');
    var params = new URLSearchParams(location.search);
    var q = params.get('q') || '';

    function rendrePage(valeur) {
      if (!valeur.trim()) { section.hidden = true; return; }
      var res = chercher(valeur);
      var titre = document.getElementById('resultats-titre');
      var html = res.reponse ? htmlReponse(res.reponse) : '';
      html += res.resultats.map(function (e, i) { return htmlResultat(e, 'page-opt' + i, false); }).join('');
      if (!res.resultats.length && !res.reponse) {
        html = '<p>Aucun résultat pour « ' + echapper(valeur) + ' ». La liste complète des démarches est juste en dessous.</p>';
        titre.textContent = 'Aucun résultat';
      } else {
        titre.textContent = res.resultats.length + ' résultat' + (res.resultats.length > 1 ? 's' : '') + ' pour « ' + valeur + ' »';
      }
      zone.innerHTML = html;
      section.hidden = false;
    }

    if (q) {
      if (champPage) champPage.value = q;
      charger().then(function () { rendrePage(q); });
    }
    if (champPage) {
      champPage.addEventListener('input', function () {
        charger().then(function () { rendrePage(champPage.value); });
      });
      // Sur cette page, la liste déroulante ferait doublon avec les résultats affichés.
      var boitePage = champPage.closest('[data-recherche]').querySelector('.recherche__resultats');
      if (boitePage) boitePage.remove();
    }
  }

  /* Exposé pour les tests automatiques de pertinence (tools/test-recherche.mjs). */
  window.RechercheMairie = {
    chercher: chercher,
    normaliser: normaliser,
    jetons: jetons,
    injecter: function (data) { index = data.entrees; reponses = data.reponses || []; }
  };

  /* Les suggestions lancent la recherche sans quitter la page si c'est possible. */
  document.addEventListener('click', function (ev) {
    var s = ev.target.closest('[data-suggestion]');
    if (!s) return;
    var form = s.closest('.overlay, .heros, .page-recherche');
    var champ = form && form.querySelector('input[type="search"]');
    if (!champ) return;
    ev.preventDefault();
    champ.value = s.textContent.trim();
    champ.focus();
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
})();
