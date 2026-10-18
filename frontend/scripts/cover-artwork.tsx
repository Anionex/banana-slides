// Development-only capture surface; not an entry in the production build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { decks } from '../src/landing/gallery/catalog';
import { DeckOverviewArtwork } from '../src/landing/gallery/DeckOverviewArtwork';
import { hasDeckOverview } from '../src/landing/gallery/DeckOverview';
import '../src/landing/landing-typography.css';

const params = new URLSearchParams(location.search);
const deck = decks.find(item => item.id === params.get('deck'));
const language = params.get('lang') === 'en' ? 'en' : 'zh';
if (!deck || !hasDeckOverview(deck.id)) throw new Error('Choose a deck with overview artwork');
document.documentElement.lang = language;
createRoot(document.getElementById('root')!).render(
  <div className="landing-page" style={{ position: 'relative', width: 1600, height: 900 }}>
    <DeckOverviewArtwork deck={deck} language={language} eager />
  </div>,
);
