/**
 * Sections de la nomenclature d'activités française (NAF rév. 2, Insee),
 * pour regrouper et filtrer l'annuaire Sirene de la page « Acteurs
 * économiques » (voir src/templates/views.mjs, pageProfessionnels). Une
 * section regroupe des divisions, les deux premiers chiffres du code NAF :
 * « 43.21A » appartient à la division 43, donc à la section F.
 *
 * "titre" : l'intitulé officiel de la section ; "court" : le libellé des
 * pastilles du filtre, qui doivent rester lisibles sur un téléphone.
 */
export const SECTIONS_NAF = [
  { lettre: 'A', divisions: [1, 3], titre: 'Agriculture, sylviculture et pêche', court: 'Agriculture' },
  { lettre: 'B', divisions: [5, 9], titre: 'Industries extractives', court: 'Industries extractives' },
  { lettre: 'C', divisions: [10, 33], titre: 'Industrie manufacturière', court: 'Industrie' },
  { lettre: 'D', divisions: [35, 35], titre: "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné", court: 'Énergie' },
  { lettre: 'E', divisions: [36, 39], titre: "Production et distribution d'eau ; assainissement, gestion des déchets et dépollution", court: 'Eau et déchets' },
  { lettre: 'F', divisions: [41, 43], titre: 'Construction', court: 'Construction' },
  { lettre: 'G', divisions: [45, 47], titre: "Commerce ; réparation d'automobiles et de motocycles", court: 'Commerce' },
  { lettre: 'H', divisions: [49, 53], titre: 'Transports et entreposage', court: 'Transports' },
  { lettre: 'I', divisions: [55, 56], titre: 'Hébergement et restauration', court: 'Hébergement et restauration' },
  { lettre: 'J', divisions: [58, 63], titre: 'Information et communication', court: 'Information et communication' },
  { lettre: 'K', divisions: [64, 66], titre: "Activités financières et d'assurance", court: 'Finance et assurance' },
  { lettre: 'L', divisions: [68, 68], titre: 'Activités immobilières', court: 'Immobilier' },
  { lettre: 'M', divisions: [69, 75], titre: 'Activités spécialisées, scientifiques et techniques', court: 'Activités spécialisées et techniques' },
  { lettre: 'N', divisions: [77, 82], titre: 'Activités de services administratifs et de soutien', court: 'Services administratifs et de soutien' },
  { lettre: 'O', divisions: [84, 84], titre: 'Administration publique', court: 'Administration publique' },
  { lettre: 'P', divisions: [85, 85], titre: 'Enseignement', court: 'Enseignement' },
  { lettre: 'Q', divisions: [86, 88], titre: 'Santé humaine et action sociale', court: 'Santé et action sociale' },
  { lettre: 'R', divisions: [90, 93], titre: 'Arts, spectacles et activités récréatives', court: 'Arts, spectacles et loisirs' },
  { lettre: 'S', divisions: [94, 96], titre: 'Autres activités de services', court: 'Autres services' },
  { lettre: 'T', divisions: [97, 98], titre: "Activités des ménages en tant qu'employeurs ; activités indifférenciées des ménages en tant que producteurs de biens et services pour usage propre", court: 'Ménages employeurs' },
  { lettre: 'U', divisions: [99, 99], titre: 'Activités extra-territoriales', court: 'Activités extra-territoriales' },
];

/** Section d'un code NAF (« 43.21A » → section F), ou null s'il est absent ou inconnu. */
export function sectionNaf(code) {
  const division = parseInt(String(code || '').slice(0, 2), 10);
  if (!Number.isFinite(division)) return null;
  return SECTIONS_NAF.find((s) => division >= s.divisions[0] && division <= s.divisions[1]) || null;
}

/**
 * Regroupe des établissements par section, dans l'ordre des lettres, en ne
 * gardant que les sections qui en comptent au moins un. Un établissement
 * sans code NAF exploitable rejoint un dernier groupe « Activité non
 * précisée » (lettre null), pour ne jamais disparaître de la liste.
 */
export function grouperParSectionNaf(etablissements) {
  const groupes = SECTIONS_NAF
    .map((section) => ({ section, etablissements: etablissements.filter((e) => sectionNaf(e.naf) === section) }))
    .filter((g) => g.etablissements.length);
  const sansSection = etablissements.filter((e) => !sectionNaf(e.naf));
  if (sansSection.length) {
    groupes.push({ section: { lettre: null, titre: 'Activité non précisée', court: 'Non précisée' }, etablissements: sansSection });
  }
  return groupes;
}
