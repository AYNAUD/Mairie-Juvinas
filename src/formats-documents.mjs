/**
 * Formats acceptés dans la Bibliothèque documentaire communale : tout ce
 * qu'un navigateur affiche lui-même, sans logiciel à installer — PDF,
 * images, sons, vidéos et texte brut. Les autres catégories de documents
 * (conseils, budgets, bulletins…) restent en PDF seulement.
 *
 * Volontairement refusés, même si un navigateur sait les ouvrir : HTML,
 * SVG et XML. Servis depuis le domaine du site, ils peuvent exécuter du
 * script au nom du site (vol de session, fausse page de la mairie). Les
 * documents bureautiques (Word, tableur…) ne sont pas lisibles par un
 * navigateur : à convertir en PDF avant dépôt.
 *
 * Partagé par src/build.mjs (libellé du format sur la page) et par le
 * Worker (worker/commandes.mjs, worker/formulaire.mjs) : une seule liste à
 * tenir.
 */

// 15 Mo : sous la limite d'un courriel reçu par Cloudflare (25 Mo, pièce
// jointe encodée comprise), d'un brouillon en attente de validation (valeur
// KV de 25 Mo, en base64) et d'un fichier servi par Cloudflare (25 Mo).
export const TAILLE_MAX_BIBLIOTHEQUE = 15 * 1024 * 1024;

const octetsSont = (o, debut, valeurs) => valeurs.every((v, i) => o[debut + i] === v);
const texteEn = (o, debut, texte) => octetsSont(o, debut, [...texte].map((c) => c.charCodeAt(0)));

// Texte brut : de l'UTF-8 valide, sans octet nul (un fichier binaire
// renommé en .txt ne passe pas).
function estTexteUtf8(o) {
  if (o.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(o);
    return true;
  } catch {
    return false;
  }
}

// "signature" vérifie les premiers octets : un fichier dont l'extension
// ment sur son contenu est refusé.
const PDF = { type: 'application/pdf', libelle: 'PDF', signature: (o) => texteEn(o, 0, '%PDF-') };
const JPEG = { type: 'image/jpeg', libelle: 'Image JPEG', signature: (o) => octetsSont(o, 0, [0xff, 0xd8, 0xff]) };
const OGG = { type: 'audio/ogg', libelle: 'Son OGG', signature: (o) => texteEn(o, 0, 'OggS') };
export const FORMATS_BIBLIOTHEQUE = {
  pdf: PDF,
  jpg: JPEG,
  jpeg: JPEG,
  png: { type: 'image/png', libelle: 'Image PNG', signature: (o) => octetsSont(o, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  gif: { type: 'image/gif', libelle: 'Image GIF', signature: (o) => texteEn(o, 0, 'GIF8') },
  webp: { type: 'image/webp', libelle: 'Image WebP', signature: (o) => texteEn(o, 0, 'RIFF') && texteEn(o, 8, 'WEBP') },
  mp3: { type: 'audio/mpeg', libelle: 'Son MP3', signature: (o) => texteEn(o, 0, 'ID3') || (o[0] === 0xff && (o[1] & 0xe0) === 0xe0) },
  ogg: OGG,
  oga: OGG,
  wav: { type: 'audio/wav', libelle: 'Son WAV', signature: (o) => texteEn(o, 0, 'RIFF') && texteEn(o, 8, 'WAVE') },
  m4a: { type: 'audio/mp4', libelle: 'Son M4A', signature: (o) => texteEn(o, 4, 'ftyp') },
  mp4: { type: 'video/mp4', libelle: 'Vidéo MP4', signature: (o) => texteEn(o, 4, 'ftyp') },
  webm: { type: 'video/webm', libelle: 'Vidéo WebM', signature: (o) => octetsSont(o, 0, [0x1a, 0x45, 0xdf, 0xa3]) },
  txt: { type: 'text/plain', libelle: 'Texte', signature: estTexteUtf8 },
};

/** Valeur de l'attribut accept du champ fichier (formulaires d'administration). */
export const ACCEPT_BIBLIOTHEQUE = Object.keys(FORMATS_BIBLIOTHEQUE).map((e) => `.${e}`).join(',');

/** Les formats en clair, pour les aides et les messages d'erreur. */
export const FORMATS_BIBLIOTHEQUE_TEXTE = 'PDF, image (JPEG, PNG, GIF, WebP), son (MP3, OGG, WAV, M4A), vidéo (MP4, WebM) ou texte (TXT)';

export function extension(nom) {
  const m = /\.([a-z0-9]+)$/i.exec(String(nom || ''));
  return m ? m[1].toLowerCase() : '';
}

/** Le format d'un fichier de la bibliothèque d'après son nom, ou null. */
export function formatBibliotheque(nom) {
  return FORMATS_BIBLIOTHEQUE[extension(nom)] || null;
}

/** Type MIME d'un document déposé (PDF hors bibliothèque). */
export function typeDocument(nom) {
  return (formatBibliotheque(nom) || PDF).type;
}

/** null si le fichier peut entrer dans la bibliothèque, sinon la raison. */
export function refusFichierBibliotheque(nom, octets) {
  const format = formatBibliotheque(nom);
  if (!format) {
    return `Le fichier « ${nom} » n'est pas d'un format accepté dans la bibliothèque documentaire : ${FORMATS_BIBLIOTHEQUE_TEXTE}.`;
  }
  if (octets.length > TAILLE_MAX_BIBLIOTHEQUE) {
    return `Le fichier « ${nom} » dépasse 15 Mo : réduisez-le (vidéo plus courte ou moins définie, PDF compressé) avant de le déposer.`;
  }
  if (!format.signature(octets)) {
    return `Le contenu du fichier « ${nom} » ne correspond pas à son extension (${format.libelle} attendu).`;
  }
  return null;
}
