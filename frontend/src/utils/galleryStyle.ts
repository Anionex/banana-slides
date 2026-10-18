import manifest from '../landing/gallery/manifest.json';

export function galleryStyleHref(id: string, language: 'zh' | 'en') {
  return `/app?${new URLSearchParams({ galleryStyle: id, styleLanguage: language })}`;
}

// Resolve only published works; never treat URL content as a style prompt.
export function galleryStyleFromSearch(params: URLSearchParams) {
  const deck = manifest.find(item => item.id === params.get('galleryStyle'));
  if (!deck) return null;
  const language = params.get('styleLanguage') === 'en' ? 'en' : 'zh';
  return { prompt: deck.creation.stylePrompt[language] };
}
