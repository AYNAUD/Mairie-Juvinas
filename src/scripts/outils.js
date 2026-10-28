// Petites améliorations, sans lesquelles tout reste utilisable :
// - [data-imprimer] : bouton « Imprimer cette fiche » (fiche pratique),
//   caché sans JavaScript, où l'impression du navigateur suffit ;
// - [data-webcal] / [data-adresse] : adresses des calendriers réécrites pour
//   le domaine réellement consulté (le HTML les rend pour site.url) ;
// - enregistrement du service worker qui garde l'essentiel du site sur
//   l'appareil en cas de coupure de réseau (voir src/scripts/sw.js).
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('[data-imprimer]'), function (bouton) {
    bouton.hidden = false;
    bouton.addEventListener('click', function () { window.print(); });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-webcal]'), function (a) {
    a.href = 'webcal://' + location.host + a.getAttribute('data-webcal');
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-adresse]'), function (el) {
    el.textContent = location.origin + el.getAttribute('data-adresse');
  });

  // Après le chargement complet, pour ne jamais ralentir l'affichage.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();
