import { build } from 'vite';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
if (process.env.VITE_PUBLIC_LANDING !== 'true') process.exit(0);
const temporary = path.resolve('.landing-ssr');
try {
  await build({ build: { ssr: 'src/landing/prerender.tsx', outDir: temporary, emptyOutDir: true }, logLevel: 'error' });
  const { render, landingSeo, siteUrl, structuredData } = await import(pathToFileURL(path.join(temporary, 'prerender.js')));
  await Promise.all(['cover.png','cover-en.png'].map(file=>readFile('public/social/'+file))); // Fail the build if the advertised cover is missing.
  const template = await readFile('dist/index.html', 'utf8');
  const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
  const styles = new Set();
  const collect = key => { const entry = manifest[key]; if (!entry) return; entry.css?.forEach(css => styles.add(css)); entry.imports?.forEach(collect); };
  collect('src/main.tsx'); collect('src/landing/Landing.tsx'); collect('src/landing/gallery/Gallery.tsx');
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  for (const { language, gallery } of [{ language: 'zh', gallery: false }, { language: 'en', gallery: false }, { language: 'zh', gallery: true }, { language: 'en', gallery: true }]) {
    const seo = gallery ? { ...landingSeo[language], path: language === 'zh' ? '/gallery/' : '/en/gallery/', title: language === 'zh' ? '作品画廊 | Banana Slides' : 'Presentation gallery | Banana Slides', description: language === 'zh' ? '浏览 Banana Slides 社区真实作品。横向挑选演示文稿，向下阅读完整页面。' : 'Explore real Banana Slides presentations. Browse sideways and read the complete deck.' } : landingSeo[language];
    const url = siteUrl + seo.path;
    const cover = `${siteUrl}/social/cover${language === 'en' ? '-en' : ''}.png`;
    const meta = { 'description': seo.description, 'twitter:card': 'summary_large_image', 'twitter:title': seo.title, 'twitter:description': seo.description, 'twitter:image': cover, 'theme-color': '#ffffff' };
    const og = { type: 'website', site_name: 'Banana Slides', title: seo.title, description: seo.description, locale: seo.locale, url, image: cover, 'image:width': '1200', 'image:height': '630', 'image:alt': 'Banana Slides — AI presentations, with layered golden grain artwork' };
    const head = `
    ${Object.entries(meta).map(([name, value]) => `<meta name="${name}" content="${escape(value)}" />`).join('\n')}
    ${Object.entries(og).map(([name, value]) => `<meta property="og:${name}" content="${escape(value)}" />`).join('\n')}
    <link rel="canonical" href="${url}" />
    <link rel="alternate" hreflang="zh-CN" href="${siteUrl}${gallery ? "/gallery/" : "/"}" />
    <link rel="alternate" hreflang="en" href="${siteUrl}${gallery ? "/en/gallery/" : "/en/"}" />
    <link rel="alternate" hreflang="x-default" href="${siteUrl}${gallery ? "/gallery/" : "/"}" />
    <script type="application/ld+json">${JSON.stringify(gallery ? { '@context': 'https://schema.org', '@type': 'CollectionPage', name: seo.title, url, description: seo.description } : structuredData).replaceAll('<', '\\u003c')}</script>
    ${[...styles].map(file => `<link rel="stylesheet" href="/${file}" />`).join('\n')}
    <script>(function(){if(!/^\\/(en\\/?|landing\\/?|(?:en\\/)?gallery\\/?)?$/.test(location.pathname)){document.documentElement.dataset.appShell='true';return;}try{var p=localStorage.getItem('banana-landing-theme');document.documentElement.dataset.landingTheme=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){document.documentElement.dataset.landingTheme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})();</script>
    <style>html[data-app-shell] #root > .landing-page{display:none}</style>
    <noscript><style>.landing-page [style*="opacity:0"],.landing-page [style*="opacity: 0"]{opacity:1!important;filter:none!important;transform:none!important}.landing-feedback,.landing-nav-actions>button,.landing-cta form,.landing-audience-selector nav{display:none!important}.landing-faq-answer{grid-template-rows:1fr!important;opacity:1!important;visibility:visible!important}</style></noscript>`;
    const html = template.replace(/<html lang="[^"]+"/, `<html lang="${seo.lang}"`).replace(/<title>.*?<\/title>/, `<title>${escape(seo.title)}</title>`).replace('</head>', head + '\n</head>').replace('<div id="root"></div>', `<div id="root">${await render(language, gallery)}</div>`);
    const directory = 'dist' + (gallery ? (language === 'en' ? '/en/gallery' : '/gallery') : (language === 'en' ? '/en' : ''));
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/index.html`, html);
  }
  await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api/\nDisallow: /admin\nDisallow: /project\nDisallow: /settings\nSitemap: ${siteUrl}/sitemap.xml\n`);
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}/</loc></url><url><loc>${siteUrl}/en/</loc></url><url><loc>${siteUrl}/gallery/</loc></url><url><loc>${siteUrl}/en/gallery/</loc></url></urlset>`);
  console.log('Landing and gallery HTML rendered in Chinese and English; metadata, robots and sitemap generated.');
} finally { await rm(temporary, { recursive: true, force: true }); }
