/**
 * Recherche en langage courant dans le texte des PDF déposés — amélioration
 * progressive de /mairie/conseils-municipaux.html et de
 * /mairie/bibliotheque-documentaire.html : sans JavaScript, chaque page reste
 * entièrement utilisable (tableau des documents année par année), ce script
 * ajoute seulement un moyen supplémentaire de retrouver un document. Ne
 * couvre que les PDF déposés localement via le circuit email (voir
 * worker/github.mjs, commitDepotDocument) : un PV lié en externe
 * (historique antérieur, Google Drive) n'a pas de texte à chercher.
 *
 * Le conteneur [data-recherche-documents] dit quoi chercher et comment en
 * parler (voir src/templates/views.mjs, pageConseils et
 * pageBibliothequeDocumentaire) : data-index (index JSON produit par
 * src/build.mjs), data-libelle, data-exemple, data-singulier/data-pluriel
 * (« compte-rendu »/« comptes-rendus »), data-aucun (conseil affiché quand
 * rien ne correspond) et, pour la bibliothèque documentaire, data-themes
 * (liste JSON des thèmes proposés par un filtre : un thème seul liste tous
 * ses documents, un thème et des mots restreignent la recherche à ce thème).
 */
(function () {
  var zone = document.querySelector('[data-recherche-documents]');
  if (!zone) return;

  var reglages = {
    index: zone.getAttribute('data-index') || '/recherche-pv.json',
    libelle: zone.getAttribute('data-libelle') || 'Rechercher dans les PV des conseils municipaux',
    exemple: zone.getAttribute('data-exemple') || 'ex. budget, voirie, cimetière…',
    singulier: zone.getAttribute('data-singulier') || 'compte-rendu',
    pluriel: zone.getAttribute('data-pluriel') || 'comptes-rendus',
    aucun: zone.getAttribute('data-aucun') || '',
    themes: []
  };
  try {
    reglages.themes = JSON.parse(zone.getAttribute('data-themes') || '[]');
  } catch (e) {
    reglages.themes = [];
  }
  var prefixe = zone.id || 'recherche-documents';
  var avecThemes = reglages.themes.length > 0;

  zone.innerHTML =
    '<div class="recherche-pv__boite' + (avecThemes ? ' recherche-pv__boite--themes' : '') + '">' +
      '<div class="recherche-pv__champs">' +
        '<div class="recherche-pv__groupe">' +
          '<label for="' + prefixe + '-champ"></label>' +
          '<input type="search" id="' + prefixe + '-champ" class="recherche-pv__champ" autocomplete="off">' +
        '</div>' +
        (avecThemes
          ? '<div class="recherche-pv__groupe">' +
              '<label for="' + prefixe + '-theme">Thème</label>' +
              '<select id="' + prefixe + '-theme" class="recherche-pv__theme"><option value="">Tous les thèmes</option></select>' +
            '</div>'
          : '') +
      '</div>' +
      '<p class="recherche-pv__statut" id="' + prefixe + '-statut" aria-live="polite"></p>' +
      '<ul class="recherche-pv__resultats" id="' + prefixe + '-resultats"></ul>' +
    '</div>';

  var champ = document.getElementById(prefixe + '-champ');
  var filtreTheme = document.getElementById(prefixe + '-theme');
  var statut = document.getElementById(prefixe + '-statut');
  var resultats = document.getElementById(prefixe + '-resultats');
  zone.querySelector('label[for="' + prefixe + '-champ"]').textContent = reglages.libelle;
  champ.placeholder = reglages.exemple;
  if (filtreTheme) {
    reglages.themes.forEach(function (t) {
      var option = document.createElement('option');
      option.value = t;
      option.textContent = t;
      filtreTheme.appendChild(option);
    });
  }
  var index = null;
  var chargement = null;

  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function dateFr(iso) {
    var p = iso.split('-');
    return String(parseInt(p[2], 10)) + ' ' + MOIS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  // Normalisation "longueur conservée" : un caractère pour un caractère avec
  // le texte d'origine, ce qui permet de retrouver dans le texte affichable
  // la position d'une correspondance trouvée dans le texte normalisé (voir
  // preparer et extraitAutour).
  function normaliserLongueurConservee(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ');
  }

  // Pour la requête : les espaces sont en plus compactés.
  function normaliser(s) {
    return normaliserLongueurConservee(s).replace(/\s+/g, ' ').trim();
  }

  // L'index ne porte le texte qu'une fois, tel qu'il s'affiche (voir
  // src/build.mjs, construireIndexDocuments) : sa version normalisée, celle
  // où l'on cherche, est calculée ici une fois pour toutes au chargement.
  // Les documents de la bibliothèque, seuls à avoir des thèmes, y ajoutent
  // leur libellé et leurs thèmes ("titreRecherche"), cherchés en priorité.
  function preparer(entree) {
    entree.texteRecherchePv = normaliserLongueurConservee(entree.texteBasePv);
    if (entree.themes) {
      entree.titreRecherche = normaliserLongueurConservee(entree.libelle + ' ' + entree.themes.join(' '));
    }
  }

  function echapper(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // texteBasePv et texteRecherchePv (voir preparer) ont la même longueur,
  // caractère pour caractère : une position trouvée dans l'un s'applique
  // telle quelle à l'autre, ce qui permet d'extraire un extrait lisible
  // (accents, casse d'origine) autour d'une correspondance repérée dans le
  // texte normalisé.
  function extraitAutour(entree, positionMot, longueurMot) {
    var debut = Math.max(0, positionMot - 60);
    var fin = Math.min(entree.texteBasePv.length, positionMot + longueurMot + 60);
    var extrait = entree.texteBasePv.slice(debut, fin).trim();
    return (debut > 0 ? '… ' : '') + echapper(extrait) + (fin < entree.texteBasePv.length ? ' …' : '');
  }

  function afficher(trouves) {
    resultats.innerHTML = trouves.map(function (r) {
      var titre = r.entree.libelle
        ? echapper(r.entree.libelle) + ' (' + dateFr(r.entree.date) + ')'
        : 'Séance du ' + dateFr(r.entree.date);
      var extrait = r.position !== -1
        ? extraitAutour(r.entree, r.position, r.longueurMot)
        : (r.entree.themes && r.entree.themes.length ? 'Thèmes : ' + echapper(r.entree.themes.join(', ')) : '');
      return '<li class="recherche-pv__resultat">' +
        // La page du document ou de la séance dans le site (avec retour à la
        // liste) ; à défaut (PV sans séance correspondante), le PDF seul.
        '<a href="' + (r.entree.page || '/documents/' + encodeURIComponent(r.entree.fichier)) + '">' + titre + '</a>' +
        (extrait ? '<p class="recherche-pv__extrait">' + extrait + '</p>' : '') +
        '</li>';
    }).join('');
  }

  function nombre(n) {
    return n > 1 ? n + ' ' + reglages.pluriel : '1 ' + reglages.singulier;
  }

  // Bibliothèque documentaire : le libellé et les thèmes ("titreRecherche")
  // comptent davantage qu'un mot perdu dans le texte du PDF. Les PV des
  // conseils n'en ont pas : leur classement ne change pas. Avec un thème
  // choisi, seuls ses documents sont parcourus ; un thème sans mot les
  // liste tous, du plus récent au plus ancien.
  function chercher(requete, theme) {
    var mots = normaliser(requete).split(' ').filter(function (m) { return m.length > 1; });
    var candidats = theme
      ? index.filter(function (entree) { return (entree.themes || []).indexOf(theme) !== -1; })
      : index;
    var duTheme = theme ? ' du thème « ' + theme + ' »' : '';

    if (!mots.length) {
      if (!theme) {
        resultats.innerHTML = '';
        statut.textContent = '';
        return;
      }
      statut.textContent = candidats.length
        ? nombre(candidats.length) + duTheme + ', du plus récent au plus ancien.'
        : 'Aucun ' + reglages.singulier + duTheme + '.';
      afficher(candidats.map(function (entree) { return { entree: entree, position: -1 }; }));
      return;
    }

    var trouves = candidats.map(function (entree) {
      var score = 0;
      var position = -1;
      var longueurMot = 0;
      mots.forEach(function (mot) {
        if (entree.titreRecherche && entree.titreRecherche.indexOf(mot) !== -1) {
          score += 2;
          return;
        }
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
      statut.textContent = 'Aucun ' + reglages.singulier + ' déposé' + duTheme + ' ne mentionne « ' + requete.trim() + ' ».' +
        (reglages.aucun ? ' ' + reglages.aucun : '');
      return;
    }

    statut.textContent = trouves.length > 1
      ? trouves.length + ' ' + reglages.pluriel + duTheme + ' correspondent à votre recherche.'
      : '1 ' + reglages.singulier + duTheme + ' correspond à votre recherche.';
    afficher(trouves);
  }

  function assurerIndexCharge() {
    if (!chargement) {
      statut.textContent = 'Chargement des ' + reglages.pluriel + '…';
      chargement = fetch(reglages.index)
        .then(function (r) { return r.json(); })
        .then(function (donnees) {
          donnees.forEach(preparer);
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

  function themeChoisi() {
    return filtreTheme ? filtreTheme.value : '';
  }

  function lancer(delai) {
    var valeur = champ.value;
    var theme = themeChoisi();
    clearTimeout(delaiSaisie);
    if (!valeur.trim() && !theme) {
      resultats.innerHTML = '';
      statut.textContent = '';
      return;
    }
    delaiSaisie = setTimeout(function () {
      assurerIndexCharge().then(function () {
        if (champ.value === valeur && themeChoisi() === theme) chercher(valeur, theme);
      });
    }, delai);
  }

  var delaiSaisie = null;
  champ.addEventListener('input', function () { lancer(250); });
  if (filtreTheme) filtreTheme.addEventListener('change', function () { lancer(0); });
})();
