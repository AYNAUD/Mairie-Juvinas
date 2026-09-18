// Rendu Markdown minimal, suffisant pour les pages du site : titres, paragraphes,
// listes, citations, liens, gras, italique, séparateurs. Aucune dépendance.

export function echapper(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function enLigne(t) {
  return echapper(t)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, texte, lien) => {
      const externe = /^https?:\/\//.test(lien);
      const attrs = externe ? ' class="lien-externe" rel="noopener"' : '';
      const suffixe = externe ? '<span class="sr-only"> (nouvelle fenêtre)</span>' : '';
      return `<a href="${lien}"${attrs}${externe ? ' target="_blank"' : ''}>${texte}${suffixe}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function frontMatter(source) {
  const m = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, corps: source };
  const meta = {};
  for (const ligne of m[1].split('\n')) {
    const p = ligne.indexOf(':');
    if (p < 0) continue;
    const cle = ligne.slice(0, p).trim();
    let val = ligne.slice(p + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((v) => v.trim()).filter(Boolean);
    } else if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (/^\d+$/.test(val)) val = Number(val);
    meta[cle] = val;
  }
  return { meta, corps: source.slice(m[0].length) };
}

export function ancre(texte) {
  return String(texte)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['’]/g, '-').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Rend le corps Markdown et renvoie { html, sommaire } — le sommaire liste les titres de niveau 2.
export function rendre(md) {
  const lignes = md.split('\n');
  const sortie = [];
  const sommaire = [];
  let listeOuverte = null;
  let paragraphe = [];

  const viderParagraphe = () => {
    if (paragraphe.length) {
      sortie.push(`<p>${enLigne(paragraphe.join(' '))}</p>`);
      paragraphe = [];
    }
  };
  const fermerListe = () => {
    if (listeOuverte) { sortie.push(`</${listeOuverte}>`); listeOuverte = null; }
  };

  for (const brute of lignes) {
    const l = brute.trimEnd();

    if (!l.trim()) { viderParagraphe(); fermerListe(); continue; }

    const titre = l.match(/^(#{2,4})\s+(.*)$/);
    if (titre) {
      viderParagraphe(); fermerListe();
      const niveau = titre[1].length;
      const texte = titre[2];
      const id = ancre(texte);
      if (niveau === 2) sommaire.push({ id, texte });
      sortie.push(`<h${niveau} id="${id}">${enLigne(texte)}</h${niveau}>`);
      continue;
    }

    if (/^---+$/.test(l)) { viderParagraphe(); fermerListe(); sortie.push('<hr>'); continue; }

    const cit = l.match(/^>\s?(.*)$/);
    if (cit) {
      viderParagraphe(); fermerListe();
      sortie.push(`<blockquote><p>${enLigne(cit[1])}</p></blockquote>`);
      continue;
    }

    const puce = l.match(/^[-*]\s+(.*)$/);
    const num = l.match(/^\d+[.)]\s+(.*)$/);
    if (puce || num) {
      viderParagraphe();
      const type = puce ? 'ul' : 'ol';
      if (listeOuverte !== type) { fermerListe(); sortie.push(`<${type}>`); listeOuverte = type; }
      sortie.push(`<li>${enLigne((puce || num)[1])}</li>`);
      continue;
    }

    fermerListe();
    paragraphe.push(l.trim());
  }
  viderParagraphe(); fermerListe();

  // Fusionne les citations consécutives (utile pour les citations sur deux lignes).
  const html = sortie.join('\n').replace(/<\/blockquote>\n<blockquote>/g, '\n');
  return { html, sommaire };
}

// Retire tout le balisage : sert à alimenter l'index de recherche.
export function texteBrut(md) {
  return md
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
