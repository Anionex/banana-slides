export const siteUrl = 'https://bananaslides.online';
export const landingSeo = {
  zh: { title: 'Banana Slides 蕉幻 — 让 PPT 创作，回归直觉', description: '用自然语言描述想法，让 AI 生成完整演示文稿。支持资料解析、自然语言修改与 PPTX、PDF 导出，立即体验 Banana Slides。', locale: 'zh_CN', lang: 'zh-CN', path: '/' },
  en: { title: 'Banana Slides — Create presentations intuitively', description: 'Turn ideas into complete presentations with AI. Bring your own materials, edit with natural language, and export to PPTX or PDF. Try Banana Slides.', locale: 'en_US', lang: 'en', path: '/en/' },
};
export const structuredData = {
  '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: `${siteUrl}/`, name: 'Banana Slides', alternateName: '蕉幻', inLanguage: ['zh-CN', 'en'] },
    { '@type': 'SoftwareApplication', name: 'Banana Slides', url: `${siteUrl}/`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', sameAs: ['https://github.com/Anionex/banana-slides'] },
  ],
};
