// Service worker du site : garde l'essentiel sur l'appareil pour les
// moments où le réseau manque — une crue sature vite le réseau mobile.
//
// Toujours le réseau d'abord : en ligne, le visiteur voit exactement le
// site publié. Le cache ne sert qu'en l'absence de connexion, avec en
// dernier recours la page /hors-ligne.html (numéros d'urgence, pages
// disponibles). Aucune requête vers un autre domaine n'est interceptée
// (Worker d'administration, liens externes) : seules les pages et les
// fichiers /assets/ du site sont gardés.
//
// Généré par src/build.mjs : VERSION change à chaque build, ce qui remplace
// le cache de la version précédente ; ESSENTIELS liste les pages
// enregistrées dès la première visite.
var VERSION = '__VERSION__';
var CACHE = 'mairie-' + VERSION;
var ESSENTIELS = __ESSENTIELS__;
var PAGE_HORS_LIGNE = '/hors-ligne.html';

// Cloudflare (site de développement) redirige /page.html vers /page : une
// même page peut être demandée sous deux adresses, d'où cette variante à
// essayer quand la première n'est pas en cache.
function variante(chemin) {
  if (chemin.slice(-5) === '.html') return chemin.slice(0, -5);
  if (chemin.slice(-1) !== '/') return chemin + '.html';
  return null;
}

// Une réponse obtenue au bout d'une redirection ne peut pas être resservie
// telle quelle à une navigation : le navigateur la refuse. On la recopie.
function nettoyer(reponse) {
  if (!reponse || !reponse.redirected) return reponse;
  return reponse.blob().then(function (corps) {
    return new Response(corps, { status: reponse.status, statusText: reponse.statusText, headers: reponse.headers });
  });
}

function depuisLeCache(requete, url, estPage) {
  var autre = estPage ? variante(url.pathname) : null;
  return caches.match(requete, { ignoreSearch: estPage })
    .then(function (r) { return r || (autre ? caches.match(autre) : undefined); })
    .then(function (r) {
      if (r || !estPage) return r;
      return caches.match(PAGE_HORS_LIGNE).then(function (h) { return h || caches.match(variante(PAGE_HORS_LIGNE)); });
    })
    .then(function (r) { return r ? nettoyer(r) : Response.error(); });
}

self.addEventListener('install', function (evenement) {
  evenement.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ESSENTIELS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evenement) {
  evenement.waitUntil(
    caches.keys()
      .then(function (cles) {
        return Promise.all(cles
          .filter(function (cle) { return cle.indexOf('mairie-') === 0 && cle !== CACHE; })
          .map(function (cle) { return caches.delete(cle); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (evenement) {
  var requete = evenement.request;
  if (requete.method !== 'GET') return;
  var url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  var estPage = requete.mode === 'navigate';
  if (!estPage && url.pathname.indexOf('/assets/') !== 0) return;

  evenement.respondWith(
    fetch(requete)
      .then(function (reponse) {
        // Une recherche (?q=…) ou un thème forcé (?theme=…) ne mérite pas
        // une place dans le cache : seules les pages « nues » y vont.
        if (reponse.ok && !url.search) {
          var copie = reponse.clone();
          caches.open(CACHE).then(function (cache) { cache.put(requete, copie); });
        }
        return reponse;
      })
      .catch(function () { return depuisLeCache(requete, url, estPage); })
  );
});
