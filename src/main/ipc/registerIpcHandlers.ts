import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as os from 'node:os';
import * as path from 'node:path';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import {
  CreateProfileInput,
  DownloadProgressPayload,
  GameLogPayload,
  GameStatusPayload,
  LaunchGameOptions,
  LauncherSettings,
  ModInstallProgressPayload,
  ModInstallRequest,
  ModSearchParams,
  SystemInfo,
  UpdateProfilePatch,
  UpdateSettingsPatch,
  UpdaterStatusPayload,
} from '../../shared/types';
import { AuthManager } from '../auth/AuthManager';
import { JavaManager } from '../java/JavaManager';
import { GameLauncher } from '../launcher/GameLauncher';
import { ModManager } from '../mods/ModManager';
import { PathManager } from '../paths';
import { ProfileManager } from '../profiles/ProfileManager';
import { SettingsManager } from '../settings/SettingsManager';
import { AutoUpdaterService } from '../updater/AutoUpdater';
import { VersionManager } from '../versions/VersionManager';

export interface MainServices {
  paths: PathManager;
  settingsManager: SettingsManager;
  profileManager: ProfileManager;
  authManager: AuthManager;
  versionManager: VersionManager;
  javaManager: JavaManager;
  modManager: ModManager;
  gameLauncher: GameLauncher;
  autoUpdater: AutoUpdaterService;
}

export function registerIpcHandlers(
  services: MainServices,
  getMainWindow: () => BrowserWindow | null,
): void {
  const sendToRenderer = (channel: string, payload: unknown) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  };

  const emitDownloadProgress = (payload: DownloadProgressPayload) =>
    sendToRenderer(IPC_CHANNELS.EVENT_DOWNLOAD_PROGRESS, payload);

  const emitGameLog = (payload: GameLogPayload) =>
    sendToRenderer(IPC_CHANNELS.EVENT_GAME_LOG, payload);

  const emitGameStatus = (payload: GameStatusPayload) =>
    sendToRenderer(IPC_CHANNELS.EVENT_GAME_STATUS, payload);

  const emitUpdaterStatus = (payload: UpdaterStatusPayload) =>
    sendToRenderer(IPC_CHANNELS.EVENT_UPDATER_STATUS, payload);

  const emitSettingsChanged = (settings: LauncherSettings) =>
    sendToRenderer(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, settings);

  const emitModInstallProgress = (payload: ModInstallProgressPayload) =>
    sendToRenderer(IPC_CHANNELS.EVENT_MOD_INSTALL_PROGRESS, payload);

  services.autoUpdater.initialize(emitUpdaterStatus);

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_INFO, (): SystemInfo => {
    const totalMemoryGB = Math.max(
      2,
      Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10,
    );
    const recommendedMemoryGB = totalMemoryGB >= 16 ? 4 : totalMemoryGB >= 8 ? 3 : 2;
    return {
      platform: process.platform,
      arch: process.arch,
      totalMemoryGB,
      recommendedMemoryGB,
      appVersion: app.getVersion(),
      paths: services.paths.getSystemPathsInfo(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SELECT_JAVA, async (): Promise<string | null> => {
    const win = getMainWindow();
    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Java Çalıştırılabilir Dosyasını Seçin',
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [{ name: 'Java Executable', extensions: ['exe'] }]
          : undefined,
    };
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM_OPEN_DIR,
    async (_event, targetPath?: string): Promise<void> => {
      const resolved = targetPath
        ? path.resolve(targetPath)
        : services.paths.getRootDir();
      if (!services.paths.isPathInsideLauncher(resolved)) {
        throw new Error('Güvenlik kısıtlaması: yalnızca Vortex Launcher dizinleri açılabilir.');
      }
      const openError = await shell.openPath(resolved);
      if (openError) {
        throw new Error(`Dizin açılamadı: ${openError}`);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL,
    async (_event, url: string): Promise<void> => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error('Geçersiz bağlantı.');
      }
      const allowedHosts = [
        'vlauncher.vercel.app',
        'login.live.com',
        'login.microsoftonline.com',
        'www.minecraft.net',
      ];
      if (parsed.protocol !== 'https:' || !allowedHosts.includes(parsed.hostname)) {
        throw new Error('Güvenlik kısıtlaması: bu bağlantı açılamaz.');
      }
      await shell.openExternal(parsed.toString());
    },
  );

  // Custom frameless window controls
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE, (): boolean => {
    const win = getMainWindow();
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    getMainWindow()?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (): boolean => {
    return getMainWindow()?.isMaximized() ?? false;
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (): LauncherSettings => {
    return services.settingsManager.getSettings();
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_UPDATE,
    async (_event, patch: UpdateSettingsPatch): Promise<LauncherSettings> => {
      const updated = await services.settingsManager.updateSettings(patch);
      emitSettingsChanged(updated);
      return updated;
    },
  );

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, async (): Promise<LauncherSettings> => {
    const reset = await services.settingsManager.resetSettings();
    emitSettingsChanged(reset);
    return reset;
  });

  // Profiles
  ipcMain.handle(IPC_CHANNELS.PROFILES_LIST, () => {
    return services.profileManager.listProfiles();
  });

  ipcMain.handle(
    IPC_CHANNELS.PROFILES_CREATE,
    (_event, input: CreateProfileInput) => {
      return services.profileManager.createProfile(input);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PROFILES_UPDATE,
    (_event, id: string, patch: UpdateProfilePatch) => {
      return services.profileManager.updateProfile(id, patch);
    },
  );

  ipcMain.handle(IPC_CHANNELS.PROFILES_DELETE, async (_event, id: string) => {
    await services.profileManager.deleteProfile(id);
    const currentSettings = services.settingsManager.getSettings();
    if (currentSettings.activeProfileId === id) {
      const fallbackProfile = services.profileManager.listProfiles()[0];
      const updatedSettings = await services.settingsManager.updateSettings({
        activeProfileId: fallbackProfile?.id ?? null,
        selectedVersion: fallbackProfile?.gameVersion ?? currentSettings.selectedVersion,
        selectedLoader: fallbackProfile?.loaderType ?? currentSettings.selectedLoader,
      });
      emitSettingsChanged(updatedSettings);
    }
  });

  // Authentication
  ipcMain.handle(IPC_CHANNELS.AUTH_LIST, () => {
    return services.authManager.getAuthState();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN_OFFLINE, (_event, username: string) => {
    return services.authManager.loginOffline(username);
  });

  ipcMain.handle(
    IPC_CHANNELS.AUTH_LOGIN_MICROSOFT,
    (_event, authCodeOrToken: string) => {
      return services.authManager.loginMicrosoft(authCodeOrToken);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AUTH_REFRESH_MICROSOFT,
    (_event, accountId: string) => {
      return services.authManager.refreshMicrosoftAccount(accountId);
    },
  );

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_MICROSOFT_URL, () => {
    return services.authManager.getMicrosoftAuthUrl();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_SET_ACTIVE, (_event, accountId: string) => {
    return services.authManager.setActiveAccount(accountId);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_REMOVE, (_event, accountId: string) => {
    return services.authManager.removeAccount(accountId);
  });

  // Versions
  ipcMain.handle(
    IPC_CHANNELS.VERSIONS_LIST_VANILLA,
    (_event, forceRefresh?: boolean) => {
      return services.versionManager.getVanillaVersions(Boolean(forceRefresh));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.VERSIONS_LIST_FABRIC,
    (_event, gameVersion: string) => {
      return services.versionManager.getFabricLoaders(gameVersion);
    },
  );

  // Java
  ipcMain.handle(
    IPC_CHANNELS.JAVA_DETECT,
    async (_event, gameVersion: string, customPath?: string) => {
      const requiredMajor = services.javaManager.getRequiredJavaMajor(gameVersion);
      const runtime = await services.javaManager.detectJava(requiredMajor, customPath);
      return { requiredMajor, runtime };
    },
  );

  ipcMain.handle(IPC_CHANNELS.JAVA_INSTALL, async (_event, requiredMajor: number) => {
    return services.javaManager.installJavaRuntime(requiredMajor, emitDownloadProgress);
  });

  // Mods (Modrinth API v2 + Local mods/ Management)
  ipcMain.handle(
    IPC_CHANNELS.MODS_SEARCH,
    (_event, params: ModSearchParams) => {
      return services.modManager.searchMods(params);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.MODS_LIST_INSTALLED,
    (_event, profileId: string) => {
      return services.modManager.listInstalledMods(profileId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.MODS_INSTALL,
    (_event, request: ModInstallRequest) => {
      return services.modManager.installMod(request, {
        onDownloadProgress: emitDownloadProgress,
        onModInstallProgress: emitModInstallProgress,
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.MODS_TOGGLE,
    (_event, profileId: string, fileName: string, enable: boolean) => {
      return services.modManager.toggleMod(profileId, fileName, enable);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.MODS_DELETE,
    (_event, profileId: string, fileName: string) => {
      return services.modManager.deleteMod(profileId, fileName);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.MODS_PICK_FILES,
    async (_event, profileId: string) => {
      const win = getMainWindow();
      const dialogOptions: Electron.OpenDialogOptions = {
        title: 'Eklenecek Mod (.jar) Dosyalarını Seçin',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Minecraft Mod (.jar)', extensions: ['jar'] }],
      };
      const result = win
        ? await dialog.showOpenDialog(win, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled || result.filePaths.length === 0) {
        return {
          imported: [],
          skipped: [],
          mods: await services.modManager.listInstalledMods(profileId),
        };
      }
      return services.modManager.importLocalModFiles(profileId, result.filePaths);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.MODS_IMPORT_FILES,
    (_event, profileId: string, filePaths: string[]) => {
      return services.modManager.importLocalModFiles(profileId, filePaths);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.MODS_IMPORT_BUFFER,
    (_event, profileId: string, fileName: string, data: Uint8Array) => {
      return services.modManager.importLocalModBuffer(profileId, fileName, data);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.MODS_OPEN_DIR,
    async (_event, profileId: string): Promise<void> => {
      const modsDir = await services.modManager.ensureModsDir(profileId);
      const openError = await shell.openPath(modsDir);
      if (openError) {
        throw new Error(`Mod klasörü açılamadı: ${openError}`);
      }
    },
  );

  // Game Launch / Stop
  ipcMain.handle(
    IPC_CHANNELS.GAME_LAUNCH,
    async (_event, profileId: string, options?: LaunchGameOptions) => {
      await services.gameLauncher.launch(
        profileId,
        {
          onDownloadProgress: emitDownloadProgress,
          onGameLog: emitGameLog,
          onGameStatus: emitGameStatus,
          onWindowVisibilityChange: (visible) => {
            const win = getMainWindow();
            if (!win || win.isDestroyed()) return;
            if (visible) {
              if (win.isMinimized()) win.restore();
              win.show();
            } else {
              win.minimize();
            }
          },
        },
        options,
      );
    },
  );

  ipcMain.handle(IPC_CHANNELS.GAME_STOP, async (_event, profileId: string) => {
    await services.gameLauncher.stopGame(profileId);
  });

  // Auto Updater
  ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK, async () => {
    await services.autoUpdater.checkForUpdates(emitUpdaterStatus);
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_DOWNLOAD, async () => {
    await services.autoUpdater.downloadUpdate();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_INSTALL, () => {
    services.autoUpdater.installUpdate();
  });
}
