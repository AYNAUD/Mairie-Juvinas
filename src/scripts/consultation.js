// Affiche le compteur de réponses et les résultats en direct d'une
// consultation ouverte (voir src/templates/views.mjs, pageConsultation).
// Chargé uniquement sur la page d'une consultation ouverte sans résultats
// définitifs, pas dans le bundle commun à tout le site. Si l'appel échoue
// (Worker indisponible), la section reste masquée : le formulaire de vote,
// rendu côté serveur, fonctionne de toute façon sans JavaScript.
(function () {
  // Confirmation après un vote : le Worker redirige vers cette page avec
  // "?vote=merci", "?vote=merci-commentaire" ou "?vote=deja" (voir
  // worker/consultations.mjs, dejaVote/commentaireEnregistre), un formulaire
  // POST classique n'ayant sinon aucun autre moyen d'informer visuellement
  // l'habitant du résultat de son vote — sans JS, la page se recharge à
  // l'identique et le seul signal reste la mise à jour, plus tard, du
  // compteur de réponses.
  //
  // Pas de garde sessionStorage ici (essayé, puis retiré) : un premier essai
  // bloquait TOUT réaffichage du bandeau pour cette page dans l'onglet, donc
  // aussi un "?vote=deja" légitime suivant un "?vote=merci" tout juste vu —
  // deux évènements bien distincts qui doivent chacun s'afficher. Nettoyage
  // d'URL (replaceState) + protection bfcache (pageshow, plus bas) suffisent :
  // le bandeau ne s'affiche que quand "?vote=..." est réellement dans l'URL
  // au chargement, jamais sur une page restaurée depuis le cache.
  var MESSAGES_VOTE = {
    merci: 'Merci, votre réponse a été enregistrée.',
    'merci-commentaire': 'Merci, votre réponse et votre commentaire ont été enregistrés.',
    deja: 'Vous avez déjà voté pour cette consultation !'
  };
  var confirmation = document.getElementById('consultation-confirmation');
  if (confirmation) {
    var statutVote = new URLSearchParams(location.search).get('vote');
    if (statutVote && MESSAGES_VOTE[statutVote]) {
      var texte = confirmation.querySelector('[data-texte]');
      if (texte) texte.textContent = MESSAGES_VOTE[statutVote];
      confirmation.classList.toggle('consultation-confirmation--deja', statutVote === 'deja');
      confirmation.hidden = false;
      if (window.history && history.replaceState) {
        var url = new URL(location.href);
        url.searchParams.delete('vote');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    }

    // "pageshow" avec persisted=true : le bfcache (bouton précédent, onglet
    // restauré par le navigateur) peut réafficher l'état visuel EXACT de la
    // page au moment de la quitter — y compris ce bandeau — SANS réexécuter
    // ce script, donc sans repasser par le nettoyage ci-dessus. Un bandeau
    // "votre réponse vient d'être enregistrée" n'a plus de sens sur une page
    // restaurée depuis le cache : on le masque à coup sûr.
    window.addEventListener('pageshow', function (evenement) {
      if (evenement.persisted) confirmation.hidden = true;
    });
  }

  var section = document.getElementById('consultation-resultats');
  if (!section) return;
  var urlApi = section.getAttribute('data-api');
  if (!urlApi) return;

  fetch(urlApi)
    .then(function (r) {
      if (!r.ok) throw new Error('réponse ' + r.status);
      return r.json();
    })
    .then(function (donnees) {
      var total = donnees.total || 0;
      var options = donnees.options || [];

      var barres = section.querySelector('[data-barres]');
      options.forEach(function (o) {
        var ligne = section.querySelector('[data-option="' + o.id + '"]');
        if (!ligne) return;
        var pct = total ? Math.round((o.voix / total) * 100) : 0;
        var pourcentage = ligne.querySelector('[data-pourcentage]');
        var valeur = ligne.querySelector('[data-valeur]');
        if (pourcentage) pourcentage.textContent = pct + ' %';
        if (valeur) valeur.style.inlineSize = pct + '%';
      });
      if (barres) barres.hidden = false;

      var totalTexte = section.querySelector('[data-total]');
      if (totalTexte) totalTexte.textContent = total + ' réponse' + (total > 1 ? 's' : '') + ' pour le moment.';
    })
    .catch(function () {
      // Silencieux : le formulaire de vote reste utilisable sans résultats.
    });
})();
