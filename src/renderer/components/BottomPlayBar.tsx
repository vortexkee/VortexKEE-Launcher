import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronUp,
  Layers,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Square,
  Trash2,
  User,
  WifiOff,
} from 'lucide-react';
import type {
  AuthAccount,
  AuthState,
  DownloadProgressPayload,
  GameStatusPayload,
  MinecraftProfile,
} from '../../shared/types';
import {
  formatBytes,
  formatDownloadStatus,
  formatGameStateLabel,
  formatPhaseLabel,
} from '../utils/api';
import { PlayerAvatar } from './PlayerAvatar';

interface BottomPlayBarProps {
  authState: AuthState;
  activeAccount: AuthAccount | null;
  offlineNickInput: string;
  isQuickOfflineMode: boolean;
  onOfflineNickChange: (value: string) => void;
  onSaveOfflineNick: (username: string) => Promise<void>;
  onSelectAccount: (accountId: string) => Promise<void>;
  onRefreshMicrosoftAccount: (accountId: string) => Promise<void>;
  onRemoveAccount: (accountId: string) => Promise<void>;
  onOpenMicrosoftModal: () => void;

  profiles: MinecraftProfile[];
  selectedProfile: MinecraftProfile | null;
  onSelectProfile: (profileId: string) => void;
  onOpenVersionsTab: () => void;

  downloadProgress: DownloadProgressPayload | null;
  gameStatus: GameStatusPayload;
  onLaunchOrStop: () => void;
}

export const BottomPlayBar: React.FC<BottomPlayBarProps> = ({
  authState,
  activeAccount,
  offlineNickInput,
  isQuickOfflineMode,
  onOfflineNickChange,
  onSaveOfflineNick,
  onSelectAccount,
  onRefreshMicrosoftAccount,
  onRemoveAccount,
  onOpenMicrosoftModal,
  profiles,
  selectedProfile,
  onSelectProfile,
  onOpenVersionsTab,
  downloadProgress,
  gameStatus,
  onLaunchOrStop,
}) => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [avatarMode, setAvatarMode] = useState<'3d' | '2d'>('3d');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [accountMenuOpen]);

  const effectiveIsMicrosoft = !isQuickOfflineMode && activeAccount?.type === 'microsoft';
  const displayedUsername = effectiveIsMicrosoft
    ? activeAccount?.username ?? ''
    : offlineNickInput;

  const isGameBusy =
    selectedProfile !== null &&
    gameStatus.profileId === selectedProfile.id &&
    ['preparing', 'downloading', 'launching', 'running'].includes(gameStatus.state);

  const showProgressStrip =
    downloadProgress !== null &&
    (gameStatus.state === 'preparing' ||
      gameStatus.state === 'downloading' ||
      downloadProgress.status === 'downloading' ||
      downloadProgress.status === 'verifying' ||
      downloadProgress.status === 'extracting');

  const handleRefreshMs = async (accountId: string) => {
    setRefreshingId(accountId);
    try {
      await onRefreshMicrosoftAccount(accountId);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <footer className="shrink-0 bg-surface-panel/95 border-t border-edge/90 relative z-30">
      {/* Live Download Progress Bar Strip */}
      {showProgressStrip && downloadProgress && (
        <div className="px-4 py-2 bg-surface-elevated/90 border-b border-edge/80">
          <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent font-semibold uppercase tracking-wider text-[10px] shrink-0">
                {formatPhaseLabel(downloadProgress.phase)}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-panel text-ink-secondary border border-edge text-[10px] shrink-0">
                {formatDownloadStatus(downloadProgress.status)}
              </span>
              <span className="truncate text-ink-secondary font-mono text-[11px]">
                {downloadProgress.fileName}
              </span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 font-mono text-ink-primary">
              <span className="text-ink-muted">
                {downloadProgress.currentFileIndex}/{downloadProgress.totalFiles}
              </span>
              {downloadProgress.speedBps > 0 && (
                <span className="text-ink-secondary">
                  {formatBytes(downloadProgress.speedBps)}/s
                </span>
              )}
              <span className="text-accent font-semibold">
                %{downloadProgress.percentage}
              </span>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-base overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong transition-all duration-150"
              style={{ width: `${Math.min(100, Math.max(0, downloadProgress.percentage))}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Bottom Action Dock */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Left: TLauncher-style Quick Nick + Avatar + Account Switcher */}
        <div ref={menuContainerRef} className="relative flex items-center gap-2.5 min-w-[270px] max-w-[320px] flex-1">
          <button
            type="button"
            onClick={() => setAvatarMode((m) => (m === '3d' ? '2d' : '3d'))}
            title={`Avatar görünümü: ${avatarMode.toUpperCase()} (Değiştirmek için tıklayın)`}
            className="group relative rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/60"
          >
            <PlayerAvatar username={displayedUsername || 'Steve'} size={44} mode={avatarMode} />
            <span className="absolute -bottom-1 -right-1 px-1 rounded text-[8px] font-bold uppercase bg-surface-panel border border-edge text-ink-muted group-hover:text-accent transition-colors">
              {avatarMode}
            </span>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                Oyuncu
              </span>
              {effectiveIsMicrosoft ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Microsoft
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-accent/15 text-accent border border-accent/35">
                  <WifiOff className="w-2.5 h-2.5" />
                  Çevrimdışı
                </span>
              )}
            </div>

            <div className="flex items-center rounded-xl bg-surface-base border border-edge focus-within:border-accent transition-colors overflow-hidden">
              <input
                type="text"
                value={displayedUsername}
                onChange={(e) => onOfflineNickChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGameBusy) {
                    onLaunchOrStop();
                  }
                }}
                maxLength={16}
                placeholder="Kullanıcı adı (Nick)..."
                aria-label="Oyuncu kullanıcı adı"
                className="w-full min-w-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-ink-primary placeholder:text-ink-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                title="Hesap Değiştir / Microsoft ile Giriş Yap"
                aria-expanded={accountMenuOpen}
                className={`px-2 py-1.5 border-l border-edge text-ink-secondary hover:text-accent hover:bg-surface-hover/70 transition-colors ${
                  accountMenuOpen ? 'bg-surface-hover text-accent' : ''
                }`}
              >
                <ChevronUp
                  className={`w-4 h-4 transition-transform duration-150 ${
                    accountMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Upward Account Switcher Popover */}
          {accountMenuOpen && (
            <div className="absolute bottom-[calc(100%+10px)] left-0 w-[320px] rounded-2xl bg-surface-panel border border-edge-strong shadow-2xl overflow-hidden z-50">
              <div className="px-3.5 py-2.5 border-b border-edge flex items-center justify-between bg-surface-elevated/60">
                <div>
                  <div className="text-xs font-semibold text-ink-primary">Hesaplar</div>
                  <div className="text-[10px] text-ink-muted">
                    Çevrimdışı nick veya Microsoft hesabı seçin
                  </div>
                </div>
                {offlineNickInput.trim().length >= 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      void onSaveOfflineNick(offlineNickInput.trim());
                    }}
                    title="Yazılı nicki hesap listesine kaydet"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-accent/15 text-accent border border-accent/35 hover:bg-accent/25 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Kaydet
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                {authState.accounts.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-ink-muted">
                    Kayıtlı hesap yok. Direkt kullanıcı adı yazıp <strong>OYNA</strong>&apos;ya
                    basabilir veya Microsoft hesabınızı bağlayabilirsiniz.
                  </div>
                ) : (
                  authState.accounts.map((acc) => {
                    const isSelected =
                      !isQuickOfflineMode && authState.activeAccountId === acc.id;
                    return (
                      <div
                        key={acc.id}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-accent/12 border-accent/45'
                            : 'bg-surface-base/40 border-transparent hover:bg-surface-hover/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            void onSelectAccount(acc.id).then(() => setAccountMenuOpen(false));
                          }}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                        >
                          <PlayerAvatar username={acc.username} size={30} mode="2d" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-ink-primary truncate">
                                {acc.username}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                            </div>
                            <span
                              className={`text-[10px] ${
                                acc.type === 'microsoft'
                                  ? 'text-emerald-400'
                                  : 'text-ink-muted'
                              }`}
                            >
                              {acc.type === 'microsoft' ? 'Microsoft Hesabı' : 'Çevrimdışı Mod'}
                            </span>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {acc.type === 'microsoft' && (
                            <button
                              type="button"
                              onClick={() => void handleRefreshMs(acc.id)}
                              disabled={refreshingId === acc.id}
                              title="Oturumu Yenile"
                              className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-surface-elevated transition-colors"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  refreshingId === acc.id ? 'animate-spin' : ''
                                }`}
                              />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void onRemoveAccount(acc.id)}
                            title="Hesabı Kaldır"
                            className="p-1.5 rounded-lg text-ink-muted hover:text-crimson hover:bg-crimson/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Optional Microsoft Login CTA */}
              <div className="p-2.5 border-t border-edge bg-surface-elevated/40 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onOpenMicrosoftModal();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Microsoft ile Giriş Yap</span>
                </button>
                <div className="flex items-center justify-center gap-1 text-[10px] text-ink-muted">
                  <User className="w-3 h-3" />
                  <span>Zorunlu değil · Hesapsız mod her zaman açıktır</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center: Version / Profile Selector */}
        <div className="flex-1 min-w-[200px] max-w-[340px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted flex items-center gap-1">
              <Layers className="w-3 h-3 text-accent" />
              Sürüm &amp; Profil
            </span>
            <button
              type="button"
              onClick={onOpenVersionsTab}
              className="text-[10px] text-accent hover:underline"
            >
              Yönet
            </button>
          </div>
          <select
            value={selectedProfile?.id ?? ''}
            onChange={(e) => onSelectProfile(e.target.value)}
            aria-label="Sürüm ve profil seçici"
            className="w-full px-3 py-1.5 rounded-xl bg-surface-base border border-edge text-xs font-medium text-ink-primary focus:outline-none focus:border-accent transition-colors cursor-pointer"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id} className="bg-surface-panel text-ink-primary">
                {p.name} ({p.gameVersion} · {p.loaderType === 'fabric' ? 'Fabric' : 'Vanilla'})
              </option>
            ))}
          </select>
        </div>

        {/* Status Indicator (compact on wider screens) */}
        <div className="hidden lg:flex flex-col items-end justify-center px-2 min-w-[110px]">
          <span className="text-[10px] uppercase tracking-wider text-ink-muted">Durum</span>
          <span
            className={`text-xs font-semibold truncate max-w-[140px] ${
              gameStatus.state === 'running'
                ? 'text-emerald-400'
                : gameStatus.state === 'crashed'
                ? 'text-crimson'
                : isGameBusy
                ? 'text-accent'
                : 'text-ink-secondary'
            }`}
          >
            {formatGameStateLabel(gameStatus.state)}
          </span>
        </div>

        {/* Right: Large PLAY / STOP Button */}
        <button
          type="button"
          onClick={onLaunchOrStop}
          disabled={!selectedProfile}
          className={`shrink-0 h-12 min-w-[164px] px-6 rounded-xl font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all duration-150 shadow-lg active:scale-[0.98] disabled:opacity-50 ${
            isGameBusy
              ? 'bg-crimson text-white hover:brightness-110 shadow-crimson/25'
              : 'bg-accent text-accent-fg hover:bg-accent-strong shadow-accent/25'
          }`}
        >
          {isGameBusy ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>DURDUR</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>OYNA</span>
            </>
          )}
        </button>
      </div>
    </footer>
  );
};
