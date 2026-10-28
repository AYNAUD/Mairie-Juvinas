/* =====================================================================
   Récupération des comptes de la commune (budget principal), tels que
   l'État les publie chaque année : base « Comptes des communes » de
   l'Observatoire des finances et de la gestion publique locales (OFGL),
   calculée à partir des comptes de gestion de la DGFiP. Open data, sans
   clé.

   Sert la section « Les comptes en clair » de /mairie/budgets.html :
   « sur 100 € dépensés, où vont-ils ? », et la comparaison, par habitant,
   avec la moyenne des communes de la même taille (même strate de
   population). C'est le réalisé, pas le budget voté (content/budgets.json,
   saisi par la mairie) : les deux se complètent.

   Écrit content/finances.json. Relancé chaque semaine par
   .github/workflows/donnees-publiques.yml, qui committe le fichier s'il a
   changé : un nouvel exercice apparaît de lui-même dès sa publication par
   l'OFGL. Lancement manuel possible via « npm run finances ». En cas
   d'échec de l'API, rien n'est écrit : le site garde les derniers chiffres.
   ===================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(readFileSync(join(RACINE, 'content/site.json'), 'utf8'));
const CODE_INSEE = site.commune.codeInsee;

const URL_OFGL = 'https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/ofgl-base-communes/records';

// Strates de population de l'OFGL (reprises de la DGFiP).
const STRATES = {
  0: 'moins de 100 habitants', 1: '100 à 199 habitants', 2: '200 à 499 habitants',
  3: '500 à 1 999 habitants', 4: '2 000 à 3 499 habitants', 5: '3 500 à 4 999 habitants',
  6: '5 000 à 9 999 habitants', 7: '10 000 à 19 999 habitants', 8: '20 000 à 49 999 habitants',
  9: '50 000 à 99 999 habitants', 10: '100 000 habitants et plus',
};

// Agrégats OFGL → libellés compréhensibles par un habitant. Les postes de
// chaque répartition s'additionnent exactement au total correspondant
// (vérifié ci-dessous : un écart éventuel devient une ligne « Autres »).
const DEPENSES = {
  total: 'Dépenses de fonctionnement',
  postes: [
    ['Frais de personnel', 'Le personnel communal'],
    ['Achats et charges externes', 'Achats, énergie, entretien et services'],
    ["Dépenses d'intervention", 'Subventions, participations et contributions obligatoires'],
    ['Charges financières', 'Intérêts des emprunts'],
    ['Autres dépenses de fonctionnement', 'Autres charges'],
  ],
};
const RECETTES = {
  total: 'Recettes de fonctionnement',
  postes: [
    ['Impôts et taxes', 'Impôts et taxes locales'],
    ["Concours de l'Etat", "Dotations de l'État"],
    ['Ventes de biens et services', 'Ventes, locations et services'],
    ['Subventions reçues et participations', 'Subventions reçues'],
    ['Autres recettes de fonctionnement', 'Autres recettes'],
  ],
};
const COMPARAISONS = [
  ['Dépenses de fonctionnement', 'Dépenses de fonctionnement'],
  ['Frais de personnel', 'dont personnel communal'],
  ['Impôts locaux', 'Impôts locaux perçus'],
  ["Dépenses d'équipement", 'Dépenses d’équipement (travaux, achats durables)'],
  ['Encours de dette', 'Dette restant à rembourser'],
  ['Epargne brute', 'Épargne dégagée par le fonctionnement'],
];
const HISTORIQUE = [
  ["Dépenses d'équipement", 'equipement'],
  ['Encours de dette', 'dette'],
  ['Epargne brute', 'epargne'],
];

async function interroger(params) {
  const url = `${URL_OFGL}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'mairie-juvinas-finances/1.0 (site municipal, hebdomadaire)' } });
  if (!r.ok) throw new Error(`${r.status} sur ${url}`);
  return (await r.json()).results;
}

const lignes = await interroger({
  where: `insee="${CODE_INSEE}" and type_de_budget="Budget principal"`,
  select: 'exer,agregat,montant,euros_par_habitant,ptot,tranche_population',
  limit: '100',
  offset: '0',
});
// 48 agrégats par exercice : une page de 100 ne suffit pas pour 8 ans.
for (let offset = 100; lignes.length === offset; offset += 100) {
  lignes.push(...await interroger({
    where: `insee="${CODE_INSEE}" and type_de_budget="Budget principal"`,
    select: 'exer,agregat,montant,euros_par_habitant,ptot,tranche_population',
    limit: '100',
    offset: String(offset),
  }));
}
if (!lignes.length) throw new Error(`Aucun compte trouvé pour la commune ${CODE_INSEE}`);

const annee = (exer) => String(exer).slice(0, 4);
const parExercice = new Map();
for (const l of lignes) {
  const e = annee(l.exer);
  if (!parExercice.has(e)) parExercice.set(e, new Map());
  parExercice.get(e).set(l.agregat, l);
}
const exercices = [...parExercice.keys()].sort();
const exercice = exercices[exercices.length - 1];
const compte = parExercice.get(exercice);
const montant = (agregat, c = compte) => (c.get(agregat) ? c.get(agregat).montant : 0);
const quelconque = compte.values().next().value;

function repartition({ total, postes }) {
  const t = montant(total);
  const lignesRep = postes.map(([agregat, libelle]) => ({ libelle, montant: Math.round(montant(agregat)) }));
  const ecart = Math.round(t - lignesRep.reduce((n, l) => n + l.montant, 0));
  if (Math.abs(ecart) > 1) lignesRep.push({ libelle: 'Autres', montant: ecart });
  return { total: Math.round(t), postes: lignesRep.filter((l) => l.montant > 0) };
}

// Moyenne de la strate = somme des montants / somme des populations (ratio
// de sommes, comme la DGFiP), sur les communes dont le compte de cet
// exercice est publié.
const strate = quelconque.tranche_population;
const moyennes = await interroger({
  where: `exer=date'${exercice}' and tranche_population="${strate}" and type_de_budget="Budget principal"`,
  select: 'agregat,sum(montant) as m,sum(ptot) as p,count(*) as n',
  group_by: 'agregat',
  limit: '100',
});
const moyenne = new Map(moyennes.map((m) => [m.agregat, m]));

const sortie = {
  misAJour: new Date().toISOString().slice(0, 10),
  source: "Comptes des communes — Observatoire des finances et de la gestion publique locales (OFGL), d'après les comptes de gestion de la DGFiP",
  exercice: Number(exercice),
  population: quelconque.ptot,
  strate: {
    libelle: STRATES[strate] || null,
    nombreCommunes: moyenne.get('Dépenses de fonctionnement')?.n || null,
  },
  depenses: repartition(DEPENSES),
  recettes: repartition(RECETTES),
  comparaisons: COMPARAISONS.map(([agregat, libelle]) => {
    const m = moyenne.get(agregat);
    return {
      libelle,
      commune: Math.round(compte.get(agregat)?.euros_par_habitant ?? 0),
      strate: m && m.p ? Math.round(m.m / m.p) : null,
    };
  }),
  historique: exercices.map((e) => ({
    exercice: Number(e),
    ...Object.fromEntries(HISTORIQUE.map(([agregat, cle]) => [cle, Math.round(montant(agregat, parExercice.get(e)))])),
  })),
};

writeFileSync(join(RACINE, 'content/finances.json'), JSON.stringify(sortie, null, 2) + '\n');
console.log(`  Comptes ${sortie.exercice} de ${site.commune.nom} : ${sortie.depenses.total} € de dépenses de fonctionnement, comparés à ${sortie.strate.nombreCommunes} communes de ${sortie.strate.libelle}.`);
