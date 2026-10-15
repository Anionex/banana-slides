import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { landingSeo, siteUrl } from './seo';

export function useLandingMetadata() {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  useEffect(() => {
    const seo = landingSeo[language];
    document.documentElement.lang = seo.lang;
    document.title = seo.title;
    const update = (selector: string, value: string) => document.querySelector(selector)?.setAttribute('content', value);
    update('meta[name="description"]', seo.description);
    update('meta[property="og:title"]', seo.title);
    update('meta[property="og:description"]', seo.description);
    update('meta[property="og:locale"]', seo.locale);
    update('meta[property="og:url"]', siteUrl + seo.path);
    const cover = `${siteUrl}/social/cover${language === 'en' ? '-en' : ''}.png`;
    update('meta[property="og:image"]', cover);
    update('meta[name="twitter:image"]', cover);
    update('meta[name="twitter:title"]', seo.title);
    update('meta[name="twitter:description"]', seo.description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', siteUrl + seo.path);
    // Language-specific static URLs let crawlers and shared links read the same copy.
    if (location.pathname !== seo.path) history.replaceState(null, '', seo.path + location.search + location.hash);
  }, [language]);
  return language;
}
