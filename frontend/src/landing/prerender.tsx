import { renderToString } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { Landing } from './Landing';
import { Gallery } from './gallery/Gallery';
import { DeckDetail } from './gallery/DeckDetail';
export { decks } from './gallery/catalog';
export { landingSeo, siteUrl, structuredData } from './seo';
export { installMarketingScrollRestoration } from './scrollRestoration';
export async function render(language: 'zh' | 'en', gallery = false, deckId?: string) {
  const i18n = createInstance();
  await i18n.init({ lng: language, fallbackLng: language, resources: { [language]: { translation: {} } }, interpolation: { escapeValue: false } });
  return renderToString(<I18nextProvider i18n={i18n}>{deckId ? <DeckDetail deckId={deckId} /> : gallery ? <Gallery /> : <Landing />}</I18nextProvider>);
}
