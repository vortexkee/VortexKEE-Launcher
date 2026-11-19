import React from 'react';
import {
  CheckCircle2,
  Cpu,
  Download,
  FolderOpen,
  Layers,
  Monitor,
  Palette,
  Sparkles,
} from 'lucide-react';
import type {
  GameStatusPayload,
  JavaRuntimeInfo,
  LauncherSettings,
  MinecraftProfile,
  SystemInfo,
} from '../../shared/types';
import { LAUNCHER_THEMES } from '../themes/themes';
import { formatGameStateLabel } from '../utils/api';

interface PlayViewProps {
  systemInfo: SystemInfo | null;
  settings: LauncherSettings;
  selectedProfile: MinecraftProfile | null;
  javaStatus: { requiredMajor: number; runtime: JavaRuntimeInfo | null } | null;
  checkingJava: boolean;
  installingJava: boolean;
  gameStatus: GameStatusPayload;
  onInstallJava: (requiredMajor: number) => void;
  onOpenRootDir: () => void;
  onOpenVersionsTab: () => void;
  onOpenThemesTab: () => void;
}

export const PlayView: React.FC<PlayViewProps> = ({
  systemInfo,
  settings,
  selectedProfile,
  javaStatus,
  checkingJava,
  installingJava,
  gameStatus,
  onInstallJava,
  onOpenRootDir,
  onOpenVersionsTab,
  onOpenThemesTab,
}) => {
  const activeTheme =
    LAUNCHER_THEMES.find((t) => t.id === settings.themeId) ?? LAUNCHER_THEMES[0];

  const platformLabel =
    systemInfo?.platform === 'win32'
      ? 'Windows'
      : systemInfo?.platform === 'darwin'
      ? 'macOS'
      : systemInfo?.platform === 'linux'
      ? 'Linux'
      : 'Masaüstü';

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
      {/* Main Clean Hero Banner */}
      <section className="vortex-hero-backdrop relative rounded-2xl border border-edge-strong/70 overflow-hidden p-7 sm:p-8 flex flex-col justify-between min-h-[290px] shadow-xl">
        {/* Subtle decorative geometric grid + crimson accent line */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-crimson/80 to-accent/70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -top-14 w-64 h-64 rounded-full border border-accent/15"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-6 w-44 h-44 rounded-full border border-crimson/20"
        />

        {/* Top pills */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-panel/80 border border-accent/35 text-accent backdrop-blur-sm">
              <Sparkles className="w-3 h-3" />
              <span>{activeTheme.name} Teması</span>
            </span>
            {selectedProfile && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-panel/80 border border-edge text-ink-secondary backdrop-blur-sm">
                <Layers className="w-3 h-3 text-accent" />
                <span>
                  {selectedProfile.loaderType === 'fabric' ? 'Fabric Modlu' : 'Vanilla'} ·{' '}
                  {selectedProfile.gameVersion}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenThemesTab}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-panel/80 hover:bg-surface-hover border border-edge text-ink-secondary hover:text-ink-primary transition-colors backdrop-blur-sm"
            >
              <Palette className="w-3.5 h-3.5 text-accent" />
              <span>Temalar</span>
            </button>
            <button
              type="button"
              onClick={onOpenRootDir}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-panel/80 hover:bg-surface-hover border border-edge text-ink-secondary hover:text-ink-primary transition-colors backdrop-blur-sm"
            >
              <FolderOpen className="w-3.5 h-3.5 text-accent" />
              <span>Oyun Klasörü</span>
            </button>
          </div>
        </div>

        {/* Center Hero Copy */}
        <div className="relative z-10 max-w-2xl my-6 space-y-2.5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent font-semibold">
            Vortex Launcher · Cross-Platform Minecraft Deneyimi
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-ink-primary">
            {selectedProfile ? selectedProfile.name : 'Minecraft Dünyasına Hazırsınız'}
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed max-w-xl">
            Hesap açma zorunluluğu olmadan alt bardan kullanıcı adınızı yazıp tek tıkla
            başlayabilir veya Microsoft hesabınızla orijinal oturum açabilirsiniz. SHA doğrulamalı
            indirme ve otomatik Temurin Java yönetimi arka planda hazır bekler.
          </p>
        </div>

        {/* Bottom hero bar: live status summary */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-edge/60">
          <div className="flex items-center gap-2.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                gameStatus.state === 'running'
                  ? 'bg-emerald-400'
                  : gameStatus.state === 'crashed'
                  ? 'bg-crimson'
                  : gameStatus.state === 'idle' || gameStatus.state === 'stopped'
                  ? 'bg-accent'
                  : 'bg-accent animate-pulse'
              }`}
            />
            <span className="font-semibold text-ink-primary">
              {formatGameStateLabel(gameStatus.state)}
            </span>
            {gameStatus.message && (
              <span className="text-ink-muted">— {gameStatus.message}</span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenVersionsTab}
            className="text-xs font-medium text-accent hover:text-accent-strong transition-colors"
          >
            Sürümleri ve Profilleri Düzenle →
          </button>
        </div>
      </section>

      {/* Clean 3-Card Telemetry Summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Java Runtime */}
        <div className="rounded-2xl bg-surface-panel border border-edge p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent" />
              Java Çalışma Zamanı
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated border border-edge text-ink-muted">
              Java {javaStatus?.requiredMajor ?? 21}
            </span>
          </div>

          <div className="space-y-1">
            {checkingJava ? (
              <p className="text-xs text-ink-muted">Sistem Java taranıyor...</p>
            ) : javaStatus?.runtime ? (
              <>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Temurin / Java {javaStatus.runtime.versionString} ({javaStatus.runtime.arch})
                  </span>
                </div>
                <p className="text-[11px] font-mono text-ink-muted truncate" title={javaStatus.runtime.path}>
                  {javaStatus.runtime.path}
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-ink-muted">
                  Gerekli Java {javaStatus?.requiredMajor ?? 21} bulunamadı. Oyun başlatılırken
                  otomatik indirilir veya şimdi kurabilirsiniz.
                </p>
                {javaStatus && (
                  <button
                    type="button"
                    disabled={installingJava}
                    onClick={() => onInstallJava(javaStatus.requiredMajor)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 disabled:opacity-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {installingJava
                        ? 'İndiriliyor...'
                        : `Temurin ${javaStatus.requiredMajor} İndir`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: RAM & Display */}
        <div className="rounded-2xl bg-surface-panel border border-edge p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary flex items-center gap-2">
              <Monitor className="w-4 h-4 text-accent" />
              Bellek &amp; Görüntü
            </span>
            <span className="text-[10px] font-mono text-ink-muted">
              {systemInfo ? `${systemInfo.totalMemoryGB} GB Toplam` : '—'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-xl font-bold text-ink-primary">
              {selectedProfile?.memoryGB ?? settings.memoryGB}{' '}
              <span className="text-xs font-normal text-ink-muted">GB RAM Tahsisli</span>
            </div>
            <p className="text-xs text-ink-muted">
              Çözünürlük:{' '}
              {selectedProfile
                ? selectedProfile.resolution.fullscreen
                  ? 'Tam Ekran'
                  : `${selectedProfile.resolution.width} × ${selectedProfile.resolution.height}`
                : '1280 × 720'}
            </p>
          </div>
        </div>

        {/* Card 3: Platform & Directory */}
        <div className="rounded-2xl bg-surface-panel border border-edge p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-accent" />
              Platform &amp; Veri Dizini
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-crimson/15 text-crimson border border-crimson/30">
              {platformLabel} · {systemInfo?.arch ?? 'x64'}
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-ink-primary">
              VortexLauncher İzole Çalışma Alanı
            </p>
            <p
              className="text-[11px] font-mono text-ink-muted truncate"
              title={systemInfo?.paths.rootDir ?? ''}
            >
              {systemInfo?.paths.rootDir ?? 'VortexLauncher dizini yükleniyor...'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
