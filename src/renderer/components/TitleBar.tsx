import React from 'react';
import {
  Download,
  Minus,
  RefreshCw,
  Square,
  Copy,
  X,
  Sparkles,
} from 'lucide-react';
import type { UpdaterStatusPayload } from '../../shared/types';

interface TitleBarProps {
  platform: NodeJS.Platform;
  appVersion: string;
  isMaximized: boolean;
  updaterStatus: UpdaterStatusPayload;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  onCheckUpdates: () => void;
  onDownloadUpdate: () => void;
  onInstallUpdate: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  platform,
  appVersion,
  isMaximized,
  updaterStatus,
  onMinimize,
  onToggleMaximize,
  onClose,
  onCheckUpdates,
  onDownloadUpdate,
  onInstallUpdate,
}) => {
  const isMac = platform === 'darwin';

  return (
    <header
      className={`titlebar-drag h-10 shrink-0 flex items-center justify-between bg-surface-panel/95 border-b border-edge/80 select-none z-40 ${
        isMac ? 'pl-[84px] pr-3' : 'pl-3 pr-0'
      }`}
    >
      {/* Left: Brand Mark */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-5 h-5 rounded-md bg-accent/15 border border-accent/50 flex items-center justify-center relative">
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 5l8 14L20 5" />
            <path d="M9 5l3 5.5L15 5" opacity="0.65" />
          </svg>
          <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-crimson" />
        </div>
        <div className="flex items-baseline gap-2 truncate">
          <span className="text-xs font-semibold tracking-wider uppercase text-ink-primary">
            Vortex Launcher
          </span>
          <span className="text-[10px] font-mono text-ink-muted">v{appVersion}</span>
        </div>
      </div>

      {/* Right: Updater status pill + platform window controls */}
      <div className="flex items-center h-full">
        <div className="titlebar-no-drag flex items-center gap-2 mr-2">
          {updaterStatus.state === 'available' && (
            <button
              type="button"
              onClick={onDownloadUpdate}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>v{updaterStatus.version} İndir</span>
            </button>
          )}
          {updaterStatus.state === 'downloading' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-surface-elevated text-accent border border-edge">
              <Sparkles className="w-3 h-3 animate-pulse" />
              <span>Güncelleme %{updaterStatus.progress ?? 0}</span>
            </span>
          )}
          {updaterStatus.state === 'downloaded' && (
            <button
              type="button"
              onClick={onInstallUpdate}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-accent text-accent-fg hover:bg-accent-strong transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Yeniden Başlat & Kur</span>
            </button>
          )}
          {(updaterStatus.state === 'idle' ||
            updaterStatus.state === 'checking' ||
            updaterStatus.state === 'not-available' ||
            updaterStatus.state === 'error') && (
            <button
              type="button"
              onClick={onCheckUpdates}
              disabled={updaterStatus.state === 'checking'}
              title={updaterStatus.message || 'Güncellemeleri Denetle'}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover/70 disabled:opacity-60 transition-colors"
            >
              <RefreshCw
                className={`w-3 h-3 ${
                  updaterStatus.state === 'checking' ? 'animate-spin text-accent' : ''
                }`}
              />
              <span className="hidden sm:inline">
                {updaterStatus.state === 'checking' ? 'Denetleniyor...' : 'Güncelle'}
              </span>
            </button>
          )}
        </div>

        {/* Windows / Linux custom window buttons on the right */}
        {!isMac && (
          <div className="titlebar-no-drag flex items-center h-full">
            <button
              type="button"
              onClick={onMinimize}
              aria-label="Küçült"
              className="h-full w-11 flex items-center justify-center text-ink-secondary hover:bg-surface-hover hover:text-ink-primary transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleMaximize}
              aria-label={isMaximized ? 'Geri Yükle' : 'Ekranı Kapla'}
              className="h-full w-11 flex items-center justify-center text-ink-secondary hover:bg-surface-hover hover:text-ink-primary transition-colors"
            >
              {isMaximized ? (
                <Copy className="w-3 h-3" />
              ) : (
                <Square className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="h-full w-11 flex items-center justify-center text-ink-secondary hover:bg-crimson hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
