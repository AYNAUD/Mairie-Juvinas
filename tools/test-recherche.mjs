/* =====================================================================
   Test de pertinence du moteur de recherche.
   Chaque cas décrit ce qu'un habitant tape réellement, et la page qu'il
   doit obtenir en premier résultat. Un échec ici est un habitant perdu.
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(RACINE, 'src/scripts/recherche.js'), 'utf8');
const index = JSON.parse(readFileSync(join(RACINE, 'dist/search-index.json'), 'utf8'));

// DOM minimal : le moteur ne doit dépendre de rien d'autre que de son index.
const faux = {
  querySelectorAll: () => [], querySelector: () => null,
  getElementById: () => null, addEventListener: () => {}
};
const bac = { document: faux, location: { search: '' }, URLSearchParams, fetch: () => Promise.reject(), console };
bac.window = bac;
vm.createContext(bac);
vm.runInContext(source, bac);

const moteur = bac.window.RechercheMairie;
moteur.injecter(index);

const CAS = [
  ['perte de passeport', '/demarches/passeport.html'],
  ['j ai perdu mon passeport', '/demarches/passeport.html'],
  ['passport', '/demarches/passeport.html'],
  ['refaire ma carte d identité', '/demarches/carte-identite.html'],
  ['carte didentité perdue', '/demarches/carte-identite.html'],
  ['cni', '/demarches/carte-identite.html'],
  ['carte gris', '/demarches/carte-grise.html'],
  ['jai vendu ma voiture', '/demarches/carte-grise.html'],
  ['permis de conduire perdu', '/demarches/permis-conduire.html'],
  ['inscrire mon enfant à l école', '/demarches/ecole-cantine.html'],
  ['cantine', '/demarches/ecole-cantine.html'],
  ['faire enlever un vieux canapé', '/demarches/encombrants.html'],
  ['louer la salle des fêtes', '/demarches/salle-communale.html'],
  ['organiser un anniversaire', '/demarches/salle-communale.html'],
  ['je veux construire un abri de jardin', '/demarches/permis-de-construire.html'],
  ['poser une clôture', '/demarches/permis-de-construire.html'],
  ['faire une piscine', '/demarches/permis-de-construire.html'],
  ['je viens demménager je veux voter', '/demarches/listes-electorales.html'],
  ['inscription sur les listes électorales', '/demarches/listes-electorales.html'],
  ['je serai absent le jour du vote', '/demarches/procuration.html'],
  ['procuration', '/demarches/procuration.html'],
  ['mon fils a 16 ans', '/demarches/recensement-citoyen.html'],
  ['attestation de recensement', '/demarches/recensement-citoyen.html'],
  ['se pacser', '/demarches/pacs.html'],
  ['je veux me marier', '/demarches/mariage.html'],
  ['acte de naissance', '/demarches/acte-naissance.html'],
  ['quelquun est décédé', '/demarches/deces.html'],
  ['place au cimetière', '/demarches/concession-cimetiere.html'],
  ['documents de la commune', '/mairie/bibliotheque-documentaire.html'],
  ['bibliothèque documentaire', '/mairie/bibliotheque-documentaire.html'],
  ['rapports et études de la commune', '/mairie/bibliotheque-documentaire.html'],
  ['numéro de ma parcelle', '/demarches/cadastre.html'],
  ['je veux acheter un terrain', '/demarches/certificat-urbanisme.html'],
  ['procès verbal conseil municipal', '/mairie/conseils-municipaux.html'],
  ['facture d eau', '/cadre-de-vie/eau.html'],
  ['plan local d\'urbanisme', '/cadre-de-vie/urbanisme.html'],
  ['rencontrer le maire', '/demarches/rendez-vous-elu.html'],
  ['signaler un lampadaire en panne', '/demarches/rendez-vous-elu.html'],
  ['commerçants de juvinas', '/vie-locale/professionnels.html'],
  ['où sont les commerces', '/vie-locale/carte-acteurs-economiques.html'],
  ['jour de ramassage des poubelles', '/cadre-de-vie/dechets.html'],
  ['quand sortir les poubelles', '/cadre-de-vie/dechets.html'],
  ['transport à la demande', '/cadre-de-vie/transports.html'],
  ['aller à aubenas le samedi', '/cadre-de-vie/transports.html'],
  ['météorite de juvinas', '/mairie/histoire.html'],
  ['chapelle sainte marguerite', '/vie-locale/tourisme.html'],
  ['randonnées', '/vie-locale/tourisme.html'],
  ['louer la salle vesta', '/demarches/salle-communale.html'],
  ['trouver une nounou', '/demarches/creche.html'],
  ['place en crèche', '/demarches/creche.html'],
  ['que faire des enfants le mercredi', '/demarches/centre-loisirs.html'],
  ['créer une association', '/demarches/association.html'],
  ['obligation de débroussailler', '/demarches/debroussaillement.html'],
  ['inscrire ma mère au registre canicule', '/demarches/registre-vulnerables.html'],
  ['mon chien est de catégorie 2', '/demarches/chien-dangereux.html'],
  ['permis de chasser', '/demarches/chasse-peche.html'],
  ['je suis nouveau dans la commune', '/demarches/nouvel-habitant.html'],
  ['feu de forêt', '/cadre-de-vie/risques.html'],
  ['france services', '/cadre-de-vie/services.html'],
  ['école de mon village', '/enfance-jeunesse/ecole.html'],
  ['budget de la commune', '/mairie/budgets.html'],
  ['ajouter à mon agenda', '/vie-locale/calendriers.html'],
  ['calendrier de la commune', '/vie-locale/calendriers.html'],
  ['fiche frigo', '/mairie/fiche-pratique.html'],
  ['imprimer les numéros utiles', '/mairie/fiche-pratique.html'],
  ['quel est mon canton', '/mairie/commune.html'],
  ['qui est mon député', '/mairie/commune.html'],
  ['communauté de communes', '/mairie/commune.html']
];

const REPONSES = [
  ['horaires de la mairie', 'horaires'],
  ['la mairie est elle ouverte', 'horaires'],
  ['numéro de téléphone de la mairie', 'telephone'],
  ['qui est le maire', 'maire']
];

let echecs = 0, top3 = 0;
console.log('\nPertinence des résultats\n');

for (const [requete, attendu] of CAS) {
  const { resultats } = moteur.chercher(requete);
  const urls = resultats.map((r) => r.u);
  const rang = urls.indexOf(attendu);
  if (rang === 0) {
    console.log(`  ✓ « ${requete} »`);
  } else if (rang > 0 && rang < 3) {
    top3++;
    console.log(`  ~ « ${requete} » → attendu en 1er, obtenu en ${rang + 1}e (1er : ${urls[0]})`);
  } else {
    echecs++;
    console.log(`  ✗ « ${requete} » → attendu ${attendu}, obtenu ${urls.slice(0, 3).join(', ') || 'rien'}`);
  }
}

console.log('\nRéponses rapides\n');
for (const [requete, id] of REPONSES) {
  const { reponse } = moteur.chercher(requete);
  if (reponse) console.log(`  ✓ « ${requete} » → ${reponse.t}`);
  else { echecs++; console.log(`  ✗ « ${requete} » → aucune réponse rapide (attendu ${id})`); }
}

// Une requête qui ne correspond à rien doit répondre « aucun résultat »,
// pas planter : la page gardait alors les résultats de la requête d'avant.
console.log('\nRequêtes sans résultat\n');
for (const requete of ['zzzz', 'xqwvbn kjhg']) {
  try {
    const { resultats } = moteur.chercher(requete);
    if (resultats.length) { echecs++; console.log(`  ✗ « ${requete} » → ${resultats.length} résultat(s) inattendu(s)`); }
    else console.log(`  ✓ « ${requete} » → aucun résultat`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ « ${requete} » → erreur : ${e.message}`);
  }
}

const total = CAS.length;
console.log(`\n${total - echecs - top3}/${total} en première position · ${top3} dans les trois premiers · ${echecs} échec(s)\n`);
process.exit(echecs ? 1 : 0);
