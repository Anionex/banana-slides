import { renderToString } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { Landing } from './Landing';
export { landingSeo, siteUrl, structuredData } from './seo';
export async function render(language: 'zh' | 'en') {
  const i18n = createInstance();
  await i18n.init({ lng: language, fallbackLng: language, resources: { [language]: { translation: {} } }, interpolation: { escapeValue: false } });
  return renderToString(<I18nextProvider i18n={i18n}><Landing /></I18nextProvider>);
}
