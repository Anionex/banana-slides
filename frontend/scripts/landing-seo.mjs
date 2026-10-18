import { build } from 'vite';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
if (process.env.VITE_PUBLIC_LANDING !== 'true') process.exit(0);
const temporary = path.resolve('.landing-ssr');
try {
  await build({ build: { ssr: 'src/landing/prerender.tsx', outDir: temporary, emptyOutDir: true }, logLevel: 'error' });
  const { render, decks, landingSeo, siteUrl, structuredData } = await import(pathToFileURL(path.join(temporary, 'prerender.js')));
  await Promise.all(['cover.png','cover-en.png'].map(file=>readFile('public/social/'+file))); // Fail the build if the advertised cover is missing.
  const template = await readFile('dist/index.html', 'utf8');
  const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
  const styles = new Set();
  const collect = key => { const entry = manifest[key]; if (!entry) return; entry.css?.forEach(css => styles.add(css)); entry.imports?.forEach(collect); };
  collect('src/main.tsx'); collect('src/landing/Landing.tsx'); collect('src/landing/gallery/Gallery.tsx'); collect('src/landing/gallery/DeckDetail.tsx');
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const routes = ['zh', 'en'].flatMap(language => [{ language, gallery: false }, { language, gallery: true }, ...decks.map(deck => ({ language, gallery: true, deck }))]);
  const paths = [];
  for (const { language, gallery, deck } of routes) {
    const pagePath = lang => `${lang === 'en' ? '/en' : ''}${gallery ? `/gallery/${deck ? `${deck.id}/` : ''}` : '/'}`;
    const seo = deck ? { ...landingSeo[language], path: pagePath(language), title: `${deck.title[language]} | Banana Slides`, description: `${deck.title[language]} · ${deck.appearance[language]}` }
      : gallery ? { ...landingSeo[language], path: pagePath(language), title: language === 'zh' ? '作品画廊 | Banana Slides' : 'Presentation gallery | Banana Slides', description: language === 'zh' ? '使用 Banana Slides 制作的幻灯片，可按风格和用途筛选。' : 'Presentations made with Banana Slides. Filter by style and use case.' } : landingSeo[language];
    paths.push(seo.path);
    const url = siteUrl + seo.path;
    const cover = deck ? `${siteUrl}/gallery/${deck.id}/1.webp` : `${siteUrl}/social/cover${language === 'en' ? '-en' : ''}.png`;
    const meta = { 'description': seo.description, 'twitter:card': 'summary_large_image', 'twitter:title': seo.title, 'twitter:description': seo.description, 'twitter:image': cover, 'theme-color': '#ffffff' };
    const og = { type: 'website', site_name: 'Banana Slides', title: seo.title, description: seo.description, locale: seo.locale, url, image: cover, 'image:width': String(deck?.pages[0].width ?? 1200), 'image:height': String(deck?.pages[0].height ?? 630), 'image:alt': deck?.title[language] ?? 'Banana Slides — AI presentations, with layered golden grain artwork' };
    const head = `
    ${Object.entries(meta).map(([name, value]) => `<meta name="${name}" content="${escape(value)}" />`).join('\n')}
    ${Object.entries(og).map(([name, value]) => `<meta property="og:${name}" content="${escape(value)}" />`).join('\n')}
    <link rel="canonical" href="${url}" />
    <link rel="alternate" hreflang="zh-CN" href="${siteUrl}${pagePath('zh')}" />
    <link rel="alternate" hreflang="en" href="${siteUrl}${pagePath('en')}" />
    <link rel="alternate" hreflang="x-default" href="${siteUrl}${pagePath('zh')}" />
    <script type="application/ld+json">${JSON.stringify(gallery ? { '@context': 'https://schema.org', '@type': deck ? 'WebPage' : 'CollectionPage', name: seo.title, url, description: seo.description } : structuredData).replaceAll('<', '\\u003c')}</script>
    ${[...styles].map(file => `<link rel="stylesheet" href="/${file}" />`).join('\n')}
    <script>(function(){if(!/^\\/(en\\/?|landing\\/?|(?:en\\/)?gallery(?:\\/[a-z0-9-]+)?\\/?)?$/.test(location.pathname)){document.documentElement.dataset.appShell='true';return;}try{var p=localStorage.getItem('banana-landing-theme');document.documentElement.dataset.landingTheme=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){document.documentElement.dataset.landingTheme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})();</script>
    <style>html[data-app-shell] #root > .landing-page{display:none}</style>
    <noscript><style>.landing-page [style*="opacity:0"],.landing-page [style*="opacity: 0"]{opacity:1!important;filter:none!important;transform:none!important}.landing-feedback,.landing-nav-actions>button,.landing-cta form,.landing-audience-selector nav{display:none!important}.landing-faq-answer{grid-template-rows:1fr!important;opacity:1!important;visibility:visible!important}</style></noscript>`;
    const html = template.replace(/<html lang="[^"]+"/, `<html lang="${seo.lang}"`).replace(/<title>.*?<\/title>/, `<title>${escape(seo.title)}</title>`).replace('</head>', head + '\n</head>').replace('<div id="root"></div>', `<div id="root">${await render(language, gallery, deck?.id)}</div>`);
    const directory = 'dist' + seo.path.replace(/\/$/, '');
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/index.html`, html);
  }
  await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api/\nDisallow: /admin\nDisallow: /project\nDisallow: /settings\nSitemap: ${siteUrl}/sitemap.xml\n`);
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(route => `<url><loc>${siteUrl}${route}</loc></url>`).join('')}</urlset>`);
  console.log(`${paths.length} landing, gallery and presentation detail pages rendered with bilingual metadata.`);
} finally { await rm(temporary, { recursive: true, force: true }); }
