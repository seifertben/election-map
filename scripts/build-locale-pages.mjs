import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const origin = 'https://www.mapelection.com';
const pages = [
  { code: 'en', path: '/', title: '2026 Election Mapper', description: 'Build your own 2026 election maps for the Senate, House, and governors. Compare race ratings and polls, then share your prediction.', intro: 'Explore the 2026 United States Senate, House, and governor elections. Build and share your own interactive election map, compare race ratings and polls, and project which party wins each seat. The presidential map shows the 2024 results as a starting point.', og: 'en_US' },
  { code: 'es', path: '/es/', title: 'Mapa electoral de Estados Unidos 2026', description: 'Crea tu mapa de las elecciones de Estados Unidos de 2026 al Senado, la Cámara y las gobernaciones. Consulta encuestas y pronósticos y comparte tus predicciones.', intro: 'Explora las elecciones de Estados Unidos de 2026 al Senado, la Cámara de Representantes y las gobernaciones. Crea y comparte un mapa electoral interactivo, compara encuestas y pronósticos y proyecta qué partido ganará cada escaño. El mapa presidencial parte de los resultados de 2024.', og: 'es_ES' },
  { code: 'fr', path: '/fr/', title: 'Carte des élections américaines de 2026', description: 'Créez votre carte des élections américaines de 2026 au Sénat, à la Chambre et aux postes de gouverneur. Comparez sondages et prévisions, puis partagez vos pronostics.', intro: 'Explorez les élections américaines de 2026 au Sénat, à la Chambre des représentants et aux postes de gouverneur. Créez et partagez une carte électorale interactive, comparez les sondages et les prévisions et projetez le résultat de chaque siège. La carte présidentielle part des résultats de 2024.', og: 'fr_FR' },
  { code: 'de', path: '/de/', title: 'Wahlkarte USA 2026', description: 'Erstelle deine eigene Karte für die US-Wahlen 2026 zum Senat, Repräsentantenhaus und zu den Gouverneursämtern. Vergleiche Umfragen und Prognosen und teile deine Vorhersage.', intro: 'Entdecke die US-Wahlen 2026 zum Senat, Repräsentantenhaus und zu den Gouverneursämtern. Erstelle und teile eine interaktive Wahlkarte, vergleiche Umfragen und Prognosen und schätze ab, welche Partei die einzelnen Sitze gewinnt. Die Präsidentschaftskarte zeigt als Ausgangspunkt die Ergebnisse von 2024.', og: 'de_DE' },
  { code: 'pt-BR', path: '/pt-br/', title: 'Mapa das eleições dos Estados Unidos de 2026', description: 'Crie seu mapa das eleições dos Estados Unidos de 2026 para o Senado, a Câmara e os governos estaduais. Compare pesquisas e projeções e compartilhe sua previsão.', intro: 'Explore as eleições dos Estados Unidos de 2026 para o Senado, a Câmara dos Representantes e os governos estaduais. Crie e compartilhe um mapa eleitoral interativo, compare pesquisas e projeções e estime qual partido vencerá cada cadeira. O mapa presidencial parte dos resultados de 2024.', og: 'pt_BR' },
];
const template = readFileSync('index.html', 'utf8');
function escapeHtml(value) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'); }
for (const page of pages.slice(1)) {
  let html = template.replace('<html lang="en">', `<html lang="${page.code}">`)
    .replace('<title>2026 Election Mapper</title>', `<title>${escapeHtml(page.title)}</title>`)
    .replace('<link rel="canonical" href="https://www.mapelection.com/" />', `<link rel="canonical" href="${origin}${page.path}" />`)
    .replace(/content="Build your own 2026 election maps for the Senate, House, and governors\. Compare race ratings and polls, then share your prediction\."/, `content="${escapeHtml(page.description)}"`)
    .replace('<meta property="og:locale" content="en_US" />', `<meta property="og:locale" content="${page.og}" />`)
    .replace('<meta property="og:title" content="2026 Election Mapper" />', `<meta property="og:title" content="${escapeHtml(page.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(page.description)}" />`)
    .replace('<meta property="og:url" content="https://www.mapelection.com/" />', `<meta property="og:url" content="${origin}${page.path}" />`)
    .replace(/<div id="root">.*?<\/div>/s, `<div id="root"><main class="site-intro"><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.intro)}</p></main></div>`);
  const dir = page.path.slice(1, -1);
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, html);
}
const alternates = pages.map(p => `      <xhtml:link rel="alternate" hreflang="${p.code}" href="${origin}${p.path}" />`).concat(`      <xhtml:link rel="alternate" hreflang="x-default" href="${origin}/" />`).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${pages.map(p => `  <url>\n    <loc>${origin}${p.path}</loc>\n${alternates}\n  </url>`).join('\n')}\n</urlset>\n`;
writeFileSync('public/sitemap.xml', sitemap);
