/* =====================================================================
   Données publiques en direct pour le site statique de Juvinas : hauteur
   des rivières voisines, restrictions d'eau, qualité de l'eau du robinet
   et vigilance météo de l'Ardèche.

   Le navigateur du visiteur n'appelle jamais lui-même un service tiers
   (voir CLAUDE.md, « zéro requête tierce ») : c'est ce Worker qui
   interroge l'API publique pour son compte, met la réponse en cache et
   sert un petit JSON aux scripts src/scripts/*.js. Toutes les sources
   sont ouvertes, sans clé ni compte : rien à renouveler.
   - Hub'Eau Hydrométrie (hubeau.eaufrance.fr) : hauteurs d'eau du réseau
     Vigicrues. Aucune station ne mesure la Bézorgues elle-même : on suit
     la Volane (dans laquelle elle se jette) et l'Ardèche en aval.
   - VigiEau (api.vigieau.gouv.fr) : restrictions sécheresse par code Insee.
   - MeteoAlarm : le flux des services météo européens, alimenté par les
     bulletins de vigilance de Météo-France (mêmes niveaux, mêmes
     phénomènes), ouvert et sans clé. Ardèche = zone NUTS 3 FR712.
   - Hub'Eau Qualité de l'eau potable : le contrôle sanitaire de l'ARS,
     par commune et par réseau de distribution.

   Adapté du Worker de Lecques (même principe, mêmes fonctions pures) ;
   seuls changent la commune, la zone de vigilance et les stations.
   ===================================================================== */

// Les rivières les plus proches qui ont une station Vigicrues en service
// (vérifié sur Hub'Eau le 28 octobre 2026). Liste fixe côté serveur : la
// route n'accepte aucun code de station venu de l'appelant, pour ne pas
// servir de relais ouvert vers Hub'Eau. Doit rester cohérente avec
// content/site.json → riviere.stations.
export const STATIONS_RIVIERES = [
  { code: 'V501521001', nom: 'Vals-les-Bains', riviere: 'La Volane', position: 'La Volane, dans laquelle se jette la Bézorgues' },
  { code: 'V501403001', nom: 'Ucel', riviere: "L'Ardèche", position: "L'Ardèche, en aval de la Volane" },
];
const URL_HUBEAU = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr';

const CODE_INSEE = '07111';

const URL_QUALITE_EAU = 'https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable/resultats_dis';
// Paramètres suivis sur les réseaux qui alimentent la commune (codes SANDRE) :
// E. coli, présent dans chaque contrôle bactériologique (sert à les compter),
// nitrates, dureté (titre hydrotimétrique, sous deux codes selon l'époque).
const CODES_ECOLI = ['1449'];
const CODES_NITRATES = ['1340'];
const CODES_DURETE = ['1345', '7972'];

// L'Ardèche dans le flux MeteoAlarm : zones désignées par leur code NUTS 3.
const ZONE_ARDECHE = 'FR712';
const URL_METEOALARM = 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-france';
export const URL_VIGILANCE = 'https://vigilance.meteofrance.fr/fr/ardeche';

// Une hausse d'au moins 1 m en 3 heures déclenche la mention « monte vite » :
// à l'étiage la mesure varie de quelques centimètres ; un tel écart ne
// s'observe qu'au début d'une crue. Aucune hauteur absolue n'est retenue :
// les seuils de vigilance des stations ne sont pas publiés, et en inventer
// un ferait passer une valeur maison pour une cote officielle.
export const SEUIL_MONTEE_M = 1;
const URL_VIGIEAU = 'https://api.vigieau.gouv.fr/api/zones';

// Les mesures arrivent au mieux toutes les 5 minutes : un cache de 10
// minutes ne fait rien perdre d'utile. Les restrictions d'eau changent au
// plus une fois par jour (nouvel arrêté) : 3 heures suffisent largement.
const CACHE_RIVIERES_S = 600;
const CACHE_RESTRICTIONS_S = 3 * 3600;
// Météo-France publie à 6 h et 16 h, et à tout moment quand la situation
// s'aggrave : 10 minutes de retard au plus.
const CACHE_VIGILANCE_S = 600;
const CACHE_SITUATION_S = 600;
// Un contrôle par mois au plus sur les réseaux, publié avec retard : la
// demi-journée suffit largement.
const CACHE_QUALITE_EAU_S = 12 * 3600;

// En dessous de 5 cm de variation sur 3 heures, on parle de niveau stable :
// le bruit de mesure d'une station à l'étiage est de cet ordre.
const SEUIL_TENDANCE_M = 0.05;
// Une courbe de 24 h n'a pas besoin de plus d'un point par quart d'heure.
const PAS_SERIE_MS = 15 * 60 * 1000;

const ENTETES_JSON = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
};

const arrondiCm = (m) => Math.round(m * 100) / 100;

/** Transforme la réponse brute de Hub'Eau (hauteurs en millimètres, tri
 *  quelconque, toutes stations mélangées) en un résumé par station, en
 *  mètres. Fonction pure. */
export function resumerObservations(observations, stations = STATIONS_RIVIERES) {
  return stations.map((station) => {
    const points = observations
      .filter((o) => o.code_station === station.code && Number.isFinite(o.resultat_obs))
      .map((o) => ({ t: Date.parse(o.date_obs), h: o.resultat_obs / 1000 }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);

    if (!points.length) return { ...station, disponible: false };

    const dernier = points[points.length - 1];
    // Point de comparaison : la mesure la plus proche d'il y a 3 heures.
    const cible = dernier.t - 3 * 3600 * 1000;
    const reference = points.reduce((meilleur, p) => (Math.abs(p.t - cible) < Math.abs(meilleur.t - cible) ? p : meilleur), points[0]);
    const variation3h = dernier.h - reference.h;
    const tendance = Math.abs(variation3h) < SEUIL_TENDANCE_M ? 'stable' : (variation3h > 0 ? 'hausse' : 'baisse');

    const serie = [];
    let prochain = -Infinity;
    for (const p of points) {
      if (p.t >= prochain) { serie.push([p.t, arrondiCm(p.h)]); prochain = p.t + PAS_SERIE_MS; }
    }
    if (serie[serie.length - 1][0] !== dernier.t) serie.push([dernier.t, arrondiCm(dernier.h)]);

    const hauteurs = points.map((p) => p.h);
    return {
      ...station,
      disponible: true,
      hauteur: arrondiCm(dernier.h),
      date: new Date(dernier.t).toISOString(),
      variation3h: arrondiCm(variation3h),
      tendance,
      min24h: arrondiCm(Math.min(...hauteurs)),
      max24h: arrondiCm(Math.max(...hauteurs)),
      serie,
    };
  });
}

const LIBELLES_GRAVITE = {
  vigilance: 'Vigilance',
  alerte: 'Alerte',
  alerte_renforcee: 'Alerte renforcée',
  crise: 'Crise',
};
const ORDRE_GRAVITE = ['vigilance', 'alerte', 'alerte_renforcee', 'crise'];

/** Résume la réponse de VigiEau pour l'eau du robinet (zone AEP) d'un
 *  particulier : niveau le plus grave en vigueur, usages concernés, arrêté.
 *  Tableau vide = aucune restriction. Fonction pure. */
export function resumerRestrictions(zones) {
  const valides = (Array.isArray(zones) ? zones : []).filter((z) => ORDRE_GRAVITE.includes(z.niveauGravite));
  if (!valides.length) return { niveau: null, libelleNiveau: null, usages: [], arrete: null };

  const zone = valides.reduce((pire, z) => (ORDRE_GRAVITE.indexOf(z.niveauGravite) > ORDRE_GRAVITE.indexOf(pire.niveauGravite) ? z : pire));
  const arrete = zone.arrete || {};
  const date = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null);
  const url = typeof arrete.cheminFichier === 'string' && arrete.cheminFichier.startsWith('https://') ? arrete.cheminFichier : null;

  return {
    niveau: zone.niveauGravite,
    libelleNiveau: LIBELLES_GRAVITE[zone.niveauGravite],
    zone: zone.nom || null,
    arrete: { debut: date(arrete.dateDebutValidite), fin: date(arrete.dateFinValidite), url },
    usages: (zone.usages || [])
      .filter((u) => u.concerneParticulier !== false)
      .map((u) => ({
        thematique: String(u.thematique || 'Autres usages'),
        nom: String(u.nom || ''),
        description: String(u.description || '').replace(/\r\n?/g, '\n').trim(),
      })),
  };
}

const COULEURS_VIGILANCE = { 1: 'verte', 2: 'jaune', 3: 'orange', 4: 'rouge' };

/** Vigilance météo en cours dans une zone, d'après les avertissements CAP
 *  du flux MeteoAlarm. Chaque bulletin de Météo-France y produit, par
 *  phénomène, un message « Alert » (niveau et période de validité) et un
 *  message « Update » de durée nulle qui clôt la période précédente ; le
 *  flux contient aussi la vigilance du lendemain. On ne garde donc, par
 *  phénomène, que le message en vigueur à l'instant "maintenant" (le plus
 *  récent s'il y en a plusieurs). Fonction pure. */
export function resumerVigilance(avertissements, maintenant = new Date(), zone = ZONE_ARDECHE) {
  const instant = maintenant.getTime();
  const parPhenomene = new Map();
  for (const { alert } of Array.isArray(avertissements) ? avertissements : []) {
    if (!alert || alert.status !== 'Actual' || alert.msgType === 'Cancel') continue;
    const infos = alert.info || [];
    const info = infos.find((i) => i.language === 'fr-FR') || infos[0];
    if (!info || !(info.area || []).some((a) => (a.geocode || []).some((g) => g.value === zone))) continue;

    const debut = Date.parse(info.onset || info.effective);
    const fin = Date.parse(info.expires);
    if (!(debut <= instant && instant < fin)) continue;

    const parametre = (nom) => ((info.parameter || []).find((p) => p.valueName === nom) || {}).value || '';
    const niveau = Number.parseInt(parametre('awareness_level'), 10);
    if (!COULEURS_VIGILANCE[niveau]) continue;
    // « Vigilance rouge pluie-inondation » → « pluie-inondation »
    const nom = String(info.event || '').replace(/^vigilance\s+\S+\s+/i, '').trim() || 'phénomène non précisé';
    const cle = parametre('awareness_type') || nom;
    const envoi = Date.parse(alert.sent) || 0;
    const precedent = parPhenomene.get(cle);
    if (!precedent || envoi > precedent.envoi) {
      parPhenomene.set(cle, {
        envoi, nom, niveau, couleur: COULEURS_VIGILANCE[niveau], fin: new Date(fin).toISOString(),
        // Consignes officielles de Météo-France pour ce niveau.
        consignes: String(info.instruction || '').trim() || null,
      });
    }
  }

  const phenomenes = [...parPhenomene.values()]
    .filter((p) => p.niveau >= 2)
    .sort((a, b) => b.niveau - a.niveau || a.nom.localeCompare(b.nom, 'fr'))
    .map(({ envoi, ...p }) => p);
  const niveau = phenomenes.length ? phenomenes[0].niveau : 1;
  return { niveau, couleur: COULEURS_VIGILANCE[niveau], phenomenes, source: URL_VIGILANCE };
}

// La valeur respecte-t-elle une référence de qualité telle que l'ARS
// l'écrit (« <=25 °C », « >=6,5 et <=9 unité pH ») ? Une référence
// illisible est tenue pour respectée : on ne signale que l'écart certain.
function respecteReference(valeur, reference) {
  if (!Number.isFinite(valeur)) return true;
  const bornes = [...String(reference || '').matchAll(/([<>]=?)\s*(-?\d+(?:,\d+)?)/g)];
  return bornes.every(([, op, nombre]) => {
    const x = Number(nombre.replace(',', '.'));
    if (op === '<=') return valeur <= x;
    if (op === '<') return valeur < x;
    if (op === '>=') return valeur >= x;
    return valeur > x;
  });
}

const nonConforme = (r, ...champs) => champs.some((c) => r[c] === 'N');
const plusRecent = (a, b) => String(b.date_prelevement).localeCompare(String(a.date_prelevement));

/** Contrôle sanitaire de l'eau du robinet : dernier prélèvement fait dans
 *  la commune, et bilan sur 12 mois des réseaux qui l'alimentent. Fonction
 *  pure. */
export function resumerQualiteEau(lignesCommune, lignesReseaux) {
  const triees = [...(lignesCommune || [])].sort(plusRecent);
  const dernier = triees.filter((r) => triees.length && r.code_prelevement === triees[0].code_prelevement);
  let commune = null;
  if (dernier.length) {
    const r = dernier[0];
    commune = {
      date: String(r.date_prelevement).slice(0, 10),
      conclusion: String(r.conclusion_conformite_prelevement || '').trim() || null,
      conformeLimites: !nonConforme(r, 'conformite_limites_bact_prelevement', 'conformite_limites_pc_prelevement'),
      conformeReferences: !nonConforme(r, 'conformite_references_bact_prelevement', 'conformite_references_pc_prelevement'),
      ecarts: dernier
        .filter((x) => x.reference_qualite_parametre && !respecteReference(x.resultat_numerique, x.reference_qualite_parametre))
        .map((x) => ({
          parametre: x.libelle_parametre_web || x.libelle_parametre,
          valeur: x.resultat_alphanumerique,
          unite: x.libelle_unite,
          reference: x.reference_qualite_parametre,
        })),
      reseaux: (r.reseaux || []).map((x) => x.nom).filter(Boolean),
    };
  }

  const lignes = lignesReseaux || [];
  const prelevements = new Map();
  for (const x of lignes) if (CODES_ECOLI.includes(String(x.code_parametre))) prelevements.set(x.code_prelevement, x);
  const controles = [...prelevements.values()].sort(plusRecent);
  const derniereMesure = (codes) => {
    const x = lignes.filter((l) => codes.includes(String(l.code_parametre)) && Number.isFinite(l.resultat_numerique)).sort(plusRecent)[0];
    return x ? { valeur: x.resultat_numerique, unite: x.libelle_unite, date: String(x.date_prelevement).slice(0, 10), lieu: x.nom_commune } : null;
  };

  return {
    commune,
    reseaux: {
      controles: controles.length,
      conformes: controles.filter((x) => !nonConforme(x, 'conformite_limites_bact_prelevement', 'conformite_limites_pc_prelevement')).length,
      dernier: controles.length ? String(controles[0].date_prelevement).slice(0, 10) : null,
    },
    nitrates: derniereMesure(CODES_NITRATES),
    durete: derniereMesure(CODES_DURETE),
  };
}

const metres = (h) => `${h.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

/** Phrases de la situation, du plus grave au moins grave : celles que le
 *  bandeau de l'accueil (src/scripts/situation.js) affiche telles quelles. */
export function phrasesSituation({ meteo, rivieres }) {
  const phrases = [];
  if (meteo) {
    const parCouleur = [];
    for (const p of meteo.phenomenes) {
      let groupe = parCouleur.find((g) => g.couleur === p.couleur);
      if (!groupe) parCouleur.push((groupe = { couleur: p.couleur, noms: [] }));
      groupe.noms.push(p.nom);
    }
    phrases.push(`Météo-France place l'Ardèche en vigilance ${parCouleur.map((g) => `${g.couleur} (${g.noms.join(', ')})`).join(' et ')}.`);
  }
  if (rivieres.alerte) {
    for (const st of rivieres.stations.filter((x) => rivieres.montees.includes(x.code))) {
      phrases.push(`${st.riviere} monte vite à ${st.nom} : +${metres(st.variation3h)} en 3 heures (${metres(st.hauteur)}).`);
    }
  } else if (rivieres.stations.length) {
    // Sans montée rapide, on donne les hauteurs et leur tendance, sans les
    // qualifier : aucun seuil officiel n'est publié pour ces stations.
    const TENDANCES = { hausse: 'en hausse', baisse: 'en baisse', stable: 'stable' };
    phrases.push(`Rivières voisines : ${rivieres.stations.map((st) => `${metres(st.hauteur)} à ${st.nom} (${st.riviere}${TENDANCES[st.tendance] ? `, ${TENDANCES[st.tendance]}` : ''})`).join(', ')}.`);
  }
  return phrases;
}

/** Ce que le bandeau de l'accueil doit dire. niveau 0 : rien à signaler ;
 *  3 : orange ; 4 : rouge. La montée des rivières seule ne dépasse jamais
 *  l'orange : le rouge reste une décision de Météo-France. "sources" dit ce
 *  qui a répondu, pour ne pas prendre une panne pour un retour au calme.
 *  Fonction pure. */
export function resumerSituation({ vigilance, rivieres }) {
  const meteoDisponible = !!(vigilance && vigilance.disponible);
  const meteo = meteoDisponible && vigilance.niveau >= 3
    ? { niveau: vigilance.niveau, couleur: vigilance.couleur, phenomenes: vigilance.phenomenes.filter((p) => p.niveau >= 3) }
    : null;

  const stations = rivieres && rivieres.disponible ? rivieres.stations.filter((st) => st.disponible) : [];
  const montees = stations.filter((st) => st.variation3h >= SEUIL_MONTEE_M);
  const alerteRivieres = montees.length > 0;

  const niveau = Math.max(meteo ? meteo.niveau : 0, alerteRivieres ? 3 : 0);
  const situation = {
    niveau,
    couleur: COULEURS_VIGILANCE[niveau] || null,
    meteo,
    rivieres: {
      alerte: alerteRivieres,
      montees: montees.map((st) => st.code),
      stations: stations.map(({ code, nom, riviere, hauteur, variation3h, tendance, date }) => ({ code, nom, riviere, hauteur, variation3h, tendance, date })),
    },
    sources: { meteo: meteoDisponible, rivieres: stations.length > 0 },
  };
  situation.phrases = niveau >= 3 ? phrasesSituation(situation) : [];
  return situation;
}

async function reponseEnCache(request, ctx, chemin, dureeS, produire) {
  const cache = caches.default;
  const cleCache = new Request(new URL(chemin, request.url).toString(), { method: 'GET' });
  const enCache = await cache.match(cleCache);
  if (enCache) return enCache;

  const corps = await produire();
  const reponse = new Response(JSON.stringify(corps), {
    headers: { ...ENTETES_JSON, 'Cache-Control': `public, max-age=${dureeS}` },
  });
  // Une source indisponible ne doit pas figer l'erreur pour toute la durée
  // du cache : on ne garde que les réponses complètes.
  if (corps.disponible) ctx.waitUntil(cache.put(cleCache, reponse.clone()));
  return reponse;
}

async function lireRivieres(maintenant) {
  const debut = new Date(maintenant.getTime() - 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    code_entite: STATIONS_RIVIERES.map((s) => s.code).join(','),
    grandeur_hydro: 'H',
    date_debut_obs: debut,
    size: '1000',
    fields: 'code_station,date_obs,resultat_obs',
  });
  try {
    const r = await fetch(`${URL_HUBEAU}?${params}`, {
      headers: { 'User-Agent': 'mairie-juvinas-rivieres/1.0 (site municipal, cache 10 min)' },
    });
    if (!r.ok) throw new Error(`${r.status} sur Hub'Eau`);
    const { data } = await r.json();
    const stations = resumerObservations(data || []);
    return { misAJour: maintenant.toISOString(), disponible: stations.some((s) => s.disponible), stations };
  } catch (e) {
    return { misAJour: maintenant.toISOString(), disponible: false, erreur: e.message, stations: [] };
  }
}

// Route /vidourle : nom hérité du moteur partagé avec Lecques, que le script
// du site (src/scripts/vidourle.js) interroge ; elle sert ici les rivières de
// Juvinas (voir STATIONS_RIVIERES).
export function gererDemandeRivieres(request, ctx) {
  return reponseEnCache(request, ctx, '/vidourle', CACHE_RIVIERES_S, () => lireRivieres(new Date()));
}

export function gererDemandeRestrictionsEau(request, ctx) {
  return reponseEnCache(request, ctx, '/eau/restrictions', CACHE_RESTRICTIONS_S, async () => {
    const maintenant = new Date();
    const params = new URLSearchParams({ commune: CODE_INSEE, profil: 'particulier', zoneType: 'AEP' });
    try {
      const r = await fetch(`${URL_VIGIEAU}?${params}`, {
        headers: { 'User-Agent': 'mairie-juvinas-secheresse/1.0 (site municipal, cache 3 h)' },
      });
      if (!r.ok) throw new Error(`${r.status} sur VigiEau`);
      return { misAJour: maintenant.toISOString(), disponible: true, ...resumerRestrictions(await r.json()) };
    } catch (e) {
      return { misAJour: maintenant.toISOString(), disponible: false, erreur: e.message };
    }
  });
}

async function lireVigilance(maintenant) {
  try {
    const r = await fetch(URL_METEOALARM, {
      headers: { 'User-Agent': 'mairie-juvinas-vigilance/1.0 (site municipal, cache 10 min)' },
    });
    if (!r.ok) throw new Error(`${r.status} sur MeteoAlarm`);
    const { warnings } = await r.json();
    return { misAJour: maintenant.toISOString(), disponible: true, ...resumerVigilance(warnings, maintenant) };
  } catch (e) {
    return { misAJour: maintenant.toISOString(), disponible: false, erreur: e.message };
  }
}

export function gererDemandeVigilanceMeteo(request, ctx) {
  return reponseEnCache(request, ctx, '/meteo/vigilance', CACHE_VIGILANCE_S, () => lireVigilance(new Date()));
}

async function lireQualiteEau(maintenant) {
  const entetes = { headers: { 'User-Agent': 'mairie-juvinas-qualite-eau/1.0 (site municipal, cache 12 h)' } };
  try {
    const parCommune = new URLSearchParams({
      code_commune: CODE_INSEE,
      sort: 'desc',
      size: '150',
      fields: 'code_prelevement,date_prelevement,conclusion_conformite_prelevement,conformite_limites_bact_prelevement,conformite_limites_pc_prelevement,conformite_references_bact_prelevement,conformite_references_pc_prelevement,libelle_parametre,libelle_parametre_web,resultat_numerique,resultat_alphanumerique,libelle_unite,reference_qualite_parametre,reseaux',
    });
    const r1 = await fetch(`${URL_QUALITE_EAU}?${parCommune}`, entetes);
    if (!r1.ok) throw new Error(`${r1.status} sur Hub'Eau`);
    const { data: lignesCommune } = await r1.json();

    // Les réseaux sont ceux du dernier prélèvement dans la commune : si elle
    // change d'alimentation, le bilan suit sans rien modifier ici.
    const codesReseaux = [...new Set(((lignesCommune[0] && lignesCommune[0].reseaux) || []).map((x) => x.code).filter(Boolean))];
    let lignesReseaux = [];
    if (codesReseaux.length) {
      const parReseau = new URLSearchParams({
        code_reseau: codesReseaux.join(','),
        code_parametre: [...CODES_ECOLI, ...CODES_NITRATES, ...CODES_DURETE].join(','),
        date_min_prelevement: new Date(maintenant.getTime() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        size: '500',
        fields: 'code_prelevement,date_prelevement,code_parametre,resultat_numerique,libelle_unite,nom_commune,conformite_limites_bact_prelevement,conformite_limites_pc_prelevement',
      });
      const r2 = await fetch(`${URL_QUALITE_EAU}?${parReseau}`, entetes);
      if (!r2.ok) throw new Error(`${r2.status} sur Hub'Eau (réseaux)`);
      lignesReseaux = (await r2.json()).data || [];
    }
    const resume = resumerQualiteEau(lignesCommune, lignesReseaux);
    return { misAJour: maintenant.toISOString(), disponible: !!resume.commune, ...resume };
  } catch (e) {
    return { misAJour: maintenant.toISOString(), disponible: false, erreur: e.message };
  }
}

export function gererDemandeQualiteEau(request, ctx) {
  return reponseEnCache(request, ctx, '/eau/qualite', CACHE_QUALITE_EAU_S, () => lireQualiteEau(new Date()));
}

/** Vigilance et rivières, lues en parallèle : le bandeau de l'accueil. */
export async function lireSituation(maintenant = new Date()) {
  const [vigilance, rivieres] = await Promise.all([lireVigilance(maintenant), lireRivieres(maintenant)]);
  const situation = resumerSituation({ vigilance, rivieres });
  return { misAJour: maintenant.toISOString(), disponible: situation.sources.meteo || situation.sources.rivieres, ...situation };
}

export function gererDemandeSituation(request, ctx) {
  return reponseEnCache(request, ctx, '/situation', CACHE_SITUATION_S, () => lireSituation(new Date()));
}
