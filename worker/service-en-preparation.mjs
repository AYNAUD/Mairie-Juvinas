/* =====================================================================
   Abonnement aux actualités et désabonnement : les formulaires de
   /vie-locale/abonnement.html et le vote des consultations citoyennes
   envoient ici. Le service d'envoi de courriels de Lecques (inscription
   confirmée, lien de désabonnement, Brevo) et le vote en ligne ne sont pas
   portés à Juvinas : le Worker répond donc une page qui le dit, sans lire,
   garder ni transmettre ce qui a été saisi (adresse, vote, commentaire).

   La réponse est une page complète (le formulaire est un envoi classique,
   il fonctionne sans JavaScript). Elle ne charge rien d'extérieur.
   ===================================================================== */

export const MESSAGE_SERVICE_EN_PREPARATION = 'Service en cours de préparation, merci pour votre attente !';

// Le lien de retour n'est proposé que vers un site de la mairie : jamais
// vers une adresse arbitraire fournie par l'appelant.
const SITES_AUTORISES = ['https://aynaud.github.io', 'https://www.juvinas.fr'];

function adresseRetour(request) {
  try {
    const referent = new URL(request.headers.get('Referer') || '');
    if (SITES_AUTORISES.includes(referent.origin)) return referent.href;
  } catch { /* pas de référent exploitable */ }
  return SITES_AUTORISES[0];
}

const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const DETAIL_ABONNEMENT = "Votre adresse n'a pas été enregistrée. Les actualités de la mairie restent consultables sur le site.";
export const DETAIL_VOTE = "Votre réponse n'a pas été enregistrée. La consultation reste lisible sur le site.";

export function pageServiceEnPreparation(request, detail = DETAIL_ABONNEMENT) {
  const retour = adresseRetour(request);
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Service en cours de préparation — Mairie de Juvinas</title>
<style>
  body { margin: 0; font: 1.125rem/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: #2b2118; background: #f7f5ef; }
  main { max-width: 34rem; margin: 0 auto; padding: 4rem 1rem; }
  h1 { font-size: 1.5rem; line-height: 1.3; margin: 0 0 1rem; }
  p { margin: 0 0 1.5rem; }
  a { display: inline-block; min-height: 44px; box-sizing: border-box; padding: .6rem 1.2rem; border-radius: .5rem; background: #5b3a21; color: #fff; text-decoration: none; font-weight: 600; }
  a:focus-visible { outline: 3px solid #2b2118; outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <h1>${echapper(MESSAGE_SERVICE_EN_PREPARATION)}</h1>
  <p>${echapper(detail)}</p>
  <a href="${echapper(retour)}">Revenir au site</a>
</main>
</body>
</html>
`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
