// Mise en forme du texte d'une actualité (champ « corps ») : paragraphes,
// retours à la ligne, listes à puces, gras, italique et liens — rien d'autre
// (ni intertitres, ni souligné, ni couleurs : voir la barre de mise en forme
// des formulaires d'administration, worker/formulaire.mjs).
//
//   **gras**   *italique*   - élément de liste   [texte](https://…)
//
// Une seule règle pour tous ceux qui affichent ce texte, pour qu'ils
// montrent la même chose : la page de l'actualité (src/templates/views.mjs),
// les courriels aux abonnés et aux valideurs (worker/courriels-html.mjs,
// worker/messages.mjs) et l'aperçu en direct du formulaire
// d'administration (worker/formulaire.mjs).
//
// Ces formulaires recopient le code de texteActualiteEnHtml tel quel dans
// leur page (texteActualiteEnHtml.toString()) : cette fonction doit rester
// autonome — aucune variable ni fonction extérieure, et une syntaxe que
// comprennent tous les navigateurs.
//
// Le texte vient des auteurs, pas seulement de la mairie : tout est échappé,
// et seuls les liens https://, http://, mailto: et tel: deviennent des liens
// (un lien interne « /… » mal tapé ferait échouer les contrôles du site et
// bloquerait sa mise en ligne). Un lien refusé reste affiché tel quel.

/**
 * Texte d'une actualité → HTML. Options, toutes facultatives (sans elles,
 * rendu de l'aperçu des formulaires) :
 *   lien(url, html)     construit un lien (url brute, texte déjà en HTML) ;
 *   paragraphe(html)    enveloppe un paragraphe ;
 *   liste(elementsHtml) enveloppe une liste à puces ;
 *   enBlocs             renvoie la liste des blocs plutôt qu'une chaîne.
 */
export function texteActualiteEnHtml(texte, options) {
  var o = options || {};
  var LIEN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  var SCHEMA_ACCEPTE = /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+0-9 .()-]+)$/i;

  function echapper(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function styler(html) {
    return html
      .replace(/\*\*([^*\s](?:[^*\n]*[^*\s])?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\s](?:[^*\n]*[^*\s])?)\*/g, '<em>$1</em>');
  }
  function lien(url, html) {
    if (o.lien) return o.lien(url, html);
    return '<a href="' + echapper(url) + '" target="_blank" rel="noopener">' + html + '</a>';
  }
  // Les liens sont mis de côté avant le gras et l'italique : un astérisque
  // dans une adresse ne doit rien mettre en forme, et « **[texte](url)** »
  // doit donner un lien en gras.
  function enLigne(brut) {
    var liens = [];
    var sansLiens = brut.replace(LIEN, function (tout, libelle, url) {
      if (!SCHEMA_ACCEPTE.test(url)) return tout;
      liens.push(lien(url, styler(echapper(libelle))));
      return '\u0001' + (liens.length - 1) + '\u0002';
    });
    return styler(echapper(sansLiens)).replace(/\u0001(\d+)\u0002/g, function (tout, i) {
      return liens[Number(i)];
    });
  }

  var blocs = [];
  var paragraphe = [];
  var liste = [];
  function viderParagraphe() {
    if (!paragraphe.length) return;
    var html = paragraphe.map(enLigne).join('<br>');
    blocs.push(o.paragraphe ? o.paragraphe(html) : '<p>' + html + '</p>');
    paragraphe = [];
  }
  function viderListe() {
    if (!liste.length) return;
    var elements = liste.map(enLigne);
    blocs.push(o.liste ? o.liste(elements)
      : '<ul>' + elements.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>');
    liste = [];
  }

  String(texte || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (brute) {
    var ligne = brute.trim();
    if (!ligne) { viderParagraphe(); viderListe(); return; }
    var puce = /^[-•*]\s+(.+)$/.exec(ligne);
    if (puce) { viderParagraphe(); liste.push(puce[1]); return; }
    viderListe();
    paragraphe.push(ligne);
  });
  viderParagraphe();
  viderListe();
  return o.enBlocs ? blocs : blocs.join('\n');
}

/** Texte d'une actualité sans ses repères, pour les courriels en texte
 *  seul : gras et italique retirés, puces « • », liens « texte (adresse) ». */
export function texteActualiteEnClair(texte) {
  // Adresses mises de côté, comme dans texteActualiteEnHtml : un astérisque
  // dans une adresse ne doit pas être pris pour de l'italique.
  const adresses = [];
  const sansRepere = (s) => s
    .replace(/\*\*([^*\s](?:[^*\n]*[^*\s])?)\*\*/g, '$1')
    .replace(/\*([^*\s](?:[^*\n]*[^*\s])?)\*/g, '$1');
  return sansRepere(String(texte || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (tout, libelle, url) => {
      if (!/^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+0-9 .()-]+)$/i.test(url)) return tout;
      const adresse = url.replace(/^(mailto|tel):/i, '');
      adresses.push(adresse);
      const repere = `\u0001${adresses.length - 1}\u0002`;
      return sansRepere(libelle) === adresse ? repere : `${libelle} (${repere})`;
    }))
    .replace(/\u0001(\d+)\u0002/g, (tout, i) => adresses[Number(i)])
    .replace(/^[ \t]*[-•*][ \t]+/gm, '• ');
}
