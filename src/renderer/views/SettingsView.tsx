import React, { useMemo } from 'react';
import {
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  FolderOpen,
  Globe,
  HardDrive,
  RefreshCw,
  RotateCcw,
  Settings,
} from 'lucide-react';
import type {
  JavaRuntimeInfo,
  LauncherSettings,
  SystemInfo,
  UpdateSettingsPatch,
  UpdaterStatusPayload,
} from '../../shared/types';

interface SettingsViewProps {
  systemInfo: SystemInfo | null;
  settings: LauncherSettings;
  javaStatus: { requiredMajor: number; runtime: JavaRuntimeInfo | null } | null;
  installingJava: boolean;
  updaterStatus: UpdaterStatusPayload;
  onUpdateSettings: (patch: UpdateSettingsPatch) => Promise<void>;
  onResetSettings: () => Promise<void>;
  onSelectJavaBinary: () => Promise<string | null>;
  onInstallJava: (requiredMajor: number) => void;
  onOpenDirectory: (targetPath?: string) => void;
  onCheckUpdates: () => void;
  onDownloadUpdate: () => void;
  onInstallUpdate: () => void;
  onOpenExternal: (url: string) => void;
}

const LAUNCHER_WEBSITE_URL = 'https://vlauncher.vercel.app';

export const SettingsView: React.FC<SettingsViewProps> = ({
  systemInfo,
  settings,
  javaStatus,
  installingJava,
  updaterStatus,
  onUpdateSettings,
  onResetSettings,
  onSelectJavaBinary,
  onInstallJava,
  onOpenDirectory,
  onCheckUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onOpenExternal,
}) => {
  const totalRamGB = systemInfo?.totalMemoryGB ?? 8;
  const recommendedRamGB = systemInfo?.recommendedMemoryGB ?? 4;

  // Leave at least 2 GB headroom for OS when system has >= 6 GB RAM
  const safeMaxRamGB = useMemo(() => {
    const floored = Math.floor(totalRamGB);
    if (floored >= 6) return Math.max(2, floored - 2);
    return Math.max(2, floored);
  }, [totalRamGB]);

  const currentRam = Math.min(Math.max(1, settings.memoryGB), safeMaxRamGB);
  const ramUsagePercent = Math.min(100, Math.round((currentRam / Math.max(1, totalRamGB)) * 100));

  const handleBrowseJava = async () => {
    const selectedPath = await onSelectJavaBinary();
    if (selectedPath) {
      await onUpdateSettings({ javaPath: selectedPath });
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-primary flex items-center gap-2">
            <Settings className="w-5 h-5 text-accent" />
            <span>Launcher Ayarları</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Tüm değişiklikler <code className="font-mono text-accent">settings.json</code> dosyasına
            otomatik kaydedilir.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onResetSettings()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-surface-panel hover:bg-crimson/15 border border-edge hover:border-crimson/40 text-ink-secondary hover:text-crimson transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Varsayılanlara Sıfırla</span>
        </button>
      </div>

      {/* 1. System-Bounded RAM Slider */}
      <section className="rounded-2xl bg-surface-panel border border-edge p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-primary">
                Bellek (RAM) Tahsisi
              </h3>
              <p className="text-xs text-ink-muted">
                Sistem toplamı: <strong className="text-ink-primary">{totalRamGB} GB</strong> ·
                Önerilen: <strong className="text-accent">{recommendedRamGB} GB</strong> · Güvenli
                üst sınır: <strong className="text-ink-primary">{safeMaxRamGB} GB</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono text-accent">
              {currentRam.toFixed(1)} GB
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated border border-edge text-ink-muted">
              %{ramUsagePercent}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <input
            type="range"
            min={1}
            max={safeMaxRamGB}
            step={0.5}
            value={currentRam}
            onChange={(e) => void onUpdateSettings({ memoryGB: Number(e.target.value) })}
            aria-label="RAM miktarı sürgüsü"
            className="vortex-slider w-full"
          />
          <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
            <span>1.0 GB</span>
            <span>Önerilen ({recommendedRamGB} GB)</span>
            <span>{safeMaxRamGB.toFixed(1)} GB (Sınır)</span>
          </div>
        </div>
      </section>

      {/* 2. Java Path Selector & Adoptium Runtime */}
      <section className="rounded-2xl bg-surface-panel border border-edge p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-primary">Java Yolu &amp; Temurin JRE</h3>
              <p className="text-xs text-ink-muted">
                Boş bırakıldığında seçili Minecraft sürümü için uyumlu Adoptium/Temurin Java otomatik algılanır.
              </p>
            </div>
          </div>

          {javaStatus?.runtime ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Java {javaStatus.runtime.versionString} ({javaStatus.runtime.arch})
            </span>
          ) : (
            javaStatus && (
              <button
                type="button"
                disabled={installingJava}
                onClick={() => onInstallJava(javaStatus.requiredMajor)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 disabled:opacity-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {installingJava
                    ? 'İndiriliyor...'
                    : `Temurin ${javaStatus.requiredMajor} Kur`}
                </span>
              </button>
            )
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={settings.javaPath}
            onChange={(e) => void onUpdateSettings({ javaPath: e.target.value })}
            placeholder="Otomatik algılama (Adoptium / Sistem Java)"
            className="flex-1 min-w-[240px] px-3.5 py-2.5 rounded-xl bg-surface-base border border-edge text-xs font-mono text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => void handleBrowseJava()}
            className="px-4 py-2.5 rounded-xl bg-accent text-accent-fg hover:bg-accent-strong text-xs font-semibold transition-colors"
          >
            Java Seç...
          </button>
          {settings.javaPath && (
            <button
              type="button"
              onClick={() => void onUpdateSettings({ javaPath: '' })}
              className="px-3.5 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-edge text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors"
            >
              Otomatik Yap
            </button>
          )}
        </div>
      </section>

      {/* 3. Open Game Folders */}
      <section className="rounded-2xl bg-surface-panel border border-edge p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-primary">
                Oyun &amp; Veri Klasörleri
              </h3>
              <p className="text-[11px] font-mono text-ink-muted break-all">
                {systemInfo?.paths.rootDir ?? 'VortexLauncher'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenDirectory(systemInfo?.paths.rootDir)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-fg hover:bg-accent-strong text-xs font-semibold transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Oyun Klasörünü Aç</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenDirectory(systemInfo?.paths.instancesDir)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-edge text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors"
            >
              <span>Profiller</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenDirectory(systemInfo?.paths.configDir)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-edge text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors"
            >
              <span>Ayarlar (config)</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4. Behavior Toggles & Auto-Updater */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-surface-panel border border-edge p-5 space-y-3">
          <h3 className="text-sm font-semibold text-ink-primary">Launcher Davranışı</h3>

          <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
            <div>
              <div className="text-xs font-medium text-ink-primary">
                Oyun başlayınca launcher&apos;ı küçült
              </div>
              <div className="text-[11px] text-ink-muted">
                Oyun kapandığında pencere otomatik geri gelir
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.closeLauncherOnGameStart}
              onChange={(e) =>
                void onUpdateSettings({ closeLauncherOnGameStart: e.target.checked })
              }
              className="w-4 h-4 accent-[rgb(var(--accent))]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer border-t border-edge/60 pt-3">
            <div>
              <div className="text-xs font-medium text-ink-primary">
                Snapshot sürümlerini göster
              </div>
              <div className="text-[11px] text-ink-muted">
                Sürüm listesinde geliştirme sürümlerini açar
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.showSnapshots}
              onChange={(e) => void onUpdateSettings({ showSnapshots: e.target.checked })}
              className="w-4 h-4 accent-[rgb(var(--accent))]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer border-t border-edge/60 pt-3">
            <div>
              <div className="text-xs font-medium text-ink-primary">
                Açılışta otomatik güncelleme denetle
              </div>
              <div className="text-[11px] text-ink-muted">
                GitHub Releases üzerinden yeni sürümleri kontrol eder
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoCheckUpdates}
              onChange={(e) => void onUpdateSettings({ autoCheckUpdates: e.target.checked })}
              className="w-4 h-4 accent-[rgb(var(--accent))]"
            />
          </label>
        </div>

        <div className="rounded-2xl bg-surface-panel border border-edge p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-ink-primary">
              Otomatik Güncelleme (GitHub Releases)
            </h3>
            <p className="text-xs text-ink-muted">
              Mevcut sürüm: <strong className="font-mono text-ink-primary">v{systemInfo?.appVersion ?? '1.0.0'}</strong>
            </p>
            <p className="text-xs text-ink-secondary bg-surface-elevated/60 border border-edge rounded-xl p-3">
              {updaterStatus.message || 'Güncelleme durumu henüz denetlenmedi.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCheckUpdates}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-elevated hover:bg-surface-hover border border-edge text-ink-primary transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  updaterStatus.state === 'checking' ? 'animate-spin' : ''
                }`}
              />
              <span>Güncellemeleri Denetle</span>
            </button>
            {updaterStatus.state === 'available' && (
              <button
                type="button"
                onClick={onDownloadUpdate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent text-accent-fg hover:bg-accent-strong transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>İndir</span>
              </button>
            )}
            {updaterStatus.state === 'downloaded' && (
              <button
                type="button"
                onClick={onInstallUpdate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent text-accent-fg hover:bg-accent-strong transition-colors"
              >
                <span>Yeniden Başlat &amp; Kur</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 5. About & Official Website */}
      <section className="rounded-2xl bg-surface-panel border border-edge p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink-primary">
              Hakkında / Web Sitesi
            </h3>
            <p className="text-xs text-ink-muted">
              Vortex Launcher · <code className="font-mono text-ink-secondary">app.vercel.vlauncher</code> · v{systemInfo?.appVersion ?? '1.0.0'}
            </p>
            <p className="text-xs text-accent font-mono mt-0.5">{LAUNCHER_WEBSITE_URL}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenExternal(LAUNCHER_WEBSITE_URL)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-fg hover:bg-accent-strong text-xs font-semibold transition-colors"
        >
          <span>Web Sitesini Aç</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </section>
    </div>
  );
};
