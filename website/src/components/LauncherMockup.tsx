import React, { useState } from 'react';
import {
  Check,
  Cpu,
  Download,
  Gamepad2,
  Layers,
  Minus,
  Palette,
  Play,
  Puzzle,
  Settings,
  Square,
  Terminal,
  WifiOff,
  X,
} from 'lucide-react';
import type { DetectedOS } from '../utils/detectOS';

interface LauncherMockupProps {
  detectedOS: DetectedOS;
  activeThemeName: string;
  versionTag: string;
}

const SAMPLE_MODS = [
  { name: 'Sodium', desc: 'Modern OpenGL render motoru ve yüksek FPS', downloads: '34.2M', installed: true },
  { name: 'Fabric API', desc: 'Fabric modları için zorunlu çekirdek kütüphane', downloads: '68.9M', installed: true },
  { name: 'Iris Shaders', desc: 'Sodium uyumlu modern gölgelendirici desteği', downloads: '21.5M', installed: false },
];

export const LauncherMockup: React.FC<LauncherMockupProps> = ({
  detectedOS,
  activeThemeName,
  versionTag,
}) => {
  const [previewTab, setPreviewTab] = useState<'play' | 'mods'>('play');
  const [demoNick, setDemoNick] = useState('PatrickJane');
  const isMac = detectedOS === 'macos';

  return (
    <div className="rounded-2xl bg-surface-panel border border-edge-strong/80 shadow-2xl overflow-hidden select-none">
      {/* Frameless Cross-Platform Title Bar */}
      <div className="h-9 px-3 bg-surface-panel border-b border-edge flex items-center justify-between">
        {isMac ? (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-crimson" />
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span className="w-2.5 h-2.5 rounded-full bg-edge-strong" />
            <span className="ml-2 text-[11px] font-semibold tracking-wider uppercase text-ink-primary">
              Vortex Launcher
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-ink-primary">
              Vortex Launcher
            </span>
            <span className="text-[10px] font-mono text-ink-muted">{versionTag}</span>
          </div>
        )}

        {!isMac && (
          <div className="flex items-center gap-2.5 text-ink-muted">
            <Minus className="w-3 h-3" />
            <Square className="w-2.5 h-2.5" />
            <X className="w-3.5 h-3.5 hover:text-crimson" />
          </div>
        )}
      </div>

      {/* Main Window Body */}
      <div className="flex min-h-[295px] bg-surface-base">
        {/* Slim Sidebar */}
        <div className="w-16 shrink-0 bg-surface-panel/90 border-r border-edge p-2 flex flex-col gap-1.5">
          {[
            { id: 'play' as const, label: 'Oyna', icon: Gamepad2, interactive: true },
            { id: 'versions' as const, label: 'Sürümler', icon: Layers, interactive: false },
            { id: 'mods' as const, label: 'Modlar', icon: Puzzle, interactive: true },
            { id: 'themes' as const, label: 'Temalar', icon: Palette, interactive: false },
            { id: 'settings' as const, label: 'Ayarlar', icon: Settings, interactive: false },
            { id: 'logs' as const, label: 'Loglar', icon: Terminal, interactive: false },
          ].map((item) => {
            const Icon = item.icon;
            const active = item.id === previewTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'play' || item.id === 'mods') {
                    setPreviewTab(item.id);
                  }
                }}
                className={`py-1.5 rounded-lg flex flex-col items-center gap-0.5 text-[9px] transition-colors ${
                  active
                    ? 'bg-accent/15 text-accent border border-accent/40'
                    : item.interactive
                    ? 'text-ink-muted hover:text-ink-primary hover:bg-surface-hover/60 border border-transparent'
                    : 'text-ink-muted/60 border border-transparent cursor-default'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center Content */}
        <div className="flex-1 p-4 flex flex-col justify-between gap-3 min-w-0">
          {previewTab === 'play' ? (
            <>
              <div className="rounded-xl bg-surface-panel border border-edge p-4 relative overflow-hidden space-y-2">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-crimson to-accent" />
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/15 text-accent border border-accent/35">
                    {activeThemeName} Teması
                  </span>
                  <span className="text-[10px] font-mono text-ink-muted">Fabric · MC 1.21.4</span>
                </div>
                <div className="text-lg font-display font-bold text-ink-primary">
                  Fabric 1.21.4 — Hazır
                </div>
                <p className="text-[11px] text-ink-secondary leading-relaxed">
                  Adoptium Temurin Java 21 doğrulandı. SHA-256/SHA-1 bütünlüğü tam.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-surface-panel border border-edge p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-ink-muted">
                    <Cpu className="w-3 h-3 text-accent" />
                    <span>Java Runtime</span>
                  </div>
                  <div className="text-xs font-semibold text-ink-primary">Temurin 21 LTS</div>
                </div>
                <div className="rounded-xl bg-surface-panel border border-edge p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-ink-muted">
                    <Puzzle className="w-3 h-3 text-accent" />
                    <span>Modrinth Modları</span>
                  </div>
                  <div className="text-xs font-semibold text-ink-primary">2 Aktif · Otomatik Dep</div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-primary">
                  Modrinth · Popüler Modlar (1.21.4)
                </span>
                <span className="text-[10px] font-mono text-accent">Fabric</span>
              </div>
              {SAMPLE_MODS.map((mod) => (
                <div
                  key={mod.name}
                  className="rounded-xl bg-surface-panel border border-edge px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                      <span>{mod.name}</span>
                      <span className="text-[10px] font-mono text-ink-muted">{mod.downloads}</span>
                    </div>
                    <div className="text-[10px] text-ink-muted truncate">{mod.desc}</div>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold inline-flex items-center gap-1 ${
                      mod.installed
                        ? 'bg-surface-elevated text-accent border border-accent/35'
                        : 'bg-accent text-accent-fg'
                    }`}
                  >
                    {mod.installed ? (
                      <>
                        <Check className="w-3 h-3" /> Kurulu
                      </>
                    ) : (
                      <>
                        <Download className="w-3 h-3" /> Kur
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom TLauncher-Style Quick Nick & PLAY Bar */}
      <div className="px-3.5 py-2.5 bg-surface-panel border-t border-edge flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-edge flex items-center justify-center shrink-0">
            <svg viewBox="0 0 8 8" width="22" height="22" shapeRendering="crispEdges">
              <rect width="8" height="8" fill="#D7A984" />
              <rect x="0" y="0" width="8" height="2" fill="#4A3123" />
              <rect x="1" y="4" width="1" height="1" fill="#FFFFFF" />
              <rect x="2" y="4" width="1" height="1" fill="#2B5B84" />
              <rect x="5" y="4" width="1" height="1" fill="#2B5B84" />
              <rect x="6" y="4" width="1" height="1" fill="#FFFFFF" />
              <rect x="3" y="5" width="2" height="1" fill="#A97456" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-accent/15 text-accent">
                <WifiOff className="w-2.5 h-2.5" /> Çevrimdışı
              </span>
            </div>
            <input
              type="text"
              value={demoNick}
              onChange={(e) => setDemoNick(e.target.value)}
              maxLength={16}
              aria-label="Önizleme kullanıcı adı"
              className="w-full max-w-[140px] px-2 py-0.5 rounded-md bg-surface-base border border-edge text-[11px] font-medium text-ink-primary focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="px-4 py-2 rounded-xl bg-accent text-accent-fg text-xs font-bold tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md">
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>OYNA</span>
        </div>
      </div>
    </div>
  );
};
