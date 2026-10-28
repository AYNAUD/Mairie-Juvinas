/* =====================================================================
   « Ma maison face aux risques » (page « Risques et sécurité ») : pour une
   adresse de Juvinas, ce que disent les documents officiels à cet endroit
   précis. Route publique GET /risques/adresse?q=…

   Sources, toutes publiques et sans clé :
   - Géoplateforme de l'IGN (data.geopf.fr) : l'adresse en coordonnées ;
   - API Carto de l'IGN, module Géoportail de l'urbanisme : zones
     inondables et servitude PM1 d'un éventuel PPRI. Juvinas est au
     règlement national d'urbanisme (ni PLU ni carte communale) : la zone
     d'urbanisme reste donc vide, et c'est normal ;
   - Géorisques (BRGM / ministère) : retrait-gonflement des argiles au
     point, sismicité, radon et arrêtés de catastrophe naturelle de la
     commune.

   Le navigateur du visiteur ne parle qu'à ce Worker (« zéro requête
   tierce », CLAUDE.md). L'adresse saisie n'est ni mise en cache ni
   journalisée : elle ne sert qu'à la réponse. Seules les adresses de
   Juvinas sont traitées, pour ne pas servir de relais ouvert.
   ===================================================================== */

const CODE_INSEE = '07111';
const URL_GEOCODAGE = 'https://data.geopf.fr/geocodage/search';
const URL_GPU = 'https://apicarto.ign.fr/api/gpu';
const URL_GEORISQUES = 'https://georisques.gouv.fr/api/v1';
// En dessous, le géocodeur a deviné plus qu'il n'a trouvé.
const SCORE_MINIMAL = 0.4;

const ENTETES = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  // Réponse propre à une adresse : jamais gardée par un cache intermédiaire.
  'Cache-Control': 'no-store',
};

const ORDRE_ALEA = ['résiduel', 'modéré', 'fort'];

/** Résumé des réponses brutes des API (chacune peut être null si elle n'a
 *  pas répondu : la partie correspondante est alors « indisponible »).
 *  Fonction pure, testée dans worker/test-local.mjs. */
export function resumerRisquesAdresse({ adresse, prescriptions, zonesUrba, servitudes, argiles, sismicite, radon, catnat }) {
  const libelles = prescriptions ? (prescriptions.features || []).map((f) => String(f.properties.libelle || '')) : null;

  let inondation = null;
  if (libelles || servitudes) {
    const zones = [...new Set((libelles || []).filter((l) => /inondab|ppri/i.test(l)))];
    const aleas = zones
      .map((l) => (l.match(/aléa\s+(fort|modéré|résiduel)/i) || [])[1])
      .filter(Boolean)
      .map((a) => a.toLowerCase());
    const alea = aleas.sort((a, b) => ORDRE_ALEA.indexOf(b) - ORDRE_ALEA.indexOf(a))[0] || (zones.length ? 'non précisé' : null);
    inondation = {
      alea,
      zones,
      ppri: !!servitudes && (servitudes.features || []).some((f) => /pm1/i.test(String(f.properties.suptype || ''))),
      reculCoursEau: (libelles || []).some((l) => /recul.*cours d.eau/i.test(l)),
    };
  }

  const zone = zonesUrba && (zonesUrba.features || [])[0];
  const sismique = sismicite && (sismicite.data || [])[0];
  const radonCommune = radon && (radon.data || [])[0];
  return {
    adresse,
    inondation,
    plu: zone ? { zone: zone.properties.libelle || null, description: zone.properties.libelong || null } : null,
    argiles: argiles && argiles.exposition ? { exposition: argiles.exposition, niveau: Number(argiles.codeExposition) || null } : null,
    commune: {
      sismicite: sismique ? sismique.zone_sismicite : null,
      radon: radonCommune ? Number(radonCommune.classe_potentiel) || null : null,
      catnat: catnat && Number.isFinite(catnat.results) ? catnat.results : null,
    },
  };
}

const repondre = (corps, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: ENTETES });

async function lireJson(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'mairie-juvinas-risques/1.0 (site municipal)' } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function gererDemandeRisquesAdresse(request) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 200);
  if (q.length < 3) return repondre({ trouve: false, message: 'Indiquez une adresse à Juvinas.' }, 400);

  const geo = await lireJson(`${URL_GEOCODAGE}?${new URLSearchParams({ q, citycode: CODE_INSEE, limit: '1' })}`);
  if (!geo) return repondre({ trouve: false, message: 'Le service de recherche d\'adresse ne répond pas. Réessayez dans un moment.' }, 502);
  const f = (geo.features || [])[0];
  if (!f || f.properties.citycode !== CODE_INSEE || !(f.properties.score >= SCORE_MINIMAL)) {
    return repondre({ trouve: false, message: 'Adresse introuvable à Juvinas. Vérifiez le numéro et le nom de la voie.' });
  }

  const [lon, lat] = f.geometry.coordinates;
  const point = encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }));
  const [prescriptions, zonesUrba, servitudes, argiles, sismicite, radon, catnat] = await Promise.all([
    lireJson(`${URL_GPU}/prescription-surf?geom=${point}`),
    lireJson(`${URL_GPU}/zone-urba?geom=${point}`),
    lireJson(`${URL_GPU}/assiette-sup-s?geom=${point}&categorie=PM1`),
    lireJson(`${URL_GEORISQUES}/rga?latlon=${lon},${lat}`),
    lireJson(`${URL_GEORISQUES}/zonage_sismique?code_insee=${CODE_INSEE}`),
    lireJson(`${URL_GEORISQUES}/radon?code_insee=${CODE_INSEE}`),
    lireJson(`${URL_GEORISQUES}/gaspar/catnat?code_insee=${CODE_INSEE}&page_size=1`),
  ]);

  return repondre({
    trouve: true,
    ...resumerRisquesAdresse({ adresse: f.properties.label, prescriptions, zonesUrba, servitudes, argiles, sismicite, radon, catnat }),
  });
}
