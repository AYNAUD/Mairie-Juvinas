// Infobulle du plan de zonage (voir src/templates/views.mjs, planZonage) :
// au survol d'une zone, ou au toucher sur téléphone, son code et son
// intitulé complet, près du pointeur. Chargé seulement sur les pages qui
// montrent le plan. Sans ce script, la balise <title> de chaque zone donne
// la même information en infobulle native, et la légende la reprend en
// toutes lettres.
(function () {
  var zones = document.querySelectorAll('.plan-zonage__zone');
  if (!zones.length) return;

  // L'infobulle native ferait doublon avec celle-ci : on retire les <title>,
  // dont le texte est déjà dans data-code et data-intitule.
  Array.prototype.forEach.call(zones, function (zone) {
    var titre = zone.querySelector('title');
    if (titre) zone.removeChild(titre);
  });

  var bulle = document.createElement('div');
  bulle.className = 'infobulle-zone';
  bulle.hidden = true;
  var code = document.createElement('strong');
  var intitule = document.createElement('span');
  bulle.appendChild(code);
  bulle.appendChild(intitule);
  document.body.appendChild(bulle);

  var survolee = null;
  var MARGE = 14;

  function placer(x, y) {
    var largeur = bulle.offsetWidth, hauteur = bulle.offsetHeight;
    // À droite du pointeur si la place le permet, sinon à gauche ; au-dessus
    // plutôt que dessous, pour ne pas être masquée par le doigt.
    var gauche = x + MARGE + largeur > window.innerWidth - 8 ? x - MARGE - largeur : x + MARGE;
    var haut = y - MARGE - hauteur < 8 ? y + MARGE : y - MARGE - hauteur;
    bulle.style.left = Math.max(8, gauche) + 'px';
    bulle.style.top = Math.max(8, haut) + 'px';
  }

  function montrer(zone, x, y) {
    if (survolee !== zone) {
      if (survolee) survolee.classList.remove('est-survolee');
      survolee = zone;
      zone.classList.add('est-survolee');
      code.textContent = zone.getAttribute('data-code');
      intitule.textContent = zone.getAttribute('data-intitule');
    }
    bulle.hidden = false;
    placer(x, y);
  }

  function cacher() {
    bulle.hidden = true;
    if (survolee) survolee.classList.remove('est-survolee');
    survolee = null;
  }

  Array.prototype.forEach.call(zones, function (zone) {
    zone.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') montrer(zone, e.clientX, e.clientY);
    });
    zone.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') cacher();
    });
    // Au doigt : un toucher ouvre l'infobulle, un toucher ailleurs la ferme.
    zone.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') {
        e.stopPropagation();
        montrer(zone, e.clientX, e.clientY);
      }
    });
  });

  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' && !bulle.hidden) cacher();
  });
  // Échap la ferme (WCAG 1.4.13), comme un défilement qui l'éloignerait de sa zone.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') cacher();
  });
  window.addEventListener('scroll', function () {
    if (!bulle.hidden) cacher();
  }, { passive: true });
})();
