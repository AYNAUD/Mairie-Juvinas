/* =====================================================================
   Worker « données en direct » du site de la mairie de Juvinas.

   Public, sans authentification, sans secret, sans base de données : il
   interroge des API ouvertes de l'État pour le compte du site (le
   navigateur du visiteur n'appelle jamais un service tiers) et met les
   réponses en cache. Voir worker/README.md.

   Routes (mêmes noms que celles du moteur partagé avec Lecques, que les
   scripts de src/scripts/ interrogent) :
     GET /situation          vigilance météo + rivières, bandeau de l'accueil
     GET /meteo/vigilance    vigilance météo seule
     GET /vidourle           hauteur des rivières voisines (page Risques)
     GET /eau/restrictions   restrictions d'eau en vigueur (VigiEau)
     GET /eau/qualite        contrôle sanitaire de l'eau du robinet (ARS)
     GET /risques/adresse    « Ma maison face aux risques »
     POST /abonnement, /desabonnement, /consultation/<id>/voter
                             page « Service en cours de préparation » (rien n'est enregistré)

   Pas portés de Lecques : l'administration par email, les abonnements et
   le vote en ligne (voir CLAUDE.md, « Ce qui n'est pas porté »).
   ===================================================================== */
import {
  gererDemandeRivieres,
  gererDemandeRestrictionsEau,
  gererDemandeQualiteEau,
  gererDemandeVigilanceMeteo,
  gererDemandeSituation,
} from './donnees-publiques.mjs';
import { gererDemandeRisquesAdresse } from './risques-adresse.mjs';
import { pageServiceEnPreparation, DETAIL_VOTE } from './service-en-preparation.mjs';

const ENTETES_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ROUTES = {
  '/situation': gererDemandeSituation,
  '/meteo/vigilance': gererDemandeVigilanceMeteo,
  '/vidourle': gererDemandeRivieres,
  '/eau/restrictions': gererDemandeRestrictionsEau,
  '/eau/qualite': gererDemandeQualiteEau,
  '/risques/adresse': (request) => gererDemandeRisquesAdresse(request),
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: ENTETES_CORS });
    const { pathname } = new URL(request.url);
    if (request.method === 'POST' && (pathname === '/abonnement' || pathname === '/desabonnement')) {
      return pageServiceEnPreparation(request);
    }
    if (request.method === 'POST' && /^\/consultation\/[^/]+\/voter$/.test(pathname)) {
      return pageServiceEnPreparation(request, DETAIL_VOTE);
    }
    const gerer = ROUTES[pathname];
    if (!gerer || request.method !== 'GET') {
      return new Response('Introuvable', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return gerer(request, ctx);
  },
};
