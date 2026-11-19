export interface WebThemeDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  themeColor: string;
  swatch: {
    base: string;
    panel: string;
    accent: string;
    secondary: string;
    text: string;
  };
}

export const DEFAULT_THEME_ID = 'patrick-jane';
const STORAGE_KEY = 'vortex-web-theme';

export const WEB_THEMES: WebThemeDefinition[] = [
  {
    id: 'patrick-jane',
    name: 'Patrick Jane',
    tagline: 'Varsayılan · The Mentalist Estetiği',
    description:
      'Koyu füme/antrasit yüzeyler, sıcak kehribar-altın vurgular, krem tipografi ve ince bordo detaylar.',
    themeColor: '#14171F',
    swatch: {
      base: '#14171F',
      panel: '#1C202B',
      accent: '#D4A359',
      secondary: '#B83B3B',
      text: '#F4EFE6',
    },
  },
  {
    id: 'cyber-neon',
    name: 'Siber Neon',
    tagline: 'Neo-Tokyo · Yüksek Kontrast',
    description: 'Derin gece karbonu üzerinde elektrik cyan ışık hatları ve siber magenta vurgular.',
    themeColor: '#0A0D14',
    swatch: {
      base: '#0A0D14',
      panel: '#111623',
      accent: '#00F0FF',
      secondary: '#FF2A85',
      text: '#ECF8FF',
    },
  },
  {
    id: 'astral-void',
    name: 'Karanlık Uzay',
    tagline: 'Kozmik Nebula · Ametist',
    description: 'Kozmos karanlığı, ametist moru odak noktaları ve yıldız pembesi detaylar.',
    themeColor: '#0D0A18',
    swatch: {
      base: '#0D0A18',
      panel: '#161129',
      accent: '#A855F7',
      secondary: '#F472B6',
      text: '#F3EEFF',
    },
  },
  {
    id: 'emerald-grove',
    name: 'Zümrüt Orman',
    tagline: 'Kadim Biyom · Doğa & Bronz',
    description: 'Gece çamı arka planları, canlı zümrüt yeşili etkileşimler ve antik bronz dokunuşlar.',
    themeColor: '#0D1612',
    swatch: {
      base: '#0D1612',
      panel: '#14221C',
      accent: '#2ECC71',
      secondary: '#C89B54',
      text: '#ECF5EE',
    },
  },
  {
    id: 'arctic-paper',
    name: 'Minimalist Açık',
    tagline: 'İskandinav Kağıt · Gündüz Modu',
    description: 'Sıcak kırık beyaz yüzeyler, keskin arduvaz mavi vurgular ve kiremit detaylar.',
    themeColor: '#F6F4EF',
    swatch: {
      base: '#F6F4EF',
      panel: '#FFFFFF',
      accent: '#2563EB',
      secondary: '#C2410C',
      text: '#181C24',
    },
  },
  {
    id: 'crimson-obsidian',
    name: 'Kızıl Obsidyen',
    tagline: 'Nether Ocağı · Volkanik Kor',
    description: 'Kömür-obsidyen derinlikler, kor kızılı vurgular ve erimiş altın enerji çizgileri.',
    themeColor: '#120E10',
    swatch: {
      base: '#120E10',
      panel: '#1C1518',
      accent: '#EF4444',
      secondary: '#F59E0B',
      text: '#F7EFEF',
    },
  },
];

export function getInitialThemeId(): string {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && WEB_THEMES.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return DEFAULT_THEME_ID;
}

export function applyWebTheme(themeId: string): string {
  const theme = WEB_THEMES.find((t) => t.id === themeId) ?? WEB_THEMES[0];
  document.documentElement.setAttribute('data-theme', theme.id);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme.themeColor);
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // Ignore storage access errors
  }

  return theme.id;
}
