import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import { AuthManager } from './auth/AuthManager';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';
import { JavaManager } from './java/JavaManager';
import { GameLauncher } from './launcher/GameLauncher';
import { ModManager } from './mods/ModManager';
import { PathManager } from './paths';
import { ProfileManager } from './profiles/ProfileManager';
import { SettingsManager } from './settings/SettingsManager';
import { AutoUpdaterService } from './updater/AutoUpdater';
import { DownloadEngine } from './utils/downloader';
import { VersionManager } from './versions/VersionManager';

let mainWindow: BrowserWindow | null = null;

async function bootstrap(): Promise<void> {
  const paths = new PathManager();
  await paths.ensureDirectories();

  const downloader = new DownloadEngine();
  const settingsManager = new SettingsManager(paths);
  const profileManager = new ProfileManager(paths);
  const authManager = new AuthManager(paths);
  const versionManager = new VersionManager(paths, downloader);
  const javaManager = new JavaManager(paths, downloader);
  const modManager = new ModManager(paths, downloader);
  const gameLauncher = new GameLauncher(
    paths,
    downloader,
    javaManager,
    versionManager,
    profileManager,
    authManager,
    settingsManager,
  );
  const autoUpdater = new AutoUpdaterService();

  await Promise.all([
    settingsManager.initialize(),
    profileManager.initialize(),
    authManager.initialize(),
  ]);

  const currentSettings = settingsManager.getSettings();
  const profiles = profileManager.listProfiles();
  if (
    profiles.length > 0 &&
    (!currentSettings.activeProfileId ||
      !profiles.some((p) => p.id === currentSettings.activeProfileId))
  ) {
    const defaultProfile = profiles[0];
    await settingsManager.updateSettings({
      activeProfileId: defaultProfile.id,
      selectedVersion: defaultProfile.gameVersion,
      selectedLoader: defaultProfile.loaderType,
    });
  }

  registerIpcHandlers(
    {
      paths,
      settingsManager,
      profileManager,
      authManager,
      versionManager,
      javaManager,
      modManager,
      gameLauncher,
      autoUpdater,
    },
    () => mainWindow,
  );

  await createMainWindow();

  if (app.isPackaged && settingsManager.getSettings().autoCheckUpdates) {
    void autoUpdater.checkForUpdates((payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.EVENT_UPDATER_STATUS, payload);
      }
    });
  }
}

async function createMainWindow(): Promise<void> {
  const preloadPath = path.join(__dirname, '..', 'preload', 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1220,
    height: 780,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#14171F',
    title: 'Vortex Launcher',
    autoHideMenuBar: true,
    // Custom title bar: native traffic lights on macOS, fully frameless on Windows/Linux.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 16, y: 12 } }
      : { frame: false }),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(__dirname, '..', '..', 'dist', 'index.html');
    await mainWindow.loadFile(indexPath);
  }

  const notifyMaximized = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        IPC_CHANNELS.EVENT_WINDOW_MAXIMIZED,
        mainWindow.isMaximized(),
      );
    }
  };
  mainWindow.on('maximize', notifyMaximized);
  mainWindow.on('unmaximize', notifyMaximized);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  void bootstrap();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
