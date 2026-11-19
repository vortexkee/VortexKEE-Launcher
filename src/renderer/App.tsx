import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type {
  AuthState,
  CreateProfileInput,
  DownloadProgressPayload,
  FabricLoaderEntry,
  GameLogPayload,
  GameStatusPayload,
  JavaRuntimeInfo,
  LauncherSettings,
  MinecraftProfile,
  ModInstallProgressPayload,
  SystemInfo,
  UpdateProfilePatch,
  UpdateSettingsPatch,
  UpdaterStatusPayload,
  VanillaVersionEntry,
} from '../shared/types';
import { BottomPlayBar } from './components/BottomPlayBar';
import { MicrosoftLoginModal } from './components/MicrosoftLoginModal';
import { NavTabId, Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { applyThemeToDocument, DEFAULT_THEME_ID } from './themes/themes';
import { getElectronAPI } from './utils/api';
import { LogsView } from './views/LogsView';
import { ModsView } from './views/ModsView';
import { PlayView } from './views/PlayView';
import { SettingsView } from './views/SettingsView';
import { ThemesView } from './views/ThemesView';
import { VersionsView } from './views/VersionsView';

const FALLBACK_SETTINGS: LauncherSettings = {
  memoryGB: 4,
  javaPath: '',
  activeProfileId: null,
  selectedVersion: '1.21.4',
  selectedLoader: 'vanilla',
  lastOfflineUsername: '',
  themeId: DEFAULT_THEME_ID,
  language: 'tr',
  closeLauncherOnGameStart: false,
  showSnapshots: false,
  autoCheckUpdates: true,
};

const MAX_LOG_LINES = 1000;

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>('play');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [settings, setSettings] = useState<LauncherSettings>(FALLBACK_SETTINGS);
  const [isMaximized, setIsMaximized] = useState(false);

  const [profiles, setProfiles] = useState<MinecraftProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  const [authState, setAuthState] = useState<AuthState>({
    activeAccountId: null,
    accounts: [],
  });
  const [offlineNickInput, setOfflineNickInput] = useState('');
  const [isQuickOfflineMode, setIsQuickOfflineMode] = useState(false);
  const [msModalOpen, setMsModalOpen] = useState(false);

  const [vanillaVersions, setVanillaVersions] = useState<VanillaVersionEntry[]>([]);
  const [fabricLoaders, setFabricLoaders] = useState<FabricLoaderEntry[]>([]);

  const [javaStatus, setJavaStatus] = useState<{
    requiredMajor: number;
    runtime: JavaRuntimeInfo | null;
  } | null>(null);
  const [checkingJava, setCheckingJava] = useState(false);
  const [installingJava, setInstallingJava] = useState(false);

  // Live IPC telemetry
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressPayload | null>(null);
  const [modInstallProgress, setModInstallProgress] =
    useState<ModInstallProgressPayload | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatusPayload>({
    profileId: '',
    state: 'idle',
  });
  const [logs, setLogs] = useState<GameLogPayload[]>([]);
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatusPayload>({ state: 'idle' });
  const [bannerError, setBannerError] = useState<string | null>(null);

  const api = getElectronAPI();
  const hostPlatform: NodeJS.Platform = api?.platform ?? systemInfo?.platform ?? 'win32';

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null,
    [profiles, selectedProfileId],
  );

  const activeAccount = useMemo(() => {
    if (!authState.accounts.length) return null;
    if (authState.activeAccountId) {
      return (
        authState.accounts.find((a) => a.id === authState.activeAccountId) ??
        authState.accounts[0]
      );
    }
    return authState.accounts[0];
  }, [authState]);

  const hasErrorLog = useMemo(
    () => logs.some((l) => l.level === 'ERROR' || l.level === 'STDERR'),
    [logs],
  );

  // Apply data-theme whenever settings.themeId changes
  useEffect(() => {
    applyThemeToDocument(settings.themeId);
  }, [settings.themeId]);

  // Initial bootstrap directly to main screen (no mandatory login wall)
  useEffect(() => {
    applyThemeToDocument(DEFAULT_THEME_ID);
    const bridge = getElectronAPI();
    if (!bridge) return;

    void (async () => {
      try {
        const [sys, loadedSettings, profList, auth, maximized, versions] =
          await Promise.all([
            bridge.getSystemInfo(),
            bridge.getSettings(),
            bridge.listProfiles(),
            bridge.getAuthState(),
            bridge.isWindowMaximized().catch(() => false),
            bridge.listVanillaVersions(false).catch(() => [] as VanillaVersionEntry[]),
          ]);

        setSystemInfo(sys);
        setSettings(loadedSettings);
        applyThemeToDocument(loadedSettings.themeId);
        setIsMaximized(maximized);
        setProfiles(profList);
        setVanillaVersions(versions);
        setAuthState(auth);

        const initialProfileId =
          loadedSettings.activeProfileId &&
          profList.some((p) => p.id === loadedSettings.activeProfileId)
            ? loadedSettings.activeProfileId
            : (profList[0]?.id ?? '');
        setSelectedProfileId(initialProfileId);

        const activeAcc =
          auth.accounts.find((a) => a.id === auth.activeAccountId) ?? auth.accounts[0] ?? null;
        if (activeAcc?.type === 'offline') {
          setOfflineNickInput(activeAcc.username);
          setIsQuickOfflineMode(false);
        } else if (activeAcc?.type === 'microsoft') {
          setOfflineNickInput(loadedSettings.lastOfflineUsername || '');
          setIsQuickOfflineMode(false);
        } else {
          setOfflineNickInput(loadedSettings.lastOfflineUsername || '');
          setIsQuickOfflineMode(true);
        }
      } catch (err) {
        setBannerError(err instanceof Error ? err.message : String(err));
      }
    })();

    const unsubProgress = bridge.onDownloadProgress((payload) => {
      setDownloadProgress(payload);
    });
    const unsubLog = bridge.onGameLog((entry) => {
      setLogs((prev) => {
        const next = [...prev, entry];
        return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
      });
    });
    const unsubStatus = bridge.onGameStatus((payload) => {
      setGameStatus(payload);
      if (payload.state === 'running' || payload.state === 'stopped' || payload.state === 'crashed') {
        setDownloadProgress(null);
      }
    });
    const unsubUpdater = bridge.onUpdaterStatus((payload) => {
      setUpdaterStatus(payload);
    });
    const unsubSettings = bridge.onSettingsChanged((updated) => {
      setSettings(updated);
      applyThemeToDocument(updated.themeId);
    });
    const unsubMaximized = bridge.onWindowMaximizedChange((maximized) => {
      setIsMaximized(maximized);
    });
    const unsubModInstall = bridge.onModInstallProgress((payload) => {
      setModInstallProgress(payload);
    });

    return () => {
      unsubProgress();
      unsubLog();
      unsubStatus();
      unsubUpdater();
      unsubSettings();
      unsubMaximized();
      unsubModInstall();
    };
  }, []);

  // Re-detect Java whenever selected profile version or custom Java path changes
  useEffect(() => {
    const bridge = getElectronAPI();
    if (!bridge || !selectedProfile) return;

    let cancelled = false;
    const effectiveJava =
      selectedProfile.customJavaPath?.trim() || settings.javaPath.trim() || undefined;

    setCheckingJava(true);
    void bridge
      .detectJava(selectedProfile.gameVersion, effectiveJava)
      .then((res) => {
        if (!cancelled) setJavaStatus(res);
      })
      .catch(() => {
        if (!cancelled) setJavaStatus(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingJava(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProfile?.gameVersion, selectedProfile?.customJavaPath, settings.javaPath]);

  const handleUpdateSettings = useCallback(
    async (patch: UpdateSettingsPatch) => {
      const bridge = getElectronAPI();
      if (!bridge) return;
      if (patch.themeId) {
        applyThemeToDocument(patch.themeId);
      }
      setSettings((prev) => ({ ...prev, ...patch }));
      try {
        const updated = await bridge.updateSettings(patch);
        setSettings(updated);
        if (patch.memoryGB !== undefined && selectedProfile) {
          const synced = await bridge.updateProfile(selectedProfile.id, {
            memoryGB: updated.memoryGB,
          });
          setProfiles((prev) => prev.map((p) => (p.id === synced.id ? synced : p)));
        }
      } catch (err) {
        setBannerError(err instanceof Error ? err.message : String(err));
      }
    },
    [selectedProfile],
  );

  const handleResetSettings = useCallback(async () => {
    const bridge = getElectronAPI();
    if (!bridge) return;
    try {
      const reset = await bridge.resetSettings();
      setSettings(reset);
      applyThemeToDocument(reset.themeId);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleSelectTheme = useCallback(
    (themeId: string) => {
      applyThemeToDocument(themeId);
      void handleUpdateSettings({ themeId });
    },
    [handleUpdateSettings],
  );

  const handleSelectProfile = useCallback(
    (profileId: string) => {
      setSelectedProfileId(profileId);
      const target = profiles.find((p) => p.id === profileId);
      if (target) {
        void handleUpdateSettings({
          activeProfileId: target.id,
          selectedVersion: target.gameVersion,
          selectedLoader: target.loaderType,
        });
      }
    },
    [profiles, handleUpdateSettings],
  );

  const handleOfflineNickChange = useCallback((value: string) => {
    setOfflineNickInput(value);
    setIsQuickOfflineMode(true);
    setBannerError(null);
  }, []);

  const handleSaveOfflineNick = useCallback(async (username: string) => {
    const bridge = getElectronAPI();
    if (!bridge) return;
    try {
      const nextAuth = await bridge.loginOffline(username);
      setAuthState(nextAuth);
      setOfflineNickInput(username);
      setIsQuickOfflineMode(false);
      setBannerError(null);
      await bridge.updateSettings({ lastOfflineUsername: username });
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleSelectAccount = useCallback(async (accountId: string) => {
    const bridge = getElectronAPI();
    if (!bridge) return;
    try {
      const nextAuth = await bridge.setActiveAccount(accountId);
      setAuthState(nextAuth);
      setIsQuickOfflineMode(false);
      const chosen = nextAuth.accounts.find((a) => a.id === accountId);
      if (chosen?.type === 'offline') {
        setOfflineNickInput(chosen.username);
      }
      setBannerError(null);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleLoginMicrosoft = useCallback(async (tokenOrCode: string) => {
    const bridge = getElectronAPI();
    if (!bridge) throw new Error('Electron IPC köprüsü bulunamadı.');
    const nextAuth = await bridge.loginMicrosoft(tokenOrCode);
    setAuthState(nextAuth);
    setIsQuickOfflineMode(false);
    setBannerError(null);
  }, []);

  const handleRefreshMicrosoftAccount = useCallback(async (accountId: string) => {
    const bridge = getElectronAPI();
    if (!bridge) return;
    try {
      const nextAuth = await bridge.refreshMicrosoftAccount(accountId);
      setAuthState(nextAuth);
      setBannerError(null);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleRemoveAccount = useCallback(async (accountId: string) => {
    const bridge = getElectronAPI();
    if (!bridge) return;
    try {
      const nextAuth = await bridge.removeAccount(accountId);
      setAuthState(nextAuth);
      if (nextAuth.accounts.length === 0) {
        setIsQuickOfflineMode(true);
      }
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleInstallJava = useCallback(async (requiredMajor: number) => {
    const bridge = getElectronAPI();
    if (!bridge) return;
    setInstallingJava(true);
    setBannerError(null);
    try {
      const installed = await bridge.installJava(requiredMajor);
      setJavaStatus({ requiredMajor, runtime: installed });
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstallingJava(false);
    }
  }, []);

  const handleLaunchOrStop = useCallback(async () => {
    const bridge = getElectronAPI();
    if (!bridge || !selectedProfile) return;

    const isBusy =
      gameStatus.profileId === selectedProfile.id &&
      ['preparing', 'downloading', 'launching', 'running'].includes(gameStatus.state);

    setBannerError(null);
    try {
      if (isBusy) {
        await bridge.stopGame(selectedProfile.id);
        return;
      }

      const useMicrosoft = !isQuickOfflineMode && activeAccount?.type === 'microsoft';
      if (useMicrosoft) {
        await bridge.launchGame(selectedProfile.id);
      } else {
        const nick = offlineNickInput.trim();
        if (!nick) {
          setBannerError(
            'Başlatmak için alt bardaki kutuya bir kullanıcı adı (Nick) yazın veya Microsoft ile giriş yapın.',
          );
          return;
        }
        await bridge.launchGame(selectedProfile.id, { offlineUsername: nick });
        const refreshedAuth = await bridge.getAuthState();
        setAuthState(refreshedAuth);
        setIsQuickOfflineMode(false);
      }
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedProfile, gameStatus, isQuickOfflineMode, activeAccount, offlineNickInput]);

  const handleCreateProfile = useCallback(
    async (input: CreateProfileInput) => {
      const bridge = getElectronAPI();
      if (!bridge) return;
      try {
        const created = await bridge.createProfile(input);
        setProfiles((prev) => [...prev, created]);
        setSelectedProfileId(created.id);
        await handleUpdateSettings({
          activeProfileId: created.id,
          selectedVersion: created.gameVersion,
          selectedLoader: created.loaderType,
        });
      } catch (err) {
        setBannerError(err instanceof Error ? err.message : String(err));
      }
    },
    [handleUpdateSettings],
  );

  const handleUpdateProfile = useCallback(
    async (id: string, patch: UpdateProfilePatch) => {
      const bridge = getElectronAPI();
      if (!bridge) return;
      try {
        const updated = await bridge.updateProfile(id, patch);
        setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
        if (id === selectedProfileId) {
          await bridge.updateSettings({
            selectedVersion: updated.gameVersion,
            selectedLoader: updated.loaderType,
            memoryGB: updated.memoryGB,
          });
        }
      } catch (err) {
        setBannerError(err instanceof Error ? err.message : String(err));
      }
    },
    [selectedProfileId],
  );

  const handleDeleteProfile = useCallback(async (id: string) => {
    const bridge = getElectronAPI();
    if (!bridge) return;
    try {
      await bridge.deleteProfile(id);
      setProfiles((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        if (selectedProfileId === id && remaining[0]) {
          setSelectedProfileId(remaining[0].id);
        }
        return remaining;
      });
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedProfileId]);

  const handleLoadFabricLoaders = useCallback(async (gameVersion: string) => {
    const bridge = getElectronAPI();
    if (!bridge) return;
    try {
      const list = await bridge.listFabricLoaders(gameVersion);
      setFabricLoaders(list);
    } catch {
      setFabricLoaders([]);
    }
  }, []);

  const handleOpenDirectory = useCallback((targetPath?: string) => {
    const bridge = getElectronAPI();
    if (!bridge) return;
    void bridge.openDirectory(targetPath).catch((err) => {
      setBannerError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  const handleOpenInstanceDir = useCallback(
    (profileId: string) => {
      if (!systemInfo?.paths.instancesDir) {
        handleOpenDirectory();
        return;
      }
      const sep = hostPlatform === 'win32' ? '\\' : '/';
      handleOpenDirectory(`${systemInfo.paths.instancesDir}${sep}${profileId}`);
    },
    [systemInfo, hostPlatform, handleOpenDirectory],
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-surface-base text-ink-primary overflow-hidden select-none">
      {/* Cross-Platform Frameless Custom Title Bar */}
      <TitleBar
        platform={hostPlatform}
        appVersion={systemInfo?.appVersion ?? '1.0.0'}
        isMaximized={isMaximized}
        updaterStatus={updaterStatus}
        onMinimize={() => void api?.minimizeWindow()}
        onToggleMaximize={() =>
          void api?.toggleMaximizeWindow().then((max) => setIsMaximized(max))
        }
        onClose={() => void api?.closeWindow()}
        onCheckUpdates={() => void api?.checkForUpdates()}
        onDownloadUpdate={() => void api?.downloadUpdate()}
        onInstallUpdate={() => void api?.installUpdate()}
      />

      {/* Error Toast Banner (non-blocking) */}
      {bannerError && (
        <div className="shrink-0 px-4 py-2 bg-crimson/15 border-b border-crimson/40 text-xs text-ink-primary flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-crimson shrink-0" />
            <span className="truncate">{bannerError}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            className="p-1 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-hover/60"
            aria-label="Hata bildirimini kapat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Middle Area: Slim Left Sidebar + Active View */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          gameState={gameStatus.state}
          logCount={logs.length}
          hasErrorLog={hasErrorLog}
        />

        <main className="flex-1 min-w-0 min-h-0 bg-surface-base overflow-hidden">
          {activeTab === 'play' && (
            <PlayView
              systemInfo={systemInfo}
              settings={settings}
              selectedProfile={selectedProfile}
              javaStatus={javaStatus}
              checkingJava={checkingJava}
              installingJava={installingJava}
              gameStatus={gameStatus}
              onInstallJava={(major) => void handleInstallJava(major)}
              onOpenRootDir={() => handleOpenDirectory(systemInfo?.paths.rootDir)}
              onOpenVersionsTab={() => setActiveTab('versions')}
              onOpenThemesTab={() => setActiveTab('themes')}
            />
          )}

          {activeTab === 'versions' && (
            <VersionsView
              systemInfo={systemInfo}
              profiles={profiles}
              selectedProfile={selectedProfile}
              vanillaVersions={vanillaVersions}
              fabricLoaders={fabricLoaders}
              showSnapshots={settings.showSnapshots}
              onToggleSnapshots={(show) => void handleUpdateSettings({ showSnapshots: show })}
              onRefreshVersions={async () => {
                const bridge = getElectronAPI();
                if (!bridge) return;
                const list = await bridge.listVanillaVersions(true);
                setVanillaVersions(list);
              }}
              onSelectProfile={handleSelectProfile}
              onCreateProfile={handleCreateProfile}
              onUpdateProfile={handleUpdateProfile}
              onDeleteProfile={handleDeleteProfile}
              onSelectJavaBinary={async () => (await api?.selectJavaBinary()) ?? null}
              onOpenInstanceDir={handleOpenInstanceDir}
              onLoadFabricLoaders={handleLoadFabricLoaders}
            />
          )}

          {activeTab === 'mods' && (
            <ModsView
              selectedProfile={selectedProfile}
              modInstallProgress={modInstallProgress}
              onError={setBannerError}
            />
          )}

          {activeTab === 'themes' && (
            <ThemesView activeThemeId={settings.themeId} onSelectTheme={handleSelectTheme} />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              systemInfo={systemInfo}
              settings={settings}
              javaStatus={javaStatus}
              installingJava={installingJava}
              updaterStatus={updaterStatus}
              onUpdateSettings={handleUpdateSettings}
              onResetSettings={handleResetSettings}
              onSelectJavaBinary={async () => (await api?.selectJavaBinary()) ?? null}
              onInstallJava={(major) => void handleInstallJava(major)}
              onOpenDirectory={handleOpenDirectory}
              onCheckUpdates={() => void api?.checkForUpdates()}
              onDownloadUpdate={() => void api?.downloadUpdate()}
              onInstallUpdate={() => void api?.installUpdate()}
              onOpenExternal={(url) => void api?.openExternal(url)}
            />
          )}

          {activeTab === 'logs' && (
            <LogsView logs={logs} onClearLogs={() => setLogs([])} />
          )}
        </main>
      </div>

      {/* Bottom Dock: Quick Nick + Account Switcher + Version Selector + Progress + PLAY */}
      <BottomPlayBar
        authState={authState}
        activeAccount={activeAccount}
        offlineNickInput={offlineNickInput}
        isQuickOfflineMode={isQuickOfflineMode}
        onOfflineNickChange={handleOfflineNickChange}
        onSaveOfflineNick={handleSaveOfflineNick}
        onSelectAccount={handleSelectAccount}
        onRefreshMicrosoftAccount={handleRefreshMicrosoftAccount}
        onRemoveAccount={handleRemoveAccount}
        onOpenMicrosoftModal={() => setMsModalOpen(true)}
        profiles={profiles}
        selectedProfile={selectedProfile}
        onSelectProfile={handleSelectProfile}
        onOpenVersionsTab={() => setActiveTab('versions')}
        downloadProgress={downloadProgress}
        gameStatus={gameStatus}
        onLaunchOrStop={() => void handleLaunchOrStop()}
      />

      {/* Optional Microsoft OAuth Modal (only triggered on user click) */}
      <MicrosoftLoginModal
        isOpen={msModalOpen}
        onClose={() => setMsModalOpen(false)}
        onSubmitToken={handleLoginMicrosoft}
        onGetAuthUrl={async () => (await api?.getMicrosoftAuthUrl()) ?? null}
        onOpenExternal={async (url) => {
          await api?.openExternal(url);
        }}
      />
    </div>
  );
}
