/* =====================================================================
   Récupération du fond de plan (contour de la commune + voirie) utilisé
   par la carte des acteurs économiques, à partir d'OpenStreetMap (API
   Overpass, réutilisation libre sous licence ODbL, sans clé).
   À la différence de content/entreprises.json (relancé chaque nuit), ce
   fond de plan ne change quasiment jamais : ce script se relance à la
   main, seulement si le tracé doit être rafraîchi ("npm run carte").
   Le résultat (content/carte-fond.json) est ensuite lu par src/build.mjs
   sans aucun appel réseau : la page publiée ne parle à aucun service de
   cartographie tiers, conformément à la règle "zéro requête tierce".
   ===================================================================== */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE_INSEE = '07111';
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// L'instance publique d'Overpass est parfois momentanément saturée
// (504 "server too busy") : quelques nouvelles tentatives espacées
// suffisent presque toujours, sans intervention manuelle.
async function requeteOverpass(ql, tentative = 1) {
  // Un User-Agent par défaut (ou absent) fait répondre 406 à l'Apache qui
  // sert overpass-api.de (négociation de contenu) : on s'identifie donc
  // explicitement, comme le recommande la documentation de l'API.
  const r = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: '*/*',
      'User-Agent': 'mairie-juvinas-fetch-carte-fond/1.0 (site municipal, usage ponctuel)'
    },
    body: `data=${encodeURIComponent(ql)}`
  });
  if (!r.ok) {
    if ([429, 502, 503, 504].includes(r.status) && tentative < 5) {
      console.log(`  (${r.status}, nouvelle tentative dans ${tentative * 5}s…)`);
      await attendre(tentative * 5000);
      return requeteOverpass(ql, tentative + 1);
    }
    throw new Error(`${r.status} sur Overpass`);
  }
  return r.json();
}

// Les membres "outer" d'une relation de limite administrative ne sont pas
// forcément dans l'ordre ni tous orientés dans le même sens : on les
// assemble bout à bout (tolérance sur l'égalité de deux points flottants)
// pour reconstituer un contour continu.
function assemblerContour(ways) {
  const segments = ways.map((w) => w.geometry.map((p) => [p.lon, p.lat]));
  const memePoint = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  const restants = segments.slice();
  const contour = restants.shift();
  while (restants.length) {
    const fin = contour[contour.length - 1];
    const i = restants.findIndex((s) => memePoint(s[0], fin) || memePoint(s[s.length - 1], fin));
    if (i === -1) break; // contour discontinu (donnée OSM incomplète) : on garde ce qui a pu être assemblé
    const [s] = restants.splice(i, 1);
    if (memePoint(s[0], fin)) contour.push(...s.slice(1));
    else contour.push(...s.slice(0, -1).reverse());
  }
  return contour;
}

// Douglas-Peucker : réduit le nombre de points d'une polyligne tout en
// conservant sa forme, pour rester dans le budget de poids du site.
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
const arrondi = (n) => Math.round(n * 1e6) / 1e6;

console.log('\nFond de plan (contour de la commune + voirie, OpenStreetMap)');

const relations = await requeteOverpass(
  `[out:json][timeout:25];relation["boundary"="administrative"]["admin_level"="8"]["ref:INSEE"="${CODE_INSEE}"];out geom;`
);
const relation = relations.elements[0];
if (!relation) throw new Error(`Limite communale introuvable pour l'Insee ${CODE_INSEE}`);
const contourBrut = assemblerContour(relation.members.filter((m) => m.type === 'way' && m.role === 'outer'));
const contour = simplifier(contourBrut, 0.00006).map(([lon, lat]) => [arrondi(lon), arrondi(lat)]);

let minlat = 90, maxlat = -90, minlon = 180, maxlon = -180;
for (const [lon, lat] of contourBrut) {
  minlat = Math.min(minlat, lat); maxlat = Math.max(maxlat, lat);
  minlon = Math.min(minlon, lon); maxlon = Math.max(maxlon, lon);
}

const routesBrutes = await requeteOverpass(
  `[out:json][timeout:25];way["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street)$"](${minlat},${minlon},${maxlat},${maxlon});out geom;`
);
// Le nom n'est gardé que pour les voies "principales" (primaire/secondaire/
// tertiaire) : c'est la seule information dont src/templates/views.mjs se
// sert pour décider quelles voies étiqueter sur la carte, quand la place
// le permet — pas question d'écrire le nom de chaque petite rue résidentielle.
const PRINCIPALES = ['primary', 'secondary', 'tertiary'];
const routes = routesBrutes.elements
  .map((w) => ({
    points: simplifier(w.geometry.map((p) => [p.lon, p.lat]), 0.00003).map(([lon, lat]) => [arrondi(lon), arrondi(lat)]),
    nom: PRINCIPALES.includes(w.tags.highway) ? (w.tags.name || null) : null,
    // Sert à la carte simplifiée de la commune (page « Découvrir Juvinas »),
    // qui ne trace en gras que les routes de liaison.
    principale: PRINCIPALES.includes(w.tags.highway)
  }))
  .filter((r) => r.points.length >= 2);

// Villages et hameaux de la commune, avec leur nom d'usage : la liste
// officielle des hameaux n'est pas publiée en données ouvertes, OpenStreetMap
// (relevé par les habitants et les cartographes) est la seule source locale
// utilisable. Seuls les lieux typés village ou hameau sont gardés, pas les
// habitations isolées ni les lieux-dits (granges, quartiers).
const lieuxBruts = await requeteOverpass(
  `[out:json][timeout:25];rel["boundary"="administrative"]["admin_level"="8"]["ref:INSEE"="${CODE_INSEE}"];map_to_area->.c;nwr["place"~"^(village|hamlet)$"]["name"](area.c);out center tags;`
);
const lieux = lieuxBruts.elements
  .map((e) => ({
    nom: e.tags.name,
    type: e.tags.place === 'village' ? 'village' : 'hameau',
    position: [arrondi(e.lon ?? e.center.lon), arrondi(e.lat ?? e.center.lat)]
  }));

// Lieux que OpenStreetMap ne classe pas comme village ou hameau mais qui en
// sont (content/carte-lieux-complements.json) : ajoutés, sans doublon de nom.
const fichierComplements = join(RACINE, 'content/carte-lieux-complements.json');
if (existsSync(fichierComplements)) {
  for (const c of JSON.parse(readFileSync(fichierComplements, 'utf8')).lieux || []) {
    if (!lieux.some((l) => l.nom === c.nom)) lieux.push({ nom: c.nom, type: c.type, position: c.position });
  }
}
lieux.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

// La Bésorgues traverse une bien plus vaste zone que la commune : la requête
// par boîte englobante renvoie la géométrie COMPLÈTE des voies qui la
// croisent, pas seulement leur portion locale. On découpe donc chaque tracé
// à la zone qui nous intéresse (avec une marge, pour que la ligne rejoigne
// proprement le bord de la carte plutôt que de s'arrêter net dedans).
function decouper(points, marge) {
  const zone = { minlat: minlat - marge, maxlat: maxlat + marge, minlon: minlon - marge, maxlon: maxlon + marge };
  const dans = ([lon, lat]) => lat >= zone.minlat && lat <= zone.maxlat && lon >= zone.minlon && lon <= zone.maxlon;
  const segments = [];
  let courant = [];
  for (let i = 0; i < points.length; i++) {
    if (dans(points[i])) courant.push(points[i]);
    else { if (courant.length >= 2) segments.push(courant); courant = []; }
  }
  if (courant.length >= 2) segments.push(courant);
  return segments;
}
// OSM orthographie ce cours d'eau "La Bézorgues" (nom principal) avec
// "La Bésorgues" en alt_name — les deux graphies circulent, la requête les
// couvre donc toutes les deux plutôt que de se fier à une seule.
const riviereBrute = await requeteOverpass(
  `[out:json][timeout:25];way["waterway"~"^(river|stream)$"]["name"~"^(La )?(Bésorgues|Bézorgues)$"](${minlat},${minlon},${maxlat},${maxlon});out geom;`
);
const riviere = riviereBrute.elements
  .flatMap((w) => decouper(w.geometry.map((p) => [p.lon, p.lat]), 0.02))
  .map((seg) => simplifier(seg, 0.00003).map(([lon, lat]) => [arrondi(lon), arrondi(lat)]));

const sortie = {
  misAJour: new Date().toISOString().slice(0, 10),
  source: 'OpenStreetMap (ODbL) via overpass-api.de',
  bbox: { minlat: arrondi(minlat), maxlat: arrondi(maxlat), minlon: arrondi(minlon), maxlon: arrondi(maxlon) },
  communeContour: contour,
  routes,
  riviere,
  lieux
};

writeFileSync(join(RACINE, 'content/carte-fond.json'), JSON.stringify(sortie) + '\n');
console.log(`  Contour communal : ${contour.length} points (${contourBrut.length} avant simplification)`);
console.log(`  Voirie : ${routes.length} tronçons, dont ${routes.filter((r) => r.nom).length} nommés (voies principales)`);
console.log(`  Villages et hameaux : ${lieux.map((l) => l.nom).join(', ')}`);
console.log(`  Bésorgues : ${riviere.length} tronçon(s) dans la zone`);
console.log('  → content/carte-fond.json mis à jour\n');
