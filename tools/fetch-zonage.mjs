/* =====================================================================
   Récupération du plan de zonage du PLU en vigueur, depuis le Géoportail
   de l'urbanisme (portail officiel de l'État, sans clé) :
   - le document en vigueur et ses pièces officielles (règlement écrit,
     planches du règlement graphique), pour les liens de la page ;
   - les zones (Ua, Ub, A, N…) et leurs contours, via l'API Carto de l'IGN.

   Le résultat (content/zonage-plu.json) est lu par src/build.mjs sans aucun
   appel réseau : la carte de la page « Urbanisme et PLU » est dessinée en
   SVG, sans service de cartographie tiers (règle « zéro requête tierce »).
   Relancé chaque semaine par .github/workflows/donnees-publiques.yml : une
   révision du PLU publiée sur le Géoportail se retrouve seule sur le site.
   À la main : « npm run zonage ».
   ===================================================================== */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(readFileSync(join(RACINE, 'content/site.json'), 'utf8'));
const PARTITION = `DU_${site.commune.codeInsee}`;
const GPU = 'https://www.geoportail-urbanisme.gouv.fr';
const ENTETES = { headers: { 'User-Agent': 'mairie-juvinas-fetch-zonage/1.0 (site municipal, hebdomadaire)' } };

// Tracés simplifiés à 3 m près : à l'échelle de la page (~0,3 pixel par
// mètre), l'écart est invisible et la carte tient dans le budget de poids.
const TOLERANCE_M = 3;
const LAT_REF = site.mairie.latitude;
const M_LAT = 111320;
const M_LON = 111320 * Math.cos((LAT_REF * Math.PI) / 180);

// Coquilles du document source, corrigées à l'affichage seulement.
const CORRECTIONS = [[/insatllations/g, 'installations'], [/pétrimètre/g, 'périmètre']];
const corriger = (texte) => CORRECTIONS.reduce((t, [motif, juste]) => t.replace(motif, juste), String(texte || ''));

async function lireJson(url) {
  const r = await fetch(url, ENTETES);
  if (!r.ok) throw new Error(`${r.status} sur ${url}`);
  return r.json();
}

const FICHIER = join(RACINE, 'content/zonage-plu.json');
const precedent = existsSync(FICHIER) ? JSON.parse(readFileSync(FICHIER, 'utf8')) : null;

// Taille d'un PDF, affichée à côté de son lien (les planches du plan de
// zonage dépassent 10 Mo : mieux vaut le savoir avant de les ouvrir sur un
// téléphone). Le serveur ne l'annonce pas (ni HEAD ni Range) : on compte
// les octets, mais seulement pour un fichier encore inconnu — une semaine
// ordinaire, le document n'a pas changé et rien n'est téléchargé.
async function taille(url) {
  const connue = precedent && [precedent.document.reglement, ...precedent.document.planches].find((f) => f && f.url === url && f.taille);
  if (connue) return connue.taille;
  try {
    const r = await fetch(url, ENTETES);
    if (!r.ok) return null;
    let total = 0;
    for await (const morceau of r.body) total += morceau.length;
    return total || null;
  } catch {
    return null;
  }
}

const versMetres = ([lon, lat]) => [lon * M_LON, lat * M_LAT];

function distanceSegment(p, a, b) {
  const [px, py] = versMetres(p), [ax, ay] = versMetres(a), [bx, by] = versMetres(b);
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// Douglas-Peucker, itératif (des anneaux de plusieurs centaines de points).
function simplifier(points) {
  if (points.length <= 4) return points;
  const garder = new Uint8Array(points.length);
  garder[0] = garder[points.length - 1] = 1;
  const pile = [[0, points.length - 1]];
  while (pile.length) {
    const [i, j] = pile.pop();
    let max = 0, indice = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distanceSegment(points[k], points[i], points[j]);
      if (d > max) { max = d; indice = k; }
    }
    if (max > TOLERANCE_M) { garder[indice] = 1; pile.push([i, indice], [indice, j]); }
  }
  const resultat = points.filter((_, k) => garder[k]);
  return resultat.length >= 4 ? resultat : points;
}

function dedans([x, y], anneau) {
  let dans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i], [xj, yj] = anneau[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dans = !dans;
  }
  return dans;
}

// Où poser l'étiquette d'une zone : le point intérieur le plus éloigné des
// bords, cherché sur une grille (le centre de gravité tombe parfois hors
// d'une zone en croissant). "rayonM" dit la place disponible autour, pour
// que la carte n'étiquette pas une zone trop petite pour son nom.
function etiquette(anneaux) {
  const [exterieur, ...trous] = anneaux;
  const lons = exterieur.map((p) => p[0]), lats = exterieur.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  let meilleur = null;
  const PAS = 24;
  for (let i = 1; i < PAS; i++) {
    for (let j = 1; j < PAS; j++) {
      const p = [x0 + ((x1 - x0) * i) / PAS, y0 + ((y1 - y0) * j) / PAS];
      if (!dedans(p, exterieur) || trous.some((t) => dedans(p, t))) continue;
      let d = Infinity;
      for (const anneau of anneaux) for (let k = 1; k < anneau.length; k++) d = Math.min(d, distanceSegment(p, anneau[k - 1], anneau[k]));
      if (!meilleur || d > meilleur.rayonM) meilleur = { point: p, rayonM: d };
    }
  }
  return meilleur;
}

const arrondir = ([lon, lat]) => [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];

async function main() {
  const documents = await lireJson(`${GPU}/api/document?partition=${PARTITION}`);
  const doc = documents.find((d) => d.effectiveStatus === 'EN_VIGUEUR') || documents[0];
  if (!doc) throw new Error(`aucun document pour ${PARTITION} sur le Géoportail de l'urbanisme`);
  const fichiers = await lireJson(`${GPU}/api/document/${doc.id}/files`);
  const url = (nom) => `${GPU}/api/document/${doc.id}/files/${encodeURIComponent(nom)}`;

  const reglement = fichiers.find((f) => f.path === 'Règlements' && /écrit/i.test(f.title)) || fichiers.find((f) => /_reglement_\d/.test(f.name));
  const planches = fichiers.filter((f) => /reglement_graphique/.test(f.name));

  const zonesBrutes = await lireJson(`https://apicarto.ign.fr/api/gpu/zone-urba?partition=${PARTITION}`);
  const parCode = new Map();
  let avant = 0, apres = 0;
  for (const f of zonesBrutes.features || []) {
    const p = f.properties;
    const code = String(p.libelle || '').trim();
    if (!code) continue;
    if (!parCode.has(code)) {
      parCode.set(code, {
        code,
        type: String(p.typezone || '').replace(/^AU.*/, 'AU'),
        description: corriger(p.libelong),
        page: Number((String(p.nomfic || '').match(/#page=(\d+)/) || [])[1]) || null,
        polygones: [],
      });
    }
    const polygones = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const anneaux of polygones) {
      avant += anneaux.reduce((n, a) => n + a.length, 0);
      const simples = anneaux.map(simplifier).map((a) => a.map(arrondir));
      apres += simples.reduce((n, a) => n + a.length, 0);
      const lieu = etiquette(simples);
      parCode.get(code).polygones.push({
        anneaux: simples,
        etiquette: lieu ? arrondir(lieu.point) : null,
        rayonM: lieu ? Math.round(lieu.rayonM) : 0,
      });
    }
  }
  if (!parCode.size) throw new Error('aucune zone renvoyée par l\'API Carto');

  // Ordre stable d'une semaine à l'autre (l'API ne garantit pas le sien) :
  // sans lui, le workflow hebdomadaire committerait un fichier inchangé.
  for (const z of parCode.values()) z.polygones.sort((a, b) => a.anneaux[0][0][0] - b.anneaux[0][0][0] || a.anneaux[0][0][1] - b.anneaux[0][0][1]);
  const ORDRE = ['U', 'AU', 'A', 'N'];
  const zones = [...parCode.values()].sort((a, b) => ORDRE.indexOf(a.type) - ORDRE.indexOf(b.type) || a.code.localeCompare(b.code, 'fr'));
  const approbation = (String(doc.originalName || '').match(/_(\d{4})(\d{2})(\d{2})$/) || []).slice(1).join('-') || null;

  const sortie = {
    misAJour: new Date().toISOString().slice(0, 10),
    source: 'Géoportail de l\'urbanisme (document en vigueur) et API Carto de l\'IGN',
    document: {
      id: doc.id,
      type: doc.type,
      approbation,
      reglement: reglement ? { titre: 'Règlement écrit', url: url(reglement.name), taille: await taille(url(reglement.name)) } : null,
      planches: await Promise.all(planches.map(async (f) => ({ titre: f.title, url: url(f.name), taille: await taille(url(f.name)) }))),
    },
    zones,
  };
  writeFileSync(FICHIER, `${JSON.stringify(sortie, null, 2)}\n`);
  console.log(`content/zonage-plu.json : ${zones.length} zones (${zones.map((z) => z.code).join(', ')}), ${avant} → ${apres} points, document du ${approbation}`);
}

main().catch((e) => {
  console.error(`Plan de zonage non mis à jour : ${e.message}`);
  process.exit(1);
});
