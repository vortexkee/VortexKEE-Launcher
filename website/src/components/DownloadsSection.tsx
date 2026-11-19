import React from 'react';
import {
  Apple,
  CheckCircle2,
  Download,
  ExternalLink,
  Laptop,
  Terminal,
} from 'lucide-react';
import type { ResolvedReleaseInfo } from '../config/releaseConfig';
import { formatFileSize } from '../services/githubReleases';
import type { DetectedOS } from '../utils/detectOS';

interface DownloadsSectionProps {
  release: ResolvedReleaseInfo;
  detectedOS: DetectedOS;
  loading: boolean;
}

export const DownloadsSection: React.FC<DownloadsSectionProps> = ({
  release,
  detectedOS,
  loading,
}) => {
  const { downloads } = release;

  const formattedDate = release.publishedAt
    ? new Date(release.publishedAt).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <section id="indir" className="py-16 sm:py-20 border-t border-edge/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Tüm Platformlar
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-primary">
              Vortex Launcher&apos;ı İndir
            </h2>
            <p className="text-sm text-ink-secondary max-w-xl">
              Tüm kurulum paketleri GitHub Releases üzerinden sunulur ve uygulama içi{' '}
              <code className="font-mono text-accent">electron-updater</code> ile otomatik
              güncellenir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1.5 rounded-xl bg-surface-panel border border-edge text-xs font-mono text-ink-primary">
              {loading ? 'Sürüm kontrol ediliyor...' : `Son Sürüm: ${release.version}`}
              {formattedDate ? ` · ${formattedDate}` : ''}
            </span>
            <a
              href={release.releasePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-panel hover:bg-surface-hover border border-edge text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors"
            >
              <span>GitHub Releases</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Windows Card */}
          <div
            className={`rounded-2xl border p-6 flex flex-col justify-between gap-5 transition-colors ${
              detectedOS === 'windows'
                ? 'bg-surface-panel border-accent ring-1 ring-accent/30 shadow-xl'
                : 'bg-surface-panel/80 border-edge'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent">
                  <Laptop className="w-5 h-5" />
                </div>
                {detectedOS === 'windows' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/35">
                    <CheckCircle2 className="w-3 h-3" /> Sisteminiz
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink-primary">Windows</h3>
                <p className="text-xs text-ink-muted">
                  Windows 10 / 11 · NSIS Kurulum Sihirbazı (.exe)
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <a
                href={downloads.windows.primary.url}
                className="w-full py-2.5 px-4 rounded-xl bg-accent text-accent-fg hover:bg-accent-strong text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Windows x64 (.exe)</span>
                </span>
                <span className="font-mono text-[10px] opacity-85">
                  {formatFileSize(downloads.windows.primary.sizeBytes) ?? 'NSIS'}
                </span>
              </a>

              {downloads.windows.arm64 && (
                <a
                  href={downloads.windows.arm64.url}
                  className="w-full py-2 px-3.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-edge text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center justify-between transition-colors"
                >
                  <span>Windows ARM64 (.exe)</span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {formatFileSize(downloads.windows.arm64.sizeBytes) ?? 'arm64'}
                  </span>
                </a>
              )}
            </div>
          </div>

          {/* macOS Card */}
          <div
            className={`rounded-2xl border p-6 flex flex-col justify-between gap-5 transition-colors ${
              detectedOS === 'macos'
                ? 'bg-surface-panel border-accent ring-1 ring-accent/30 shadow-xl'
                : 'bg-surface-panel/80 border-edge'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent">
                  <Apple className="w-5 h-5" />
                </div>
                {detectedOS === 'macos' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/35">
                    <CheckCircle2 className="w-3 h-3" /> Sisteminiz
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink-primary">macOS</h3>
                <p className="text-xs text-ink-muted">
                  macOS 12+ · Apple Silicon (M1–M4) &amp; Intel (.dmg)
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <a
                href={downloads.macos.arm64.url}
                className="w-full py-2.5 px-4 rounded-xl bg-accent text-accent-fg hover:bg-accent-strong text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Apple Silicon (.dmg)</span>
                </span>
                <span className="font-mono text-[10px] opacity-85">
                  {formatFileSize(downloads.macos.arm64.sizeBytes) ?? 'arm64'}
                </span>
              </a>

              <a
                href={downloads.macos.x64.url}
                className="w-full py-2 px-3.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-edge text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center justify-between transition-colors"
              >
                <span>Intel Mac (.dmg)</span>
                <span className="font-mono text-[10px] text-ink-muted">
                  {formatFileSize(downloads.macos.x64.sizeBytes) ?? 'x64'}
                </span>
              </a>
            </div>
          </div>

          {/* Linux Card */}
          <div
            className={`rounded-2xl border p-6 flex flex-col justify-between gap-5 transition-colors ${
              detectedOS === 'linux'
                ? 'bg-surface-panel border-accent ring-1 ring-accent/30 shadow-xl'
                : 'bg-surface-panel/80 border-edge'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent">
                  <Terminal className="w-5 h-5" />
                </div>
                {detectedOS === 'linux' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/35">
                    <CheckCircle2 className="w-3 h-3" /> Sisteminiz
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink-primary">Linux</h3>
                <p className="text-xs text-ink-muted">
                  Ubuntu, Debian, Arch, Fedora · .AppImage &amp; .deb
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <a
                href={downloads.linux.appImage.url}
                className="w-full py-2.5 px-4 rounded-xl bg-accent text-accent-fg hover:bg-accent-strong text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>AppImage (.AppImage)</span>
                </span>
                <span className="font-mono text-[10px] opacity-85">
                  {formatFileSize(downloads.linux.appImage.sizeBytes) ?? 'x64'}
                </span>
              </a>

              <a
                href={downloads.linux.deb.url}
                className="w-full py-2 px-3.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-edge text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center justify-between transition-colors"
              >
                <span>Debian / Ubuntu (.deb)</span>
                <span className="font-mono text-[10px] text-ink-muted">
                  {formatFileSize(downloads.linux.deb.sizeBytes) ?? 'x64'}
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
