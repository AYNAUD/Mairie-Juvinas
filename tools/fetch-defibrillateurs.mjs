/* =====================================================================
   Récupération des défibrillateurs (DAE) de la commune et des communes
   voisines, depuis la base nationale Géo'DAE (ministère de la Santé,
   publiée en open data sur data.gouv.fr, sans clé). L'API tabulaire de
   data.gouv.fr permet de filtrer par coordonnées : inutile de télécharger
   le fichier national complet (près de 80 Mo).

   Écrit content/defibrillateurs.json, lu par src/build.mjs (page
   « Risques et sécurité », fiche pratique, page hors connexion). Relancé
   chaque semaine par .github/workflows/donnees-publiques.yml, qui committe
   le fichier s'il a changé — aucun geste manuel, un lancement à la main
   reste possible via « npm run defibrillateurs ».

   En cas d'échec d'une API, le script s'arrête sans rien écrire : le site
   garde la dernière liste connue plutôt qu'une liste vide.
   ===================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(readFileSync(join(RACINE, 'content/site.json'), 'utf8'));
const { codeInsee } = site.commune;
// Les distances se mesurent depuis la mairie, au cœur du village — pas
// depuis le centre géographique du territoire communal (site.commune).
const { latitude, longitude } = site.mairie;

// Ressource CSV « geodae.csv » du jeu « Géo'DAE - Base nationale des
// défibrillateurs » : identifiant stable, le fichier est remplacé chaque
// jour sous le même identifiant.
const RESSOURCE = 'edb6a9e1-2f16-4bbf-99e7-c3eb6b90794c';
const URL_TABULAIRE = `https://tabular-api.data.gouv.fr/api/resources/${RESSOURCE}/data/`;
const URL_COMMUNES = 'https://geo.api.gouv.fr/communes';

const RAYON_KM = 8;
const NOMBRE_MAX = 12;

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Les horaires Géo'DAE suivent la syntaxe opening_hours d'OpenStreetMap
// (« 24/7 », « Mo-Fr 08:00-18:00 »). « Mo-Su off » est la valeur laissée
// quand l'exploitant n'a rien déclaré : on ne l'affiche pas comme « fermé ».
const JOURS = { Mo: 'lun.', Tu: 'mar.', We: 'mer.', Th: 'jeu.', Fr: 'ven.', Sa: 'sam.', Su: 'dim.', PH: 'jours fériés' };
function horairesEnClair(brut) {
  const h = String(brut || '').trim();
  if (!h || /^Mo-Su off$/i.test(h)) return null;
  if (h === '24/7') return 'jour et nuit, 7 jours sur 7';
  return h
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (j) => JOURS[j])
    .replace(/(\d{2}):(\d{2})/g, (_, hh, mm) => `${Number(hh)}h${mm === '00' ? '' : mm}`)
    .replace(/\boff\b/g, 'fermé')
    .replace(/;\s*/g, ' ; ');
}

const propre = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// La voie contient parfois déjà le numéro, voire le code postal et la ville
// (« 2bis Avenue Raoul Gaussen 30250 Sommières ») : on ne garde que la rue.
function adresse(num, voie) {
  const v = propre(voie).replace(/\s+\d{5}\s+.*$/, '');
  const n = propre(num);
  return n && !v.startsWith(n) ? `${n} ${v}` : v;
}

async function lireJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'mairie-juvinas-defibrillateurs/1.0 (site municipal, hebdomadaire)' } });
  if (!r.ok) throw new Error(`${r.status} sur ${url}`);
  return r.json();
}

// Fenêtre un peu plus large que le rayon (1° de latitude ≈ 111 km), le tri
// fin se fait ensuite à la distance réelle.
const dLat = (RAYON_KM + 1) / 111;
const dLon = (RAYON_KM + 1) / (111 * Math.cos((latitude * Math.PI) / 180));
const params = new URLSearchParams({
  c_lat_coor1__greater: String(latitude - dLat),
  c_lat_coor1__less: String(latitude + dLat),
  c_long_coor1__greater: String(longitude - dLon),
  c_long_coor1__less: String(longitude + dLon),
  page_size: '200',
});

const { data } = await lireJson(`${URL_TABULAIRE}?${params}`);

const retenus = (data || [])
  .filter((d) => d.c_etat_fonct === 'En fonctionnement' && d.c_etat_valid === 'validées' && d.c_doublon !== 't')
  // Accès libre au public uniquement : un DAE réservé au personnel d'une
  // entreprise ne sert à rien à un passant.
  .filter((d) => d.c_acc_lib === 't')
  .filter((d) => propre(d.c_adr_voie))
  .map((d) => ({
    codePostal: String(d.c_com_cp || ''),
    adresse: adresse(d.c_adr_num, d.c_adr_voie),
    acces: d.c_acc === 'Extérieur' ? 'extérieur' : 'intérieur',
    precision: propre(d.c_acc_complt) || null,
    horaires: horairesEnClair(d.c_dispo_horaires),
    latitude: Number(d.c_lat_coor1),
    longitude: Number(d.c_long_coor1),
    distanceKm: Math.round(distanceKm(latitude, longitude, Number(d.c_lat_coor1), Number(d.c_long_coor1)) * 10) / 10,
  }))
  .filter((d) => Number.isFinite(d.distanceKm) && d.distanceKm <= RAYON_KM)
  .sort((a, b) => a.distanceKm - b.distanceKm);

// La commune est retrouvée à partir des coordonnées (API Découpage
// administratif) plutôt que lue dans la fiche : le code Insee y manque
// parfois, et le nom mélange « SOMMIERES » et « Sommières ». Le code
// postal de la fiche doit relever du même département que ces coordonnées :
// sinon la fiche est mal géolocalisée (un chantier d'Île-de-France placé
// dans le Gard, constaté en 2026) et on l'écarte.
for (const d of retenus) {
  const [commune] = await lireJson(`${URL_COMMUNES}?lat=${d.latitude}&lon=${d.longitude}&fields=nom,code,codeDepartement`);
  d.insee = commune ? commune.code : null;
  d.commune = commune ? commune.nom : null;
  d.valide = Boolean(commune) && d.codePostal.startsWith(commune.codeDepartement);
}
// Un même appareil est parfois déclaré deux fois, à quelques mètres près.
const vus = new Set();
const garde = retenus
  .filter((d) => d.valide)
  .filter((d) => {
    const cle = `${d.latitude.toFixed(3)},${d.longitude.toFixed(3)}`;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  })
  .sort((a, b) => (b.insee === codeInsee) - (a.insee === codeInsee) || a.distanceKm - b.distanceKm)
  .slice(0, NOMBRE_MAX);

const sortie = {
  misAJour: new Date().toISOString().slice(0, 10),
  source: "Géo'DAE — Base nationale des défibrillateurs (ministère de la Santé), via data.gouv.fr",
  rayonKm: RAYON_KM,
  defibrillateurs: garde.map(({ insee, codePostal, valide, commune, ...d }) => ({ commune, dansLaCommune: insee === codeInsee, ...d })),
};

writeFileSync(join(RACINE, 'content/defibrillateurs.json'), JSON.stringify(sortie, null, 2) + '\n');
console.log(`  ${sortie.defibrillateurs.length} défibrillateur(s) dans un rayon de ${RAYON_KM} km, dont ${sortie.defibrillateurs.filter((d) => d.dansLaCommune).length} à Lecques.`);
