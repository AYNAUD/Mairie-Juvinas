/* =====================================================================
   Récupération de l'annuaire officiel des activités économiques de
   Juvinas (source : recherche-entreprises.api.gouv.fr, données Sirene de
   l'Insee, réutilisation libre, sans clé). Liste distincte de l'annuaire
   manuel des professionnels (content/annuaire.json → professionnels) :
   celui-ci contient téléphone/email saisis par la mairie, que l'API
   Sirene n'expose pas ; celle-ci est générée automatiquement et fait foi
   pour l'exhaustivité, pas pour les coordonnées.
   Relancé automatiquement chaque nuit par .github/workflows/entreprises.yml
   (qui committe content/entreprises.json s'il a changé) — un lancement
   manuel reste possible à tout moment via "npm run entreprises".
   ===================================================================== */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE_COMMUNE = '07111'; // code Insee de Juvinas (07600 est le code postal)
const BASE = 'https://recherche-entreprises.api.gouv.fr/search';
const PAGE_MAX = 60; // filet de sécurité (~1500 résultats), très au-dessus du volume attendu pour une commune de 187 habitants

// Table officielle des 88 divisions de la nomenclature NAF rév. 2 (Insee),
// récupérée sur data.gouv.fr (jeu "Codes et libellés NAF niveau 2").
// Sert à afficher un intitulé en clair (ex. "68.20B" → division "68" →
// "Activités immobilières") plutôt que le seul code NAF, illisible pour un
// habitant. Stable dans le temps (dernière révision : 2008) — pas besoin de
// la régénérer à chaque exécution du script.
const DIVISIONS_NAF = {
  '01': 'Culture et production animale, chasse et services annexes',
  '02': 'Sylviculture et exploitation forestière',
  '03': 'Pêche et aquaculture',
  '05': 'Extraction de houille et de lignite',
  '06': "Extraction d'hydrocarbures",
  '07': 'Extraction de minerais métalliques',
  '08': 'Autres industries extractives',
  '09': 'Services de soutien aux industries extractives',
  '10': 'Industries alimentaires',
  '11': 'Fabrication de boissons',
  '12': 'Fabrication de produits à base de tabac',
  '13': 'Fabrication de textiles',
  '14': "Industrie de l'habillement",
  '15': 'Industrie du cuir et de la chaussure',
  '16': "Travail du bois et fabrication d'articles en bois et en liège, à l'exception des meubles",
  '17': 'Industrie du papier et du carton',
  '18': "Imprimerie et reproduction d'enregistrements",
  '19': 'Cokéfaction et raffinage',
  '20': 'Industrie chimique',
  '21': 'Industrie pharmaceutique',
  '22': 'Fabrication de produits en caoutchouc et en plastique',
  '23': "Fabrication d'autres produits minéraux non métalliques",
  '24': 'Métallurgie',
  '25': 'Fabrication de produits métalliques, à l’exception des machines et des équipements',
  '26': 'Fabrication de produits informatiques, électroniques et optiques',
  '27': "Fabrication d'équipements électriques",
  '28': 'Fabrication de machines et équipements n.c.a.',
  '29': 'Industrie automobile',
  '30': "Fabrication d'autres matériels de transport",
  '31': 'Fabrication de meubles',
  '32': 'Autres industries manufacturières',
  '33': "Réparation et installation de machines et d'équipements",
  '35': "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné",
  '36': "Captage, traitement et distribution d'eau",
  '37': 'Collecte et traitement des eaux usées',
  '38': 'Collecte, traitement et élimination des déchets ; récupération',
  '39': 'Dépollution et autres services de gestion des déchets',
  '41': 'Construction de bâtiments',
  '42': 'Génie civil',
  '43': 'Travaux de construction spécialisés',
  '45': "Commerce et réparation d'automobiles et de motocycles",
  '46': 'Commerce de gros, à l’exception des automobiles et des motocycles',
  '47': 'Commerce de détail, à l’exception des automobiles et des motocycles',
  '49': 'Transports terrestres et transport par conduites',
  '50': "Transports par eau",
  '51': 'Transports aériens',
  '52': 'Entreposage et services auxiliaires des transports',
  '53': 'Activités de poste et de courrier',
  '55': 'Hébergement',
  '56': 'Restauration',
  '58': 'Édition',
  '59': 'Production de films cinématographiques, de vidéo et de programmes de télévision ; enregistrement sonore et édition musicale',
  '60': 'Programmation et diffusion',
  '61': 'Télécommunications',
  '62': 'Programmation, conseil et autres activités informatiques',
  '63': "Services d'information",
  '64': 'Activités des services financiers, hors assurance et caisses de retraite',
  '65': 'Assurance',
  '66': "Activités auxiliaires de services financiers et d'assurance",
  '68': 'Activités immobilières',
  '69': 'Activités juridiques et comptables',
  '70': 'Activités des sièges sociaux ; conseil de gestion',
  '71': "Activités d'architecture et d'ingénierie ; activités de contrôle et analyses techniques",
  '72': 'Recherche-développement scientifique',
  '73': 'Publicité et études de marché',
  '74': 'Autres activités spécialisées, scientifiques et techniques',
  '75': 'Activités vétérinaires',
  '77': 'Activités de location et location-bail',
  '78': "Activités liées à l'emploi",
  '79': 'Activités des agences de voyage, voyagistes, services de réservation et activités connexes',
  '80': 'Enquêtes et sécurité',
  '81': 'Services relatifs aux bâtiments et aménagement paysager',
  '82': 'Activités administratives et autres activités de soutien aux entreprises',
  '84': 'Administration publique et défense ; sécurité sociale obligatoire',
  '85': 'Enseignement',
  '86': 'Activités pour la santé humaine',
  '87': 'Hébergement médico-social et social',
  '88': 'Action sociale sans hébergement',
  '90': 'Activités créatives, artistiques et de spectacle',
  '91': 'Bibliothèques, archives, musées et autres activités culturelles',
  '92': 'Organisation de jeux de hasard et d’argent',
  '93': 'Activités sportives, récréatives et de loisirs',
  '94': 'Activités des organisations associatives',
  '95': "Réparation d'ordinateurs et de biens personnels et domestiques",
  '96': 'Autres services personnels',
  '97': 'Activités des ménages en tant qu’employeurs de personnel domestique',
  '98': 'Activités indifférenciées des ménages en tant que producteurs de biens et services pour usage propre',
  '99': 'Activités des organisations et organismes extraterritoriaux'
};

// Regroupement des 88 divisions en 21 sections (A-U), structure stable de
// la nomenclature NAF rév. 2 — sert uniquement à choisir un pictogramme
// cohérent, pas affiché tel quel.
function sectionDeDivision(div) {
  const n = Number(div);
  if (n >= 1 && n <= 3) return 'A';
  if (n >= 5 && n <= 9) return 'B';
  if (n >= 10 && n <= 33) return 'C';
  if (n === 35) return 'D';
  if (n >= 36 && n <= 39) return 'E';
  if (n >= 41 && n <= 43) return 'F';
  if (n >= 45 && n <= 47) return 'G';
  if (n >= 49 && n <= 53) return 'H';
  if (n >= 55 && n <= 56) return 'I';
  if (n >= 58 && n <= 63) return 'J';
  if (n >= 64 && n <= 66) return 'K';
  if (n === 68) return 'L';
  if (n >= 69 && n <= 75) return 'M';
  if (n >= 77 && n <= 82) return 'N';
  if (n === 84) return 'O';
  if (n === 85) return 'P';
  if (n >= 86 && n <= 88) return 'Q';
  if (n >= 90 && n <= 93) return 'R';
  if (n >= 94 && n <= 96) return 'S';
  if (n >= 97 && n <= 98) return 'T';
  if (n === 99) return 'U';
  return null;
}

// Une icône par section — parmi le jeu existant (src/templates/icons.mjs)
// quand une correspondance raisonnable existe, "document" (générique) sinon
// plutôt que d'inventer une icône dédiée pour des sections rares ici.
const ICONE_PAR_SECTION = {
  A: 'vegetal', B: 'document', C: 'travaux', D: 'feu', E: 'encombrant',
  F: 'travaux', G: 'commerce', H: 'voiture', I: 'salle', J: 'telephone',
  K: 'document', L: 'terrain', M: 'badge', N: 'badge', O: 'mairie',
  P: 'ecole', Q: 'document', R: 'loisirs', S: 'document', T: 'document',
  U: 'document'
};

function infosActivite(codeNaf) {
  const division = String(codeNaf || '').slice(0, 2);
  const libelle = DIVISIONS_NAF[division] || null;
  const section = sectionDeDivision(division);
  const icone = (section && ICONE_PAR_SECTION[section]) || 'document';
  return { libelle, icone };
}

async function recupererPage(page) {
  const url = `${BASE}?code_commune=${CODE_COMMUNE}&etat_administratif=A&per_page=25&page=${page}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} sur ${url}`);
  return r.json();
}

console.log('\nAnnuaire des activités économiques (Sirene)');
const entreprises = [];
let ignorees = 0;
let sciExclues = 0;
let page = 1;
let totalPages = null;

while (page <= PAGE_MAX) {
  const donnees = await recupererPage(page);
  if (totalPages === null) totalPages = donnees.total_pages || null;
  const resultats = donnees.results || [];
  if (resultats.length === 0) break;

  for (const entreprise of resultats) {
    // La commune elle-même (la mairie) ressort comme personne morale de
    // droit public : hors-sujet dans un annuaire de commerces, artisans,
    // professions libérales et associations.
    if (entreprise.complements && entreprise.complements.collectivite_territoriale) continue;

    // Les SCI (sociétés civiles immobilières) sont des structures de
    // détention patrimoniale, pas des activités économiques visibles pour
    // un habitant — systématiquement exclues. Détection par le nom plutôt
    // que par nature_juridique : le code "6540" (société civile) est trop
    // large, il couvre aussi d'autres formes que les SCI.
    if (/^SCI\b/i.test(entreprise.nom_complet || '')) { sciExclues++; continue; }

    for (const etab of entreprise.matching_etablissements || []) {
      // Le siège (ou l'état administratif global de l'entreprise) peut être
      // trompeur — un siège peut être dans un tout autre département. On ne
      // se fie qu'à l'établissement effectivement remonté par la recherche.
      if (etab.etat_administratif !== 'A') continue;
      if (etab.commune !== CODE_COMMUNE) continue;
      if (!etab.adresse) { ignorees++; continue; } // adresse non diffusée publiquement : impossible à afficher correctement

      const enseigne = etab.nom_commercial || (etab.liste_enseignes && etab.liste_enseignes[0]) || null;
      const association = !!(entreprise.complements && entreprise.complements.est_association);
      const { libelle: nafLibelle, icone } = infosActivite(etab.activite_principale);
      // L'API Sirene localise directement une partie des établissements :
      // les autres n'ont qu'une adresse trop vague (lieu-dit, "MAIRIE"...)
      // pour être géocodés fiablement. On ne complète jamais par un
      // géocodage approximatif (risque de placer un établissement au
      // mauvais endroit) : sans coordonnée fournie par la source, il reste
      // simplement absent de la carte, tout en restant listé normalement.
      const lat = etab.latitude ? Number(etab.latitude) : null;
      const lon = etab.longitude ? Number(etab.longitude) : null;
      entreprises.push({
        siren: entreprise.siren,
        siret: etab.siret,
        nom: entreprise.nom_complet,
        enseigne,
        adresse: etab.adresse,
        lat, lon,
        naf: etab.activite_principale || null,
        nafLibelle,
        icone: association ? 'association' : icone,
        association,
        dateCreation: etab.date_debut_activite || null
      });
    }
  }

  if (totalPages && page >= totalPages) break;
  page++;
}

entreprises.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

const sortie = {
  misAJour: new Date().toISOString().slice(0, 10),
  source: BASE,
  entreprises
};

writeFileSync(join(RACINE, 'content/entreprises.json'), JSON.stringify(sortie, null, 2) + '\n');
const geolocalises = entreprises.filter((e) => e.lat && e.lon).length;
console.log(`  ${entreprises.length} établissement(s) actif(s) retenu(s) à Juvinas (${ignorees} ignoré(s) sans adresse publique, ${sciExclues} SCI exclue(s))`);
console.log(`  ${geolocalises} localisé(s) précisément (utilisés sur la carte)`);
console.log('  → content/entreprises.json mis à jour\n');
