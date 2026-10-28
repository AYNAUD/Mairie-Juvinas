# Worker « données en direct »

Seul composant serveur du dépôt. C'est un **Cloudflare Worker** public, en lecture seule,
**sans secret, sans base de données, sans compte tiers** : il interroge des API ouvertes de
l'État pour le compte du site (le navigateur du visiteur n'appelle jamais un service tiers,
règle « zéro requête tierce ») et met les réponses en cache.

| Route | Rôle | Source | Cache |
|---|---|---|---|
| `/situation` | bandeau de l'accueil : vigilance météo orange/rouge, rivière qui monte vite | MeteoAlarm + Hub'Eau | 10 min |
| `/meteo/vigilance` | vigilance météo de l'Ardèche (zone `FR712`) | MeteoAlarm (relais de Météo-France) | 10 min |
| `/vidourle` | hauteur des rivières voisines (page Risques) | Hub'Eau, réseau Vigicrues | 10 min |
| `/eau/restrictions` | restrictions sécheresse en vigueur (page Eau) | VigiEau | 3 h |
| `/eau/qualite` | contrôle sanitaire de l'eau du robinet (page Eau) | Hub'Eau, ARS | 12 h |
| `/risques/adresse?q=…` | « Les risques à mon adresse » (page Risques) | IGN, Géoportail de l'urbanisme, Géorisques | jamais |

La route `/vidourle` garde son nom : c'est celui que le moteur partagé avec Lecques
(`src/scripts/vidourle.js`) interroge. Elle sert ici les rivières de Juvinas.

**Aucune station ne mesure la Bézorgues.** Les deux stations Vigicrues en service les plus
proches (vérifié le 28 octobre 2026) sont la Volane à Vals-les-Bains (dans laquelle la
Bézorgues se jette) et l'Ardèche à Ucel, en aval. Elles sont déclarées à deux endroits, à garder
identiques : `STATIONS_RIVIERES` dans `donnees-publiques.mjs` et `riviere.stations` dans
`content/site.json`. Le site l'écrit tel quel (« Les rivières voisines en direct ») : il ne
présente jamais ces hauteurs comme celles de la Bézorgues.

## Ce qui n'est pas porté de Lecques

L'administration par email (publication d'actualités et de documents), les abonnements aux
actualités, le vote en ligne et les alertes par courriel. Ils demandent un jeton GitHub, un
compte Brevo, un sous-domaine de réception d'emails et des bases KV : voir `CLAUDE.md`.
Le formulaire d'abonnement et le vote restent donc inertes.

## Déployer (une fois)

Il faut un compte Cloudflare (gratuit suffit) ; rien d'autre. Depuis la racine du dépôt :

```bash
npx wrangler login
npx wrangler deploy --config worker/wrangler.toml
```

Wrangler affiche l'adresse du Worker, du type
`https://mairie-juvinas-donnees.<votre-compte>.workers.dev`. La reporter, sans barre finale,
dans `content/site.json` → `administration.urlBase`, puis `npm run check` et publier le site.
Tant que `urlBase` se termine par `.invalid`, le site n'émet aucune requête vers le Worker et
les widgets restent des liens vers les services officiels.

Mises à jour : relancer la deuxième commande (`npm run worker:deploy`).

## Tester

```bash
npm run worker:test          # fonctions pures, sans réseau
node worker/test-local.mjs --direct   # + appel réel des API à travers le routeur
```
