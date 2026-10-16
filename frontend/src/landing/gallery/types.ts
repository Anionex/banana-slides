export interface GalleryDeck {
  id: string;
  title: { zh: string; en: string };
  category: { zh: string; en: string };
  originalTitle: string;
  pdf: string;
  source: string;
  author: string;
  pages: { width: number; height: number }[];
}
