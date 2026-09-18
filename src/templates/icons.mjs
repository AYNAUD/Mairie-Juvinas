// Jeu d'icônes inline. Trait uniquement (currentColor), 24x24, jamais de couleur codée en dur.
// Les icônes sont décoratives : elles portent toujours aria-hidden et sont doublées d'un texte.

const P = {
  identite: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5 16.2c.7-1.4 2-2.2 3.5-2.2s2.8.8 3.5 2.2M14.5 10h5M14.5 13.5h5"/>',
  passeport: '<path d="M5 3.5h11a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5z"/><path d="M5 3.5v17"/><circle cx="12" cy="11" r="3.2"/><path d="M8.8 11h6.4M12 7.8c1.6 1.9 1.6 4.5 0 6.4-1.6-1.9-1.6-4.5 0-6.4"/>',
  voiture: '<path d="M3 16v-3.2l1.9-4.3A2 2 0 0 1 6.7 7h10.6a2 2 0 0 1 1.8 1.5L21 12.8V16"/><path d="M3 16h18M3 16v2.5h3V16M18 16v2.5h3V16"/><circle cx="7.5" cy="13" r="1"/><circle cx="16.5" cy="13" r="1"/>',
  permis: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8" cy="10.5" r="2"/><path d="M4.8 15.6c.6-1.2 1.8-1.9 3.2-1.9s2.6.7 3.2 1.9M14 9.5h4.5M14 12.5h4.5M14 15.5h2.5"/>',
  document: '<path d="M6 2.5h7l5 5v14H6z"/><path d="M13 2.5v5h5"/><path d="M9 12.5h6M9 16h6"/>',
  vote: '<path d="M4 20.5h16M5.5 20.5v-5h13v5"/><path d="M9 15.5v-2h6v2"/><path d="M12 3v8M12 11l3-3M12 11 9 8"/>',
  procuration: '<path d="M3.5 19.5c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5"/><circle cx="9" cy="8.5" r="3.2"/><path d="M16 9.5h5M18.5 7v5"/>',
  jeune: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  mariage: '<circle cx="9" cy="14.5" r="4.5"/><circle cx="15" cy="14.5" r="4.5"/><path d="m10.2 6.5 1.8-3 1.8 3z"/>',
  bebe: '<circle cx="12" cy="12" r="8.5"/><path d="M9 10.5h.01M15 10.5h.01"/><path d="M9.5 14.5c.7.8 1.5 1.2 2.5 1.2s1.8-.4 2.5-1.2"/>',
  deces: '<path d="M8 21V8a4 4 0 0 1 8 0v13z"/><path d="M12 6.5V4M10.5 5.2h3"/><path d="M5 21h14"/>',
  cimetiere: '<path d="M7 21V10a5 5 0 0 1 10 0v11z"/><path d="M12 8v7M9.5 11h5"/><path d="M4 21h16"/>',
  ecole: '<path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="M6.5 10.5V16c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-5.5"/><path d="M21.5 8v5.5"/>',
  loisirs: '<circle cx="12" cy="12" r="8.5"/><path d="m12 5.5 4.5 3.3-1.7 5.3H9.2L7.5 8.8z"/>',
  travaux: '<path d="M3 20.5h18"/><path d="M5.5 20.5V11l6.5-4.5 6.5 4.5v9.5"/><path d="M10 20.5v-5h4v5"/>',
  terrain: '<path d="m3 8 6-3.5 6 3.5 6-3.5v11L15 19 9 15.5 3 19z"/><path d="M9 4.5v11M15 8v11"/>',
  carte: '<path d="m3 7 6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>',
  encombrant: '<path d="M4 9.5h16l-1.2 10.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M2.5 6.5h19M9 6.5V4.2c0-.6.5-1.2 1.2-1.2h3.6c.7 0 1.2.6 1.2 1.2v2.3"/><path d="M10 13v4M14 13v4"/>',
  badge: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="2.6"/><path d="M7.5 17.5c.9-1.7 2.6-2.6 4.5-2.6s3.6.9 4.5 2.6"/>',
  vegetal: '<path d="M12 21c0-6 3-11 9-12-1 6.5-4 9.5-9 10.5"/><path d="M12 21C10 15.5 7 12.5 3 11.5c1 5 4 7.5 9 8.5"/><path d="M12 21v-4"/>',
  feu: '<path d="M12 21c3.6 0 6.5-2.7 6.5-6 0-4.5-4-6-4-10-3 1.5-5 4-5 7 0 1-.5 1.8-1.3 1.8S7 12.8 7 11.5c-1 1.2-1.5 2.4-1.5 3.5 0 3.3 2.9 6 6.5 6z"/>',
  salle: '<path d="M3 20.5V9l9-6 9 6v11.5"/><path d="M3 20.5h18"/><path d="M9.5 20.5v-6h5v6"/>',
  association: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2.5 19.5c0-3 2.4-5 5.5-5s5.5 2 5.5 5M14 15c2.7.3 4.7 2.2 4.7 4.5"/>',
  livre: '<path d="M4 4.5h6a2.5 2.5 0 0 1 2 1 2.5 2.5 0 0 1 2-1h6v14h-6a2.5 2.5 0 0 0-2 1 2.5 2.5 0 0 0-2-1H4z"/><path d="M12 5.5v14"/>',
  chien: '<path d="M4.5 8.5 6 4l3 2.5h6L18 4l1.5 4.5V13c0 4-3 7-7.5 7S4.5 17 4.5 13z"/><path d="M9.5 11.5h.01M14.5 11.5h.01M10.5 15.5h3"/>',
  nature: '<path d="M12 20.5v-6"/><path d="M12 14.5c-4.5 0-7-2.5-7.5-7 4.5.5 7 3 7.5 7z"/><path d="M12 14.5c.5-4.5 3-7.5 7.5-8-.5 5-3 8-7.5 8z"/>',
  mairie: '<path d="M3 20.5h18M4.5 20.5V10h15v10.5"/><path d="m12 3 8 5.5H4z"/><path d="M9 20.5v-5.5h6v5.5"/>',
  accueil: '<path d="M3 11 12 3.5 21 11"/><path d="M5.5 9.5v11h13v-11"/><path d="M9.5 20.5V14h5v6.5"/>',
  pacs: '<path d="M12 20.5S4 15.6 4 10.2A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 8 2.2c0 5.4-8 10.3-8 10.3z"/>',
  commerce: '<path d="M6.5 8h11l1 12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5.5 20z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',

  recherche: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  menu: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
  fermer: '<path d="m5.5 5.5 13 13M18.5 5.5l-13 13"/>',
  telephone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
  courriel: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 6.5L21 7"/>',
  lieu: '<path d="M12 21.5s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10.5" r="2.8"/>',
  horloge: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.3l3.3 2"/>',
  fleche: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  externe: '<path d="M13.5 4.5H19v5.5"/><path d="m19 4.5-8 8"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  alerte: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 9.5v5M12 17.2h.01"/>',
  chevron: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  telecharger: '<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
  accessibilite: '<circle cx="12" cy="4.5" r="1.8"/><path d="M4.5 8.5c2.4.9 4.9 1.4 7.5 1.4s5.1-.5 7.5-1.4"/><path d="M12 9.9v4.6M12 14.5l-2.5 6M12 14.5l2.5 6"/>',
  meteorite: '<path d="M4 7.5 6.8 10M3 12l2.3 1"/><path d="M9.3 14.7c-2-3.2.6-7 4.3-6.4a5.1 5.1 0 0 1 5.3 5.3c.3 3.6-2.5 6.4-5.9 6.4-2.1 0-4.5-1.9-3.7-5.3z"/><path d="M11.3 13.5h.01M15 15.2h.01"/>'
};

// Les icônes sont référencées, pas recopiées : chaque page ne porte qu'une
// seule définition par icône, rassemblée en fin de document par le générateur.
// Sur une page comme les comptes-rendus du conseil, cela économise 15 ko.
export function icone(nom, classe = '') {
  const cle = P[nom] ? nom : 'document';
  return `<svg class="icone${classe ? ' ' + classe : ''}" width="24" height="24" aria-hidden="true" focusable="false"><use href="#i-${cle}"/></svg>`;
}

// Construit le sprite ne contenant que les icônes réellement utilisées dans le HTML.
export function sprite(html) {
  const utilisees = [...new Set([...html.matchAll(/href="#i-([\w-]+)"/g)].map((m) => m[1]))].filter((n) => P[n]);
  if (!utilisees.length) return '';
  const symboles = utilisees.map((n) => `<symbol id="i-${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${P[n]}</symbol>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="sprite" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">${symboles}</svg>`;
}

export const iconesDisponibles = Object.keys(P);
