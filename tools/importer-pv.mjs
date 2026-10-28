/* =====================================================================
   Import en une fois des procès-verbaux de conseils municipaux reçus sous
   forme de dossier de PDF (par ex. l'export « Télécharger » d'un dossier
   Google Drive, fait par son propriétaire).

     npm run pv:importer -- <dossier>            importe
     npm run pv:importer -- <dossier> --essai    montre seulement ce qui
                                                 serait fait, sans rien écrire

   Pour chaque PDF du dossier (sous-dossiers compris), la date de séance est
   lue dans le nom du fichier (« PV du 28 mai 2025.pdf », « CR 10-12-2025 »,
   « 2025-12-10 », « 20251210 »…) et rapprochée d'une séance existante de
   content/conseils.json. Le fichier est copié en
   public/documents/seance-AAAAMMJJ.pdf et inscrit sous conseils/<année>
   dans content/documents.json — exactement ce que fait le circuit email
   (worker/github.mjs). Au build suivant, la séance renvoie vers ce PDF au
   lieu du lien externe, et son texte entre dans la recherche des
   comptes-rendus (src/build.mjs, construireIndexPv).

   Rien n'est deviné : un fichier sans date lisible, une date sans séance
   dans conseils.json, ou deux fichiers pour la même séance sont signalés
   et laissés de côté. Un PDF sans texte extractible (un scan) est importé
   — il reste téléchargeable — mais signalé, car la recherche ne le verra
   pas.
   ===================================================================== */
import { readFileSync, writeFileSync, readdirSync, copyFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractText } from 'unpdf';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHEMIN_CONSEILS = join(RACINE, 'content/conseils.json');
const CHEMIN_DOCUMENTS = join(RACINE, 'content/documents.json');
const DOSSIER_DOCUMENTS = join(RACINE, 'public/documents');

// En dessous, on considère qu'un PDF n'a pas de couche texte (scan).
const TEXTE_MINIMUM = 200;

const args = process.argv.slice(2);
const essai = args.includes('--essai');
const dossier = args.find((a) => !a.startsWith('--'));
if (!dossier || !existsSync(dossier) || !statSync(dossier).isDirectory()) {
  console.error('Usage : npm run pv:importer -- <dossier de PDF> [--essai]');
  process.exit(1);
}

const MOIS = {
  janvier: 1, janv: 1, fevrier: 2, fevr: 2, fev: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6,
  juillet: 7, juil: 7, aout: 8, septembre: 9, sept: 9, octobre: 10, oct: 10,
  novembre: 11, nov: 11, decembre: 12, dec: 12
};

function dateValide(a, m, j) {
  if (a < 2000 || a > 2100 || m < 1 || m > 12 || j < 1 || j > 31) return null;
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCMonth() !== m - 1) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

// Date de séance lue dans un nom de fichier, ou null.
function dateDepuisNom(nom) {
  const n = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.pdf$/, '');
  let m;
  if ((m = n.match(/(?<!\d)(\d{4})[-_. ](\d{1,2})[-_. ](\d{1,2})(?!\d)/))) return dateValide(+m[1], +m[2], +m[3]);
  for (const t of n.matchAll(/(?<!\d)(\d{1,2})(?:er)?[\s_-]*([a-z]+)\.?[\s_-]*(\d{4})(?!\d)/g)) {
    if (MOIS[t[2]]) return dateValide(+t[3], MOIS[t[2]], +t[1]);
  }
  if ((m = n.match(/(?<!\d)(\d{1,2})[-_./ ](\d{1,2})[-_./ ](\d{4}|\d{2})(?!\d)/))) return dateValide(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  if ((m = n.match(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/))) return dateValide(+m[1], +m[2], +m[3]);
  return null;
}

function listerPdf(racine) {
  const trouves = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) trouves.push(...listerPdf(chemin));
    else if (/\.pdf$/i.test(entree.name)) trouves.push(chemin);
  }
  return trouves.sort();
}

async function longueurTexte(octets) {
  try {
    const { text } = await extractText(new Uint8Array(octets), { mergePages: true });
    return String(text).replace(/\s+/g, ' ').trim().length;
  } catch {
    return 0;
  }
}

const conseils = JSON.parse(readFileSync(CHEMIN_CONSEILS, 'utf8'));
const registre = JSON.parse(readFileSync(CHEMIN_DOCUMENTS, 'utf8'));
const seances = new Map();
for (const bloc of conseils) for (const s of bloc.seances) seances.set(s.date, s);

const sansDate = [], sansSeance = [], invalides = [];
const parDate = new Map();
for (const chemin of listerPdf(dossier)) {
  const nom = relative(dossier, chemin);
  const date = dateDepuisNom(basename(chemin));
  if (!date) { sansDate.push(nom); continue; }
  if (!seances.has(date)) { sansSeance.push(`${nom} (${date})`); continue; }
  if (!readFileSync(chemin).subarray(0, 5).toString('latin1').startsWith('%PDF-')) { invalides.push(nom); continue; }
  if (!parDate.has(date)) parDate.set(date, []);
  parDate.get(date).push(chemin);
}

const doublons = [...parDate].filter(([, chemins]) => chemins.length > 1);
const aImporter = [...parDate].filter(([, chemins]) => chemins.length === 1).map(([date, [chemin]]) => ({ date, chemin }));
aImporter.sort((a, b) => b.date.localeCompare(a.date));

const scans = [];
for (const { date, chemin } of aImporter) {
  const octets = readFileSync(chemin);
  const fichier = `seance-${date.replaceAll('-', '')}.pdf`;
  const texte = await longueurTexte(octets);
  if (texte < TEXTE_MINIMUM) scans.push(`${fichier} ← ${relative(dossier, chemin)}`);
  const cle = `conseils/${date.slice(0, 4)}`;
  const entree = { date, fichier, libelle: seances.get(date).libelle };
  const liste = (registre[cle] ||= []);
  const i = liste.findIndex((d) => d.date === date);
  if (i >= 0) liste[i] = entree; else liste.push(entree);
  liste.sort((a, b) => b.date.localeCompare(a.date));
  console.log(`  ${essai ? '·' : '✓'} ${date}  ${relative(dossier, chemin)} → public/documents/${fichier}  (${Math.round(octets.length / 1024)} ko)`);
  if (!essai) copyFileSync(chemin, join(DOSSIER_DOCUMENTS, fichier));
}

if (!essai && aImporter.length) {
  const trie = Object.fromEntries(Object.entries(registre).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(CHEMIN_DOCUMENTS, `${JSON.stringify(trie, null, 2)}\n`);
}

const signaler = (titre, liste) => {
  if (!liste.length) return;
  console.log(`\n${titre} (${liste.length}) :`);
  for (const l of liste) console.log(`  - ${l}`);
};
signaler('Date illisible dans le nom — renommez le fichier avec la date de séance', sansDate);
signaler('Aucune séance à cette date dans content/conseils.json — ajoutez-la d\'abord', sansSeance);
signaler('Plusieurs fichiers pour la même séance — gardez-en un seul', doublons.map(([date, chemins]) => `${date} : ${chemins.map((c) => relative(dossier, c)).join(', ')}`));
signaler('Pas un vrai PDF', invalides);
signaler('Sans texte extractible (scan ?) — téléchargeable, mais invisible pour la recherche', scans);

const couvertes = new Set(Object.entries(registre).filter(([k]) => k.startsWith('conseils/')).flatMap(([, docs]) => docs.map((d) => d.date)));
const manquantes = [...seances.keys()].filter((d) => !couvertes.has(d)).sort().reverse();
signaler('Séances encore sans PV local', manquantes);

console.log(`\n${aImporter.length} PV ${essai ? 'à importer (essai : rien n\'a été écrit)' : 'importé(s)'} · ${seances.size - manquantes.length}/${seances.size} séances couvertes${essai ? ' après import' : ''}.`);
if (!essai && aImporter.length) console.log('Relancez « npm run build » (ou « npm run check ») pour indexer le texte et mettre à jour la page.');
