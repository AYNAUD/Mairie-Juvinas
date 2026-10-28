/* =====================================================================
   Fond de la carte « Autour de la commune » (page Tourisme) et temps de
   trajet en voiture depuis la mairie vers chaque site de
   content/tourisme-sites.json.
   - Fond : routes principales, rivières, villages, limite départementale et tracé des voies vertes, relevés une fois pour toutes
     dans OpenStreetMap (API Overpass, licence ODbL, sans clé) sur
     l'emprise des sites, avec une marge.
   - Trajets : calcul d'itinéraire de l'IGN (Géoplateforme, sans clé),
     vers le point d'accès de chaque site (départ du sentier, parking).
   Comme content/carte-fond.json, ce fond ne change presque jamais : le
   script se relance à la main ("npm run carte:tourisme"), après l'ajout
   ou le déplacement d'un site. Le résultat (content/carte-tourisme.json)
   est lu par src/build.mjs sans aucun appel réseau : la page publiée ne
   parle à aucun service de cartographie tiers.
   ===================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const ITINERAIRE = 'https://data.geopf.fr/navigation/itineraire';
const TRAJET_MAX = 30; // minutes : au-delà, le site n'a pas sa place sur cette carte

const lire = (f) => JSON.parse(readFileSync(join(RACINE, 'content', f), 'utf8'));
const { sites } = lire('tourisme-sites.json');
const { mairie } = lire('site.json');
const MAIRIE = [mairie.longitude, mairie.latitude];

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mêmes précautions que tools/fetch-carte-fond.mjs : User-Agent explicite
// (sinon 406) et nouvelles tentatives quand l'instance publique sature.
async function requeteOverpass(ql, tentative = 1) {
  const r = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: '*/*',
      'User-Agent': 'mairie-juvinas-fetch-carte-tourisme/1.0 (site municipal, usage ponctuel)'
    },
    body: `data=${encodeURIComponent(ql)}`
  });
  if (!r.ok) {
    if ([429, 502, 503, 504].includes(r.status) && tentative < 5) {
      console.log(`  (${r.status}, nouvelle tentative dans ${tentative * 10}s…)`);
      await attendre(tentative * 10000);
      return requeteOverpass(ql, tentative + 1);
    }
    throw new Error(`${r.status} sur Overpass`);
  }
  return r.json();
}

// Douglas-Peucker, comme dans tools/fetch-carte-fond.mjs.
function distancePointSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function simplifier(points, tolerance) {
  if (points.length < 3) return points;
  let iMax = 0, dMax = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distancePointSegment(points[i], points[0], points[points.length - 1]);
    if (d > dMax) { iMax = i; dMax = d; }
  }
  if (dMax > tolerance) {
    const gauche = simplifier(points.slice(0, iMax + 1), tolerance);
    const droite = simplifier(points.slice(iMax), tolerance);
    return gauche.slice(0, -1).concat(droite);
  }
  return [points[0], points[points.length - 1]];
}
// Au 1/10 000 de degré (une dizaine de mètres) : la carte couvre une
// trentaine de kilomètres, un pixel y vaut déjà une cinquantaine de mètres.
const arrondi = (n) => Math.round(n * 1e4) / 1e4;
const nettoyer = (points, tolerance) => simplifier(points, tolerance).map(([lon, lat]) => [arrondi(lon), arrondi(lat)]);

// Emprise : tous les repères et points d'accès, la mairie, et une marge
// d'un dixième de chaque côté, 3 km au moins, pour que les repères du
// bord ne touchent pas le cadre et qu'on voie où mènent les routes.
const points = [MAIRIE, ...sites.flatMap((s) => [s.position, s.acces].filter(Boolean))];
const lons = points.map((p) => p[0]), lats = points.map((p) => p[1]);
const margeLon = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.1, 3000 / (111320 * Math.cos((MAIRIE[1] * Math.PI) / 180)));
const margeLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.1, 3000 / 111320);
const bbox = {
  minlon: arrondi(Math.min(...lons) - margeLon), maxlon: arrondi(Math.max(...lons) + margeLon),
  minlat: arrondi(Math.min(...lats) - margeLat), maxlat: arrondi(Math.max(...lats) + margeLat)
};
const bboxQl = `${bbox.minlat},${bbox.minlon},${bbox.maxlat},${bbox.maxlon}`;

// Overpass renvoie la géométrie complète des voies qui croisent l'emprise :
// on ne garde que les morceaux dedans (plus une petite marge, pour que les
// traits rejoignent proprement le bord du cadre).
function decouper(geom, marge = 0.01) {
  const dans = ([lon, lat]) => lon >= bbox.minlon - marge && lon <= bbox.maxlon + marge && lat >= bbox.minlat - marge && lat <= bbox.maxlat + marge;
  const segments = [];
  let courant = [];
  for (const p of geom) {
    if (dans(p)) courant.push(p);
    else { if (courant.length >= 2) segments.push(courant); courant = []; }
  }
  if (courant.length >= 2) segments.push(courant);
  return segments;
}

// Raboute les tronçons qui se touchent par une extrémité : une route ou
// une rivière arrive d'OpenStreetMap découpée en dizaines de petits
// morceaux, qu'on dessine bien plus légèrement d'un seul trait.
function rabouter(lignes) {
  const cle = ([lon, lat]) => `${lon},${lat}`;
  const restantes = lignes.map((l) => l.slice());
  const sortie = [];
  while (restantes.length) {
    let ligne = restantes.shift();
    let prolongee = true;
    while (prolongee) {
      prolongee = false;
      for (let i = 0; i < restantes.length; i++) {
        const l = restantes[i];
        const [debut, fin] = [cle(ligne[0]), cle(ligne[ligne.length - 1])];
        if (cle(l[0]) === fin) ligne = ligne.concat(l.slice(1));
        else if (cle(l[l.length - 1]) === fin) ligne = ligne.concat(l.slice(0, -1).reverse());
        else if (cle(l[l.length - 1]) === debut) ligne = l.concat(ligne.slice(1));
        else if (cle(l[0]) === debut) ligne = l.slice(1).reverse().concat(ligne);
        else continue;
        restantes.splice(i, 1);
        prolongee = true;
        break;
      }
    }
    sortie.push(ligne);
  }
  return sortie;
}

const geometrie = (w) => w.geometry.map((p) => [p.lon, p.lat]);
const lignesDe = (ways, tolerance) => rabouter(ways.flatMap((w) => decouper(geometrie(w))))
  .map((l) => nettoyer(l, tolerance))
  .filter((l) => l.length >= 2);

console.log('\nCarte « Autour de la commune » (OpenStreetMap + itinéraires IGN)');
console.log(`  Emprise : ${bbox.minlat}–${bbox.maxlat} N, ${bbox.minlon}–${bbox.maxlon} E`);

// Routes : autoroutes et voies rapides, puis grands axes (routes
// nationales et départementales principales), puis routes de liaison
// entre villages. Rien de plus fin : à cette échelle, le reste brouille.
const CLASSES = { motorway: 'autoroute', trunk: 'autoroute', primary: 'principale', secondary: 'principale', tertiary: 'locale' };
const routesBrutes = await requeteOverpass(
  `[out:json][timeout:60];way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${bboxQl});out geom;`
);
const routes = {};
for (const [type, classe] of Object.entries(CLASSES)) {
  const ways = routesBrutes.elements.filter((w) => w.tags.highway === type);
  routes[classe] = (routes[classe] || []).concat(ways);
}
const TOLERANCE = 0.0003; // une trentaine de mètres
const routesSortie = Object.fromEntries(Object.entries(routes).map(([classe, ways]) => [classe, lignesDe(ways, TOLERANCE)]));

const rivieresBrutes = await requeteOverpass(
  `[out:json][timeout:60];way["waterway"="river"](${bboxQl});out geom;`
);
const parRiviere = new Map();
for (const w of rivieresBrutes.elements) {
  const nom = w.tags.name || '';
  if (!parRiviere.has(nom)) parRiviere.set(nom, []);
  parRiviere.get(nom).push(w);
}
// Le cours d'eau principal de la commune est dessiné plus épais que ses affluents.
// Noms OSM du ou des cours d'eau dessinés en plus épais (site.json → riviere.nomsOsm).
const NOMS_PRINCIPAUX = (lire('site.json').riviere || {}).nomsOsm || [];
const rivieres = [...parRiviere].map(([nom, ways]) => ({
  nom: nom || null,
  ...(NOMS_PRINCIPAUX.includes(nom) ? { principale: true } : {}),
  lignes: lignesDe(ways, TOLERANCE)
}));

// Villages et bourgs, avec leur population : le gabarit n'écrit que les
// plus peuplés et ceux qui accueillent un site, là où il y a la place.
const lieuxBruts = await requeteOverpass(
  `[out:json][timeout:60];node["place"~"^(town|village)$"]["name"](${bboxQl});out;`
);
const lieux = lieuxBruts.elements
  .map((n) => ({ nom: n.tags.name, position: [arrondi(n.lon), arrondi(n.lat)], population: Number(n.tags.population) || 0 }))
  .sort((a, b) => b.population - a.population);

// Limites départementales : les voies de tous les départements qui
// passent dans l'emprise (une voie commune n'est renvoyée qu'une fois).
const limitesBrutes = await requeteOverpass(
  `[out:json][timeout:60];rel["boundary"="administrative"]["admin_level"="6"](${bboxQl})->.d;way(r.d)(${bboxQl});out geom;`
);
const departements = lignesDe(limitesBrutes.elements, TOLERANCE);

// Tracés des itinéraires qui en ont un (relations OpenStreetMap de la
// voie verte) : dessinés tels quels, plutôt qu'un simple point de départ.
const traces = {};
for (const s of sites.filter((x) => x.osm && x.osm.length)) {
  const brut = await requeteOverpass(`[out:json][timeout:60];rel(id:${s.osm.join(',')});way(r);out geom;`);
  traces[s.id] = lignesDe(brut.elements, 0.0002);
}

// Temps de trajet en voiture depuis la mairie, au plus rapide.
async function trajet(arrivee, tentative = 1) {
  const url = `${ITINERAIRE}?resource=bdtopo-pgr&profile=car&optimization=fastest&start=${MAIRIE.join(',')}&end=${arrivee.join(',')}&getSteps=false&timeUnit=minute&distanceUnit=kilometer`;
  const r = await fetch(url, { headers: { 'User-Agent': 'mairie-juvinas-fetch-carte-tourisme/1.0' } });
  if (r.status === 429 && tentative < 5) {
    await attendre(tentative * 5000);
    return trajet(arrivee, tentative + 1);
  }
  if (!r.ok) throw new Error(`${r.status} sur l'itinéraire IGN`);
  const j = await r.json();
  return { km: Math.round(j.distance * 10) / 10, minutes: Math.round(j.duration) };
}
const trajets = {};
for (const s of sites) {
  trajets[s.id] = await trajet(s.acces || s.position);
  const { km, minutes } = trajets[s.id];
  console.log(`  ${s.nom} : ${km} km, ${minutes} min${minutes > TRAJET_MAX ? `  ⚠ plus de ${TRAJET_MAX} min` : ''}`);
  await attendre(1200); // la Géoplateforme limite le nombre d'appels par seconde
}

const sortie = {
  misAJour: new Date().toISOString().slice(0, 10),
  source: 'OpenStreetMap (ODbL) via overpass-api.de ; temps de trajet : IGN, Géoplateforme (calcul d’itinéraire)',
  bbox,
  routes: routesSortie,
  rivieres,
  lieux,
  departements,
  traces,
  trajets
};

writeFileSync(join(RACINE, 'content/carte-tourisme.json'), JSON.stringify(sortie) + '\n');
const nbPoints = (lignes) => lignes.reduce((t, l) => t + l.length, 0);
console.log(`  Routes : ${Object.entries(routesSortie).map(([c, l]) => `${c} ${l.length} traits / ${nbPoints(l)} points`).join(', ')}`);
console.log(`  Rivières : ${rivieres.map((r) => r.nom || '(sans nom)').join(', ')}`);
console.log(`  Villages : ${lieux.length} ; limite départementale : ${departements.length} trait(s) ; tracés : ${Object.keys(traces).join(', ') || 'aucun'}`);
console.log('  → content/carte-tourisme.json mis à jour\n');
