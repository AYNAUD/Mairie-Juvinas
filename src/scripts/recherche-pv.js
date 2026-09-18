/**
 * Recherche en langage courant dans le texte des comptes-rendus du Conseil
 * municipal — amélioration progressive de /mairie/conseils-municipaux.html :
 * sans JavaScript, la page reste entièrement utilisable (tableau des séances
 * année par année), ce script ajoute seulement un moyen supplémentaire de
 * retrouver une séance. Ne couvre que les PV déposés localement via le
 * circuit email (voir worker/github.mjs, commitDepotDocument) : un PV lié en
 * externe (historique antérieur, Google Drive) n'a pas de texte à chercher.
 */
(function () {
  var zone = document.getElementById('recherche-pv');
  if (!zone) return;

  zone.innerHTML =
    '<div class="recherche-pv__boite">' +
      '<label for="recherche-pv-champ">Rechercher dans les PV des conseils municipaux</label>' +
      '<input type="search" id="recherche-pv-champ" class="recherche-pv__champ" placeholder="ex. budget, voirie, cimetière…" autocomplete="off">' +
      '<p class="recherche-pv__statut" id="recherche-pv-statut" aria-live="polite"></p>' +
      '<ul class="recherche-pv__resultats" id="recherche-pv-resultats"></ul>' +
    '</div>';

  var champ = document.getElementById('recherche-pv-champ');
  var statut = document.getElementById('recherche-pv-statut');
  var resultats = document.getElementById('recherche-pv-resultats');
  var index = null;
  var chargement = null;

  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function dateFr(iso) {
    var p = iso.split('-');
    return String(parseInt(p[2], 10)) + ' ' + MOIS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  function normaliser(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function echapper(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // texteBasePv et texteRecherchePv (voir src/build.mjs, construireIndexPv)
  // ont la même longueur, caractère pour caractère : une position trouvée
  // dans l'un s'applique telle quelle à l'autre, ce qui permet d'extraire un
  // extrait lisible (accents, casse d'origine) autour d'une correspondance
  // repérée dans le texte normalisé.
  function extraitAutour(entree, positionMot, longueurMot) {
    var debut = Math.max(0, positionMot - 60);
    var fin = Math.min(entree.texteBasePv.length, positionMot + longueurMot + 60);
    var extrait = entree.texteBasePv.slice(debut, fin).trim();
    return (debut > 0 ? '… ' : '') + echapper(extrait) + (fin < entree.texteBasePv.length ? ' …' : '');
  }

  function chercher(requete) {
    var mots = normaliser(requete).split(' ').filter(function (m) { return m.length > 1; });
    if (!mots.length) {
      resultats.innerHTML = '';
      statut.textContent = '';
      return;
    }

    var trouves = index.map(function (entree) {
      var score = 0;
      var position = -1;
      var longueurMot = 0;
      mots.forEach(function (mot) {
        var i = entree.texteRecherchePv.indexOf(mot);
        if (i === -1) return;
        score++;
        if (position === -1) { position = i; longueurMot = mot.length; }
      });
      return { entree: entree, score: score, position: position, longueurMot: longueurMot };
    }).filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score || b.entree.date.localeCompare(a.entree.date); });

    if (!trouves.length) {
      resultats.innerHTML = '';
      statut.textContent = 'Aucun compte-rendu déposé ne mentionne « ' + requete.trim() + ' ». Les séances plus anciennes (liens externes) ne sont pas couvertes par cette recherche.';
      return;
    }

    statut.textContent = trouves.length > 1
      ? trouves.length + ' comptes-rendus correspondent à votre recherche.'
      : '1 compte-rendu correspond à votre recherche.';

    resultats.innerHTML = trouves.map(function (r) {
      return '<li class="recherche-pv__resultat">' +
        '<a href="/documents/' + encodeURIComponent(r.entree.fichier) + '">Séance du ' + dateFr(r.entree.date) + '</a>' +
        '<p class="recherche-pv__extrait">' + extraitAutour(r.entree, r.position, r.longueurMot) + '</p>' +
        '</li>';
    }).join('');
  }

  function assurerIndexCharge() {
    if (!chargement) {
      statut.textContent = 'Chargement des comptes-rendus…';
      chargement = fetch('/recherche-pv.json')
        .then(function (r) { return r.json(); })
        .then(function (donnees) {
          index = donnees;
          statut.textContent = '';
        })
        .catch(function () {
          index = [];
          statut.textContent = 'La recherche est momentanément indisponible.';
        });
    }
    return chargement;
  }

  var delaiSaisie = null;
  champ.addEventListener('input', function () {
    var valeur = champ.value;
    clearTimeout(delaiSaisie);
    if (!valeur.trim()) {
      resultats.innerHTML = '';
      statut.textContent = '';
      return;
    }
    delaiSaisie = setTimeout(function () {
      assurerIndexCharge().then(function () {
        if (champ.value === valeur) chercher(valeur);
      });
    }, 250);
  });
})();
