/**
 * Calendriers iCalendar (RFC 5545), sans dépendance : les dates de la
 * commune à ajouter à l'agenda d'un téléphone ou d'un ordinateur.
 *
 * - rendez-vous réguliers : content/site.json → rendezVousReguliers
 *   (encombrants, minibus, bibliothèque…), décrits par une règle de
 *   récurrence plutôt que par une liste de dates : rien à mettre à jour
 *   d'une année sur l'autre ;
 * - événements : les actualités qui portent une période (dateDebut,
 *   dateFin facultative), regénérés à chaque build.
 *
 * Un agenda abonné relit le fichier de lui-même : une actualité publiée par
 * email apparaît donc chez les abonnés sans aucun geste de la mairie.
 */

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_ICS = { lundi: 'MO', mardi: 'TU', mercredi: 'WE', jeudi: 'TH', vendredi: 'FR', samedi: 'SA', dimanche: 'SU' };
const RANGS = { 1: 'premier', 2: 'deuxième', 3: 'troisième', 4: 'quatrième', '-1': 'dernier' };

// Point de départ des récurrences : une date fixe, pour que DTSTART ne
// change pas d'un build à l'autre (un agenda y verrait un nouvel événement).
const ORIGINE = '2026-01-01';

const heureFr = (hhmm) => {
  const [h, m] = hhmm.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
};

function listeFr(mots) {
  return mots.length > 1 ? `${mots.slice(0, -1).join(', ')} et ${mots[mots.length - 1]}` : mots[0];
}

/** « Le premier lundi de chaque mois », « Le mercredi et le vendredi, de
 *  16h à 18h » : la même règle sert au calendrier et au texte affiché, pour
 *  qu'ils ne puissent jamais se contredire. */
export function quandRendezVous(regle) {
  const jours = regle.jours || [];
  let texte = regle.frequence === 'mensuelle'
    ? `Le ${RANGS[regle.rang] || 'premier'} ${jours[0]} de chaque mois`
    : `Le ${listeFr(jours.map((j, i) => (i === 0 ? j : `le ${j}`)))}`;
  if (regle.debut && regle.fin) texte += `, de ${heureFr(regle.debut)} à ${heureFr(regle.fin)}`;
  return texte;
}

const jourUtc = (iso) => new Date(`${iso}T00:00:00Z`);
const isoJour = (d) => d.toISOString().slice(0, 10);
const compact = (iso) => iso.replace(/-/g, '');
function ajouterJours(iso, n) {
  const d = jourUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoJour(d);
}

// Première occurrence de la règle à partir d'ORIGINE : DTSTART doit être
// lui-même une occurrence, sinon certains agendas affichent un événement
// fantôme à la date de départ.
function premiereOccurrence(regle) {
  const index = (regle.jours || []).map((j) => JOURS.indexOf(j));
  if (regle.frequence === 'mensuelle') {
    const d = jourUtc(ORIGINE);
    d.setUTCDate(1);
    while (d.getUTCDay() !== index[0]) d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCDate(d.getUTCDate() + 7 * ((regle.rang || 1) - 1));
    return isoJour(d);
  }
  let jour = ORIGINE;
  while (!index.includes(jourUtc(jour).getUTCDay())) jour = ajouterJours(jour, 1);
  return jour;
}

function echapper(texte) {
  return String(texte).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Lignes pliées à 75 octets (RFC 5545, § 3.1), sans jamais couper un
// caractère accentué en deux : la ligne de continuation commence par un
// espace, qui compte dans sa longueur.
function plier(ligne) {
  if (Buffer.byteLength(ligne) <= 75) return ligne;
  const morceaux = [];
  let courant = '';
  let taille = 0;
  let limite = 75;
  for (const car of ligne) {
    const t = Buffer.byteLength(car);
    if (taille + t > limite) {
      morceaux.push(courant);
      courant = '';
      taille = 0;
      limite = 74;
    }
    courant += car;
    taille += t;
  }
  morceaux.push(courant);
  return morceaux.join('\r\n ');
}

const FUSEAU_PARIS = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
  'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
  'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE'
];

function lignesEvenement(e, horodatage) {
  const lignes = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${horodatage}`, `SUMMARY:${echapper(e.titre)}`];
  if (e.debut) {
    lignes.push(`DTSTART;TZID=Europe/Paris:${compact(e.jour)}T${e.debut.replace(':', '')}00`);
    lignes.push(`DTEND;TZID=Europe/Paris:${compact(e.jour)}T${e.fin.replace(':', '')}00`);
  } else {
    // Journée entière : DTEND est exclusif, c'est le lendemain du dernier jour.
    lignes.push(`DTSTART;VALUE=DATE:${compact(e.jour)}`);
    lignes.push(`DTEND;VALUE=DATE:${compact(ajouterJours(e.jourFin || e.jour, 1))}`);
    lignes.push('TRANSP:TRANSPARENT');
  }
  if (e.rrule) lignes.push(`RRULE:${e.rrule}`);
  if (e.description) lignes.push(`DESCRIPTION:${echapper(e.description)}`);
  if (e.lieu) lignes.push(`LOCATION:${echapper(e.lieu)}`);
  if (e.url) lignes.push(`URL:${e.url}`);
  lignes.push('END:VEVENT');
  return lignes;
}

/** Fichier .ics complet (fins de ligne CRLF, comme l'exige la norme). */
export function calendrier({ nom, description, evenements, maintenant = new Date(), producteur = 'Mairie' }) {
  const horodatage = maintenant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lignes = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${producteur}//Site de la commune//FR`,
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${echapper(nom)}`, `X-WR-CALDESC:${echapper(description)}`, 'X-WR-TIMEZONE:Europe/Paris',
    // Un agenda abonné relit le fichier une fois par jour.
    'REFRESH-INTERVAL;VALUE=DURATION:P1D', 'X-PUBLISHED-TTL:P1D',
    ...(evenements.some((e) => e.debut) ? FUSEAU_PARIS : []),
    ...evenements.flatMap((e) => lignesEvenement(e, horodatage)),
    'END:VCALENDAR'
  ];
  return lignes.map(plier).join('\r\n') + '\r\n';
}

/** Domaine du site, pour des identifiants d'événement stables et uniques. */
function domaineSite(site) {
  return String(site.url).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

/** Rendez-vous réguliers de site.json → événements récurrents. « lieu:
 *  mairie » renvoie à l'adresse de site.json → mairie, sans la recopier. */
export function evenementsReguliers(rendezVous, site) {
  const m = site.mairie;
  return rendezVous.map((r) => {
    const regle = r.regle;
    const jours = (regle.jours || []).map((j) => JOURS_ICS[j]);
    const rrule = regle.frequence === 'mensuelle'
      ? `FREQ=MONTHLY;BYDAY=${regle.rang || 1}${jours[0]}`
      : `FREQ=WEEKLY;BYDAY=${jours.join(',')}`;
    return {
      uid: `${r.id}@${domaineSite(site)}`,
      titre: r.titre,
      description: `${quandRendezVous(regle)}. ${r.detail || ''}`.trim(),
      lieu: r.lieu === 'mairie' ? `${m.nom}, ${m.adresse}, ${m.codePostal} ${m.ville}` : (r.lieu || ''),
      url: r.url ? `${site.url}${r.url}` : '',
      jour: premiereOccurrence(regle),
      debut: regle.debut || null,
      fin: regle.fin || null,
      rrule
    };
  });
}

/** Une actualité datée (dateDebut obligatoire) → événement sur la journée,
 *  ou sur toute la période jusqu'à dateFin. */
export function evenementActualite(a, site) {
  if (!a.dateDebut) return null;
  const fin = a.dateFin && a.dateFin >= a.dateDebut ? a.dateFin : a.dateDebut;
  return {
    uid: `actualite-${a.id}@${domaineSite(site)}`,
    titre: a.titre,
    description: a.chapeau || '',
    url: `${site.url}/vie-locale/actualites/${a.id}.html`,
    jour: a.dateDebut,
    jourFin: fin
  };
}
