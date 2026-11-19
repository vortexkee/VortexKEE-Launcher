import React from 'react';
import {
  Gamepad2,
  Layers,
  Palette,
  Puzzle,
  Settings,
  Terminal,
} from 'lucide-react';
import type { GameLifecycleState } from '../../shared/types';

export type NavTabId = 'play' | 'versions' | 'mods' | 'themes' | 'settings' | 'logs';

interface SidebarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  gameState: GameLifecycleState;
  logCount: number;
  hasErrorLog: boolean;
}

const NAV_ITEMS: Array<{
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'play', label: 'Oyna', icon: Gamepad2 },
  { id: 'versions', label: 'Sürümler', icon: Layers },
  { id: 'mods', label: 'Modlar', icon: Puzzle },
  { id: 'themes', label: 'Temalar', icon: Palette },
  { id: 'settings', label: 'Ayarlar', icon: Settings },
  { id: 'logs', label: 'Loglar', icon: Terminal },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  gameState,
  logCount,
  hasErrorLog,
}) => {
  const isRunning = gameState === 'running';
  const isBusy =
    gameState === 'preparing' ||
    gameState === 'downloading' ||
    gameState === 'launching';

  return (
    <aside className="w-[78px] shrink-0 bg-surface-panel/90 border-r border-edge/80 flex flex-col items-center py-3 justify-between select-none">
      <nav className="w-full flex flex-col items-center gap-1.5 px-2" aria-label="Ana Menü">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`group relative w-full py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-150 ${
                isActive
                  ? 'bg-accent/15 text-accent border border-accent/40 shadow-sm'
                  : 'text-ink-muted hover:text-ink-primary hover:bg-surface-hover/65 border border-transparent'
              }`}
            >
              {/* Left active indicator bar with subtle burgundy/accent touch */}
              {isActive && (
                <span className="absolute -left-2 top-2.5 bottom-2.5 w-1 rounded-r-full bg-accent" />
              )}

              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.id === 'logs' && logCount > 0 && (
                  <span
                    className={`absolute -top-1 -right-1.5 w-2 h-2 rounded-full ${
                      hasErrorLog ? 'bg-crimson' : 'bg-accent'
                    }`}
                  />
                )}
              </div>
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom subtle status dot */}
      <div className="flex flex-col items-center gap-1.5 pb-1">
        <div
          title={
            isRunning
              ? 'Minecraft çalışıyor'
              : isBusy
              ? 'Başlatma hazırlanıyor'
              : 'Sistem hazır'
          }
          className="flex flex-col items-center gap-1"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              isRunning
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]'
                : isBusy
                ? 'bg-accent animate-pulse'
                : gameState === 'crashed'
                ? 'bg-crimson'
                : 'bg-edge-strong'
            }`}
          />
          <span className="text-[9px] uppercase tracking-wider text-ink-muted">
            {isRunning ? 'Aktif' : isBusy ? 'İşlem' : 'Hazır'}
          </span>
        </div>
      </div>
    </aside>
  );
};
