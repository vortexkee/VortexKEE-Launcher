import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Cpu,
  Download,
  ExternalLink,
  Palette,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { DownloadsSection } from './components/DownloadsSection';
import { LauncherMockup } from './components/LauncherMockup';
import { Navbar } from './components/Navbar';
import {
  APP_ID,
  buildFallbackReleaseInfo,
  GITHUB_RELEASES_URL,
  PRODUCT_NAME,
  ResolvedReleaseInfo,
  SITE_URL,
} from './config/releaseConfig';
import { fetchLatestReleaseInfo, formatFileSize } from './services/githubReleases';
import { applyWebTheme, getInitialThemeId, WEB_THEMES } from './themes/themes';
import { detectClientEnvironment } from './utils/detectOS';

const FEATURES = [
  {
    icon: UserCheck,
    title: 'Zorunlu Hesap Yok + Microsoft Auth',
    description:
      'Hesap açmadan yalnızca kullanıcı adınızı yazıp Offline UUID v3 ile anında oynayın veya isteğe bağlı Microsoft OAuth hesabınızı safeStorage ile güvenle bağlayın.',
  },
  {
    icon: Puzzle,
    title: 'Tek Tık Modrinth & Zorunlu Bağımlılıklar',
    description:
      'Seçili Minecraft sürümü ve Fabric/Forge/NeoForge yükleyicisine uyumlu modları arayın; Fabric API gibi zorunlu bağımlılıklar eksikse otomatik indirilir.',
  },
  {
    icon: Cpu,
    title: 'Otomatik Adoptium / Temurin Java',
    description:
      'Windows, macOS (Apple Silicon arm64 dahil) ve Linux için sürümün gerektirdiği Java 8, 17 veya 21 LTS çalışma zamanı otomatik algılanır ya da SHA-256 doğrulamayla kurulur.',
  },
  {
    icon: Palette,
    title: 'Patrick Jane & 6 Dinamik Tema',
    description:
      'Varsayılan Patrick Jane estetiğinden Siber Neon, Karanlık Uzay, Zümrüt Orman ve Minimalist Açık temaya kadar tek tıkla görünüm değiştirin.',
  },
  {
    icon: ShieldCheck,
    title: 'SHA-1 / SHA-256 / SHA-512 Doğrulama',
    description:
      'İstemci JAR, kütüphaneler, oyun varlıkları, Java paketleri ve Modrinth modları akışlı kriptografik özet doğrulamasıyla atomik olarak indirilir.',
  },
  {
    icon: RefreshCw,
    title: 'GitHub Releases Otomatik Güncelleme',
    description:
      'Yeni sürümler yayınlandığında uygulama içinden tek tıkla güncellemeyi indirip yeniden başlatarak en güncel özelliklere ulaşın.',
  },
];

export default function App() {
  const [themeId, setThemeId] = useState<string>(() => getInitialThemeId());
  const [release, setRelease] = useState<ResolvedReleaseInfo>(() =>
    buildFallbackReleaseInfo(),
  );
  const [loadingRelease, setLoadingRelease] = useState(true);

  const clientEnv = useMemo(() => detectClientEnvironment(), []);
  const activeTheme =
    WEB_THEMES.find((t) => t.id === themeId) ?? WEB_THEMES[0];

  useEffect(() => {
    applyWebTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    let cancelled = false;
    void fetchLatestReleaseInfo()
      .then((info) => {
        if (!cancelled) setRelease(info);
      })
      .finally(() => {
        if (!cancelled) setLoadingRelease(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const primaryDownload = useMemo(() => {
    if (clientEnv.os === 'macos') {
      const asset =
        clientEnv.arch === 'arm64'
          ? release.downloads.macos.arm64
          : release.downloads.macos.x64;
      return {
        buttonLabel: `macOS için İndir (${asset.extension})`,
        detail: `${asset.sublabel} · ${release.version}`,
        url: asset.url,
        size: formatFileSize(asset.sizeBytes),
      };
    }

    if (clientEnv.os === 'linux') {
      const asset = release.downloads.linux.appImage;
      return {
        buttonLabel: `Linux için İndir (${asset.extension})`,
        detail: `AppImage (x64) · Ayrıca .deb paketi mevcut · ${release.version}`,
        url: asset.url,
        size: formatFileSize(asset.sizeBytes),
      };
    }

    const asset = release.downloads.windows.primary;
    return {
      buttonLabel: `Windows için İndir (${asset.extension})`,
      detail: `NSIS Kurulum Sihirbazı (x64) · Windows 10/11 · ${release.version}`,
      url: asset.url,
      size: formatFileSize(asset.sizeBytes),
    };
  }, [clientEnv, release]);

  const handleSelectTheme = (nextId: string) => {
    const applied = applyWebTheme(nextId);
    setThemeId(applied);
  };

  return (
    <div className="min-h-screen vortex-page-glow text-ink-primary flex flex-col">
      <Navbar
        activeThemeId={themeId}
        onSelectTheme={handleSelectTheme}
        latestVersion={release.version}
      />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-14 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Copy & Auto-Detected OS Download CTA */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-panel border border-accent/40 text-xs text-accent font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {release.version} · {clientEnv.osLabel} için hazır
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight leading-[1.12] text-ink-primary">
                  Sade, Hızlı ve Zevkli{' '}
                  <span className="text-accent">Minecraft</span> Başlatıcısı.
                </h1>
                <p className="text-sm sm:text-base text-ink-secondary leading-relaxed max-w-xl">
                  <strong>{PRODUCT_NAME}</strong>; Windows, macOS ve Linux için modern Electron +
                  React mimarisiyle tasarlandı. Hesap açma zorunluluğu olmadan hızlı nick ile
                  oynayın, tek tıkla Modrinth modları kurun ve temalarla görünümü anında değiştirin.
                </p>
              </div>

              {/* Primary OS-Aware Download CTA */}
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={primaryDownload.url}
                    className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-accent text-accent-fg hover:bg-accent-strong font-bold text-sm shadow-lg transition-all active:scale-[0.99]"
                  >
                    <Download className="w-4 h-4" />
                    <span>{primaryDownload.buttonLabel}</span>
                    {primaryDownload.size && (
                      <span className="px-2 py-0.5 rounded-md bg-black/15 font-mono text-[11px]">
                        {primaryDownload.size}
                      </span>
                    )}
                  </a>

                  <a
                    href="#indir"
                    className="inline-flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-surface-panel hover:bg-surface-hover border border-edge text-xs font-semibold text-ink-primary transition-colors"
                  >
                    <span>Diğer Platformlar</span>
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span>{primaryDownload.detail}</span>
                  {release.isFallback && !loadingRelease && (
                    <a
                      href={GITHUB_RELEASES_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline inline-flex items-center gap-1"
                    >
                      <span>Tüm sürümleri gör</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Subtle burgundy & gold trust strip */}
              <div className="pt-4 border-t border-edge/60 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Windows · macOS · Linux
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-crimson" />
                  Modrinth API v2 Entegreli
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Ücretsiz &amp; Reklamsız
                </span>
              </div>
            </div>

            {/* Right: Live Interactive Launcher Mockup */}
            <div className="lg:col-span-6">
              <LauncherMockup
                detectedOS={clientEnv.os}
                activeThemeName={activeTheme.name}
                versionTag={release.version}
              />
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="ozellikler" className="py-16 sm:py-20 border-t border-edge/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Mimari &amp; Özellikler
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-primary">
                Her Detayı Oyuncular İçin Düşünüldü
              </h2>
              <p className="text-sm text-ink-secondary">
                Platform standartlarına saygılı izole veri dizinleri, güvenli IPC köprüsü ve sıfır
                sürtünmeli başlatma deneyimi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="rounded-2xl bg-surface-panel/85 border border-edge hover:border-edge-strong p-5 space-y-3 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-ink-primary">{feat.title}</h3>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Live Theme Showcase Section */}
        <section id="temalar" className="py-16 sm:py-20 border-t border-edge/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Canlı Önizleme
                </span>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-primary">
                  6 Hazır Temayı Hemen Sitede Dene
                </h2>
                <p className="text-sm text-ink-secondary">
                  Varsayılan <strong>Patrick Jane</strong> estetiği ve diğer 5 tema launcher ile
                  birebir aynı CSS değişkenlerini kullanır. Aşağıdan bir tema seçerek tüm siteyi ve
                  yukarıdaki launcher önizlemesini anında değiştirin.
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-surface-panel border border-edge text-xs text-ink-secondary">
                Aktif Tema: <strong className="text-accent">{activeTheme.name}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {WEB_THEMES.map((theme) => {
                const isSelected = theme.id === themeId;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`text-left rounded-2xl border p-4 space-y-3 transition-all ${
                      isSelected
                        ? 'bg-surface-panel border-accent ring-2 ring-accent/25 shadow-lg'
                        : 'bg-surface-panel/75 border-edge hover:border-edge-strong hover:bg-surface-panel'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-ink-primary">{theme.name}</div>
                        <div className="text-[11px] text-accent">{theme.tagline}</div>
                      </div>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent text-accent-fg">
                          <Check className="w-3 h-3" /> Aktif
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-ink-muted leading-relaxed">{theme.description}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-edge/60">
                      <div className="flex items-center gap-1.5">
                        {[
                          theme.swatch.base,
                          theme.swatch.panel,
                          theme.swatch.accent,
                          theme.swatch.secondary,
                          theme.swatch.text,
                        ].map((hex, i) => (
                          <span
                            key={`${theme.id}-${i}`}
                            style={{ backgroundColor: hex }}
                            className="w-4 h-4 rounded-full border border-edge-strong"
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono text-ink-muted">{theme.id}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* All-Platforms Download Section */}
        <DownloadsSection
          release={release}
          detectedOS={clientEnv.os}
          loading={loadingRelease}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-edge/70 bg-surface-panel/60 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted">
          <div className="space-y-1 text-center sm:text-left">
            <div className="font-semibold text-ink-primary">
              {PRODUCT_NAME}{' '}
              <span className="font-mono text-ink-muted font-normal">({APP_ID})</span>
            </div>
            <p className="text-[11px]">
              Minecraft, Mojang AB&apos;nin ticari markasıdır. Vortex Launcher bağımsız bir açık
              kaynak projesidir.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <a href={SITE_URL} className="hover:text-accent transition-colors font-mono">
              vlauncher.vercel.app
            </a>
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              GitHub Releases
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
