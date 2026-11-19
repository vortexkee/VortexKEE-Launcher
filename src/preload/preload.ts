import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import {
  CreateProfileInput,
  DownloadProgressPayload,
  GameLogPayload,
  GameStatusPayload,
  LaunchGameOptions,
  LauncherAPI,
  LauncherSettings,
  ModInstallProgressPayload,
  ModInstallRequest,
  ModSearchParams,
  UpdateProfilePatch,
  UpdateSettingsPatch,
  UpdaterStatusPayload,
} from '../shared/types';

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => {
    cb(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const launcherAPI: LauncherAPI = {
  platform: process.platform,
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },

  minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  toggleMaximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE),
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  isWindowMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  onWindowMaximizedChange: (cb: (maximized: boolean) => void) =>
    subscribe(IPC_CHANNELS.EVENT_WINDOW_MAXIMIZED, cb),
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, url),

  getSystemInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO),
  selectJavaBinary: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SELECT_JAVA),
  openDirectory: (targetPath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_DIR, targetPath),

  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  updateSettings: (patch: UpdateSettingsPatch) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, patch),
  resetSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),

  listProfiles: () => ipcRenderer.invoke(IPC_CHANNELS.PROFILES_LIST),
  createProfile: (input: CreateProfileInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROFILES_CREATE, input),
  updateProfile: (id: string, patch: UpdateProfilePatch) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROFILES_UPDATE, id, patch),
  deleteProfile: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROFILES_DELETE, id),

  getAuthState: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LIST),
  loginOffline: (username: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN_OFFLINE, username),
  loginMicrosoft: (authCodeOrToken: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN_MICROSOFT, authCodeOrToken),
  refreshMicrosoftAccount: (accountId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_REFRESH_MICROSOFT, accountId),
  getMicrosoftAuthUrl: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_MICROSOFT_URL),
  setActiveAccount: (accountId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_SET_ACTIVE, accountId),
  removeAccount: (accountId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOVE, accountId),

  listVanillaVersions: (forceRefresh?: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.VERSIONS_LIST_VANILLA, forceRefresh),
  listFabricLoaders: (gameVersion: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VERSIONS_LIST_FABRIC, gameVersion),

  detectJava: (gameVersion: string, customPath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.JAVA_DETECT, gameVersion, customPath),
  installJava: (requiredMajor: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.JAVA_INSTALL, requiredMajor),

  searchMods: (params: ModSearchParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODS_SEARCH, params),
  listInstalledMods: (profileId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODS_LIST_INSTALLED, profileId),
  installMod: (request: ModInstallRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODS_INSTALL, request),
  toggleMod: (profileId: string, fileName: string, enable: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODS_TOGGLE, profileId, fileName, enable),
  deleteMod: (profileId: string, fileName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODS_DELETE, profileId, fileName),
  pickAndImportMods: (profileId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODS_PICK_FILES, profileId),
  importModFiles: (profileId: string, filePaths: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODS_IMPORT_FILES, profileId, filePaths),
  importModBuffer: (profileId: string, fileName: string, data: Uint8Array) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODS_IMPORT_BUFFER, profileId, fileName, data),
  openModsDirectory: (profileId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODS_OPEN_DIR, profileId),

  launchGame: (profileId: string, options?: LaunchGameOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.GAME_LAUNCH, profileId, options),
  stopGame: (profileId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GAME_STOP, profileId),

  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK),
  downloadUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_DOWNLOAD),
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_INSTALL),

  onDownloadProgress: (cb: (payload: DownloadProgressPayload) => void) =>
    subscribe(IPC_CHANNELS.EVENT_DOWNLOAD_PROGRESS, cb),
  onGameLog: (cb: (payload: GameLogPayload) => void) =>
    subscribe(IPC_CHANNELS.EVENT_GAME_LOG, cb),
  onGameStatus: (cb: (payload: GameStatusPayload) => void) =>
    subscribe(IPC_CHANNELS.EVENT_GAME_STATUS, cb),
  onUpdaterStatus: (cb: (payload: UpdaterStatusPayload) => void) =>
    subscribe(IPC_CHANNELS.EVENT_UPDATER_STATUS, cb),
  onSettingsChanged: (cb: (settings: LauncherSettings) => void) =>
    subscribe(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, cb),
  onModInstallProgress: (cb: (payload: ModInstallProgressPayload) => void) =>
    subscribe(IPC_CHANNELS.EVENT_MOD_INSTALL_PROGRESS, cb),
};

contextBridge.exposeInMainWorld('launcherAPI', launcherAPI);
// Alias used by the renderer (window.electronAPI).
contextBridge.exposeInMainWorld('electronAPI', launcherAPI);
