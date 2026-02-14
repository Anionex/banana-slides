// Preset PPT style configuration with i18n support

export interface PresetStyle {
  id: string;
  nameKey: string;  // i18n key for name
  descriptionKey: string;  // i18n key for description
  previewImage?: string;
  color: string;  // accent color for visual indicator
}

// Style IDs map to i18n keys in presetStyles namespace
export const PRESET_STYLES: PresetStyle[] = [
  {
    id: 'business-simple',
    nameKey: 'presetStyles.businessSimple.name',
    descriptionKey: 'presetStyles.businessSimple.description',
    previewImage: '/preset-previews/business-simple.webp',
    color: '#0B1F3B',
  },
  {
    id: 'tech-modern',
    nameKey: 'presetStyles.techModern.name',
    descriptionKey: 'presetStyles.techModern.description',
    previewImage: '/preset-previews/tech-modern.webp',
    color: '#7C3AED',
  },
  {
    id: 'academic-formal',
    nameKey: 'presetStyles.academicFormal.name',
    descriptionKey: 'presetStyles.academicFormal.description',
    previewImage: '/preset-previews/academic-formal.webp',
    color: '#7F1D1D',
  },
  {
    id: 'creative-fun',
    nameKey: 'presetStyles.creativeFun.name',
    descriptionKey: 'presetStyles.creativeFun.description',
    previewImage: '/preset-previews/creative-fun.webp',
    color: '#FF6A00',
  },
  {
    id: 'minimalist-clean',
    nameKey: 'presetStyles.minimalistClean.name',
    descriptionKey: 'presetStyles.minimalistClean.description',
    previewImage: '/preset-previews/minimalist-clean.webp',
    color: '#6B7280',
  },
  {
    id: 'luxury-premium',
    nameKey: 'presetStyles.luxuryPremium.name',
    descriptionKey: 'presetStyles.luxuryPremium.description',
    previewImage: '/preset-previews/luxury-premium.webp',
    color: '#F7E7CE',
  },
  {
    id: 'nature-fresh',
    nameKey: 'presetStyles.natureFresh.name',
    descriptionKey: 'presetStyles.natureFresh.description',
    previewImage: '/preset-previews/nature-fresh.webp',
    color: '#14532D',
  },
  {
    id: 'gradient-vibrant',
    nameKey: 'presetStyles.gradientVibrant.name',
    descriptionKey: 'presetStyles.gradientVibrant.description',
    previewImage: '/preset-previews/gradient-vibrant.webp',
    color: '#2563EB',
  },
];

// Helper function to get style with translated values
export const getPresetStyleWithTranslation = (
  style: PresetStyle,
  t: (key: string) => string
): { id: string; name: string; description: string; previewImage?: string } => {
  return {
    id: style.id,
    name: t(style.nameKey),
    description: t(style.descriptionKey),
    previewImage: style.previewImage,
  };
};
