/* Test local du Worker : fonctions pures (sans réseau) puis, avec --direct,
   appel réel des API publiques à travers le routeur (cache simulé).
   Usage : node worker/test-local.mjs [--direct] */
import assert from 'node:assert/strict';
import worker from './index.mjs';
import { resumerObservations, resumerVigilance, resumerSituation, resumerRestrictions, STATIONS_RIVIERES } from './donnees-publiques.mjs';

let n = 0;
const ok = (nom, f) => { f(); n++; console.log(`  ✓ ${nom}`); };

console.log('\nFonctions pures\n');
const t0 = Date.parse('2026-10-28T10:00:00Z');
const obs = (code, h3, h0) => [
  { code_station: code, date_obs: new Date(t0 - 3 * 3600e3).toISOString(), resultat_obs: h3 },
  { code_station: code, date_obs: new Date(t0).toISOString(), resultat_obs: h0 },
];

ok('une hausse de 1,2 m en 3 h déclenche l\'alerte orange', () => {
  const stations = resumerObservations([...obs('V501521001', 400, 1600), ...obs('V501403001', 500, 520)]);
  const s = resumerSituation({ vigilance: { disponible: true, niveau: 1 }, rivieres: { disponible: true, stations } });
  assert.equal(s.niveau, 3);
  assert.deepEqual(s.rivieres.montees, ['V501521001']);
  assert.match(s.phrases[0], /La Volane monte vite à Vals-les-Bains/);
});
ok('niveaux stables : rien à signaler', () => {
  const stations = resumerObservations([...obs('V501521001', 400, 410), ...obs('V501403001', 500, 505)]);
  const s = resumerSituation({ vigilance: { disponible: true, niveau: 1 }, rivieres: { disponible: true, stations } });
  assert.equal(s.niveau, 0);
  assert.equal(s.phrases.length, 0);
});
ok('une source en panne n\'est pas un retour au calme', () => {
  const s = resumerSituation({ vigilance: { disponible: false }, rivieres: { disponible: false, stations: [] } });
  assert.deepEqual(s.sources, { meteo: false, rivieres: false });
});
const alerte = (zone, niveau) => ({ alert: { status: 'Actual', msgType: 'Alert', sent: '2026-10-28T08:00:00Z', info: [{ language: 'fr-FR', event: 'Vigilance orange pluie-inondation', onset: '2026-10-28T06:00:00Z', expires: '2026-10-29T06:00:00Z', parameter: [{ valueName: 'awareness_level', value: `${niveau}; ${niveau === 3 ? 'orange' : 'rouge'}` }, { valueName: 'awareness_type', value: '5; Rain-Flood' }], area: [{ geocode: [{ value: zone }] }] }] } });
ok('la vigilance ne retient que l\'Ardèche (FR712)', () => {
  const maintenant = new Date('2026-10-28T10:00:00Z');
  assert.equal(resumerVigilance([alerte('FR712', 3)], maintenant).niveau, 3);
  assert.equal(resumerVigilance([alerte('FR812', 3)], maintenant).niveau, 1);
});
ok('aucune restriction d\'eau : niveau nul', () => assert.equal(resumerRestrictions([]).niveau, null));
ok('deux stations suivies, codes uniques', () => assert.equal(new Set(STATIONS_RIVIERES.map((s) => s.code)).size, 2));


{
  const r = await worker.fetch(new Request('https://x.test/abonnement', { method: 'POST', headers: { Referer: 'https://aynaud.github.io/Mairie-Juvinas/vie-locale/abonnement.html' }, body: new URLSearchParams({ email: 'a@b.fr' }) }), {}, {});
  const t = await r.text();
  assert.equal(r.status, 200);
  assert.match(r.headers.get('Content-Type'), /text\/html/);
  assert.ok(t.includes('Service en cours de préparation, merci pour votre attente !'));
  assert.ok(!t.includes('a@b.fr'), "l'adresse saisie ne doit pas être renvoyée");
  assert.ok(t.includes('href="https://aynaud.github.io/Mairie-Juvinas/vie-locale/abonnement.html"'));
  const d = await worker.fetch(new Request('https://x.test/desabonnement', { method: 'POST', headers: { Referer: 'https://exemple.evil/x' } }), {}, {});
  assert.ok((await d.text()).includes('href="https://aynaud.github.io"'), 'retour limité aux sites de la mairie');
  assert.equal((await worker.fetch(new Request('https://x.test/abonnement'), {}, {})).status, 404);
  const v = await worker.fetch(new Request('https://x.test/consultation/piscine-2026/voter', { method: 'POST', body: new URLSearchParams({ optionId: 'oui', commentaire: 'secret' }) }), {}, {});
  const tv = await v.text();
  assert.equal(v.status, 200);
  assert.ok(tv.includes('Service en cours de préparation, merci pour votre attente !'));
  assert.ok(tv.includes("Votre réponse n'a pas été enregistrée") && !tv.includes('secret'));
  const res = await worker.fetch(new Request('https://x.test/consultation/piscine-2026/resultats'), {}, {});
  assert.deepEqual(await res.json(), { total: 0, options: [] });
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  n += 6; console.log('  ✓ POST /abonnement, /desabonnement et vote : message, retour limité aux sites de la mairie, GET refusé');
}

if (process.argv.includes('--direct')) {
  console.log('\nAPI réelles (via le routeur)\n');
  const magasin = new Map();
  globalThis.caches = { default: { match: async (r) => magasin.get(r.url), put: async (r, rep) => { magasin.set(r.url, rep); } } };
  const ctx = { waitUntil: () => {} };
  for (const [chemin, controle] of [
    ['/situation', (d) => typeof d.niveau === 'number'],
    ['/vidourle', (d) => d.stations.length === 2],
    ['/eau/restrictions', (d) => 'niveau' in d],
    ['/eau/qualite', (d) => 'reseaux' in d || d.disponible === false],
    ['/risques/adresse?q=35 route de la Mairie', (d) => d.trouve === true],
  ]) {
    const r = await worker.fetch(new Request(`https://x.test${chemin}`), {}, ctx);
    const d = await r.json();
    assert.equal(r.status, 200, chemin);
    assert.ok(controle(d), `${chemin} : ${JSON.stringify(d).slice(0, 200)}`);
    n++;
    console.log(`  ✓ ${chemin} → ${JSON.stringify(d).slice(0, 110)}…`);
  }
  assert.equal((await worker.fetch(new Request('https://x.test/inconnu'), {}, ctx)).status, 404);
  assert.equal((await worker.fetch(new Request('https://x.test/situation', { method: 'POST' }), {}, ctx)).status, 404);
}
console.log(`\n${n} contrôle(s) réussi(s)\n`);
