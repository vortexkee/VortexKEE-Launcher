export interface LauncherThemeDefinition {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  badge?: string;
  mode: 'dark' | 'light';
  preview: {
    base: string;
    panel: string;
    elevated: string;
    accent: string;
    secondary: string;
    text: string;
  };
}

export const DEFAULT_THEME_ID = 'patrick-jane';

export const LAUNCHER_THEMES: LauncherThemeDefinition[] = [
  {
    id: 'patrick-jane',
    name: 'Patrick Jane',
    subtitle: 'Varsayılan · The Mentalist Estetiği',
    description:
      'Koyu füme antrasit yüzeyler, sıcak kehribar altın vurgular, krem-beyaz tipografi ve ince bordo detaylar.',
    badge: 'Varsayılan',
    mode: 'dark',
    preview: {
      base: '#14171F',
      panel: '#1C202B',
      elevated: '#242938',
      accent: '#D4A359',
      secondary: '#B83B3B',
      text: '#F4EFE6',
    },
  },
  {
    id: 'cyber-neon',
    name: 'Siber Neon',
    subtitle: 'Neo-Tokyo · Yüksek Kontrast',
    description:
      'Derin gece karbonu üzerinde elektrik cyan ışık hatları ve siber magenta vurgularla fütüristik oyun konsolu havası.',
    mode: 'dark',
    preview: {
      base: '#0A0D14',
      panel: '#111623',
      elevated: '#182033',
      accent: '#00F0FF',
      secondary: '#FF2A85',
      text: '#ECF8FF',
    },
  },
  {
    id: 'astral-void',
    name: 'Karanlık Uzay',
    subtitle: 'Kozmik Nebula · Ametist Moru',
    description:
      'Uzayın derin lacivert-mor karanlığı, parlayan ametist butonlar ve yıldız pembesi ikincil detaylar.',
    mode: 'dark',
    preview: {
      base: '#0D0A18',
      panel: '#161129',
      elevated: '#20193A',
      accent: '#A855F7',
      secondary: '#F472B6',
      text: '#F3EEFF',
    },
  },
  {
    id: 'emerald-grove',
    name: 'Zümrüt Orman',
    subtitle: 'Kadim Biyom · Doğa & Bronz',
    description:
      'Gece çamı arka planları, canlı zümrüt yeşili etkileşimler ve sıcak antik bronz kenar detayları.',
    mode: 'dark',
    preview: {
      base: '#0D1612',
      panel: '#14221C',
      elevated: '#1C2F27',
      accent: '#2ECC71',
      secondary: '#C89B54',
      text: '#ECF5EE',
    },
  },
  {
    id: 'arctic-paper',
    name: 'Minimalist Açık',
    subtitle: 'İskandinav Kağıt · Gündüz Modu',
    description:
      'Göz yormayan sıcak kırık beyaz yüzeyler, saf beyaz kartlar, keskin arduvaz mavi vurgular ve kiremit detaylar.',
    badge: 'Açık Tema',
    mode: 'light',
    preview: {
      base: '#F6F4EF',
      panel: '#FFFFFF',
      elevated: '#EDE9E0',
      accent: '#2563EB',
      secondary: '#C2410C',
      text: '#181C24',
    },
  },
  {
    id: 'crimson-obsidian',
    name: 'Kızıl Obsidyen',
    subtitle: 'Nether Ocağı · Volkanik Kor',
    description:
      'Kömür-obsidyen derinlikler üzerinde kor kızılı ana vurgular ve erimiş altın enerji çizgileri.',
    mode: 'dark',
    preview: {
      base: '#120E10',
      panel: '#1C1518',
      elevated: '#281D21',
      accent: '#EF4444',
      secondary: '#F59E0B',
      text: '#F7EFEF',
    },
  },
];

export function resolveValidThemeId(themeId?: string | null): string {
  if (!themeId) return DEFAULT_THEME_ID;
  return LAUNCHER_THEMES.some((t) => t.id === themeId) ? themeId : DEFAULT_THEME_ID;
}

export function applyThemeToDocument(themeId: string): string {
  const validId = resolveValidThemeId(themeId);
  document.documentElement.setAttribute('data-theme', validId);
  return validId;
}
