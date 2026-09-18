/* Serveur de prévisualisation local. Aucune dépendance. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.pdf': 'application/pdf',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

createServer(async (req, res) => {
  let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (chemin.endsWith('/')) chemin += 'index.html';
  let fichier = join(DIST, chemin);

  try {
    const s = await stat(fichier);
    if (s.isDirectory()) fichier = join(fichier, 'index.html');
  } catch {
    try {
      const corps = await readFile(join(DIST, '404.html'));
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      return res.end(corps);
    } catch {
      res.writeHead(404); return res.end('404');
    }
  }

  try {
    const corps = await readFile(fichier);
    res.writeHead(200, { 'content-type': TYPES[extname(fichier)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(corps);
  } catch (err) {
    res.writeHead(500); res.end(String(err));
  }
}).listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  Aperçu du site : ${url}\n  Ctrl+C pour arrêter.\n`);

  // Ouvre le navigateur par défaut, sauf désactivation explicite (utile en CI).
  if (!process.env.NO_OPEN) {
    const commande = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
    exec(`${commande} ${url}`, () => {});
  }
});
