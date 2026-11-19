export type LoaderType = 'vanilla' | 'fabric';

export type AuthType = 'offline' | 'microsoft';

export interface ResolutionConfig {
  width: number;
  height: number;
  fullscreen: boolean;
}

export interface MinecraftProfile {
  id: string;
  name: string;
  gameVersion: string;
  loaderType: LoaderType;
  loaderVersion?: string;
  memoryGB: number;
  resolution: ResolutionConfig;
  jvmArgs: string[];
  customJavaPath?: string;
  createdAt: string;
  lastPlayed?: string;
}

export interface CreateProfileInput {
  name: string;
  gameVersion: string;
  loaderType: LoaderType;
  loaderVersion?: string;
  memoryGB: number;
  resolution: ResolutionConfig;
  jvmArgs?: string[];
  customJavaPath?: string;
}

export type UpdateProfilePatch = Partial<Omit<MinecraftProfile, 'id' | 'createdAt'>>;

export interface AuthAccount {
  id: string;
  type: AuthType;
  username: string;
  uuid: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  skinUrl?: string;
}

export interface AuthState {
  activeAccountId: string | null;
  accounts: AuthAccount[];
}

export interface JavaRuntimeInfo {
  major: number;
  versionString: string;
  path: string;
  arch: 'x64' | 'aarch64';
  os: 'windows' | 'mac' | 'linux';
  isManaged: boolean;
}

export interface VanillaVersionEntry {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  url: string;
  releaseTime: string;
  sha1: string;
}

export interface FabricLoaderEntry {
  version: string;
  stable: boolean;
}

export type DownloadPhase =
  | 'java'
  | 'metadata'
  | 'client'
  | 'libraries'
  | 'assets'
  | 'natives'
  | 'mods';

export type DownloadFileStatus =
  | 'verifying'
  | 'downloading'
  | 'cached'
  | 'extracting'
  | 'completed'
  | 'error';

export interface DownloadProgressPayload {
  taskId: string;
  phase: DownloadPhase;
  status: DownloadFileStatus;
  fileName: string;
  currentFileIndex: number;
  totalFiles: number;
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  speedBps: number;
}

export type GameLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'STDERR';

export interface GameLogPayload {
  profileId: string;
  timestamp: string;
  level: GameLogLevel;
  line: string;
}

export type GameLifecycleState =
  | 'idle'
  | 'preparing'
  | 'downloading'
  | 'launching'
  | 'running'
  | 'crashed'
  | 'stopped';

export interface GameStatusPayload {
  profileId: string;
  state: GameLifecycleState;
  pid?: number;
  exitCode?: number;
  message?: string;
}

export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdaterStatusPayload {
  state: UpdaterState;
  version?: string;
  progress?: number;
  message?: string;
}

export interface LauncherSettings {
  memoryGB: number;
  javaPath: string;
  activeProfileId: string | null;
  selectedVersion: string;
  selectedLoader: LoaderType;
  lastOfflineUsername: string;
  themeId: string;
  language: string;
  closeLauncherOnGameStart: boolean;
  showSnapshots: boolean;
  autoCheckUpdates: boolean;
}

export type UpdateSettingsPatch = Partial<LauncherSettings>;

export interface LaunchGameOptions {
  offlineUsername?: string;
}

export type ModLoaderType = 'fabric' | 'forge' | 'neoforge';

export type ModSortIndex = 'downloads' | 'relevance' | 'updated' | 'follows';

export interface ModSearchParams {
  query: string;
  gameVersion: string;
  loader: ModLoaderType;
  index?: ModSortIndex;
  limit?: number;
  offset?: number;
}

export interface ModrinthSearchHit {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  iconUrl?: string;
  categories: string[];
  latestVersion?: string;
}

export interface ModSearchResult {
  hits: ModrinthSearchHit[];
  totalHits: number;
  offset: number;
  limit: number;
}

export interface InstalledModItem {
  fileName: string;
  baseName: string;
  displayName: string;
  enabled: boolean;
  sizeBytes: number;
  modifiedAt: string;
  projectId?: string;
  versionId?: string;
  versionNumber?: string;
  iconUrl?: string;
  source: 'modrinth' | 'local';
}

export interface ModInstallRequest {
  profileId: string;
  projectId: string;
  title?: string;
  iconUrl?: string;
  gameVersion: string;
  loader: ModLoaderType;
}

export interface ModInstallResult {
  installedFiles: string[];
  installedDependencies: string[];
  mods: InstalledModItem[];
}

export interface ModInstallProgressPayload {
  profileId: string;
  projectId: string;
  modTitle: string;
  status: 'resolving' | 'downloading' | 'installing-deps' | 'installed' | 'error';
  percentage: number;
  currentFile: string;
  dependencyCount: number;
  message: string;
}

export interface ModImportResult {
  imported: string[];
  skipped: string[];
  mods: InstalledModItem[];
}

export interface SystemPathsInfo {
  rootDir: string;
  configDir: string;
  settingsFile: string;
  runtimesDir: string;
  versionsDir: string;
  librariesDir: string;
  assetsDir: string;
  instancesDir: string;
}

export interface SystemInfo {
  platform: NodeJS.Platform;
  arch: string;
  totalMemoryGB: number;
  recommendedMemoryGB: number;
  appVersion: string;
  paths: SystemPathsInfo;
}

export interface LauncherAPI {
  /** Synchronous host platform (win32 | darwin | linux) for platform-specific chrome. */
  platform: NodeJS.Platform;
  getPathForFile: (file: File) => string;

  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  onWindowMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
  openExternal: (url: string) => Promise<void>;

  getSystemInfo: () => Promise<SystemInfo>;
  selectJavaBinary: () => Promise<string | null>;
  openDirectory: (targetPath?: string) => Promise<void>;

  getSettings: () => Promise<LauncherSettings>;
  updateSettings: (patch: UpdateSettingsPatch) => Promise<LauncherSettings>;
  resetSettings: () => Promise<LauncherSettings>;

  listProfiles: () => Promise<MinecraftProfile[]>;
  createProfile: (input: CreateProfileInput) => Promise<MinecraftProfile>;
  updateProfile: (id: string, patch: UpdateProfilePatch) => Promise<MinecraftProfile>;
  deleteProfile: (id: string) => Promise<void>;

  getAuthState: () => Promise<AuthState>;
  loginOffline: (username: string) => Promise<AuthState>;
  loginMicrosoft: (authCodeOrToken: string) => Promise<AuthState>;
  refreshMicrosoftAccount: (accountId: string) => Promise<AuthState>;
  getMicrosoftAuthUrl: () => Promise<string | null>;
  setActiveAccount: (accountId: string) => Promise<AuthState>;
  removeAccount: (accountId: string) => Promise<AuthState>;

  listVanillaVersions: (forceRefresh?: boolean) => Promise<VanillaVersionEntry[]>;
  listFabricLoaders: (gameVersion: string) => Promise<FabricLoaderEntry[]>;

  detectJava: (gameVersion: string, customPath?: string) => Promise<{
    requiredMajor: number;
    runtime: JavaRuntimeInfo | null;
  }>;
  installJava: (requiredMajor: number) => Promise<JavaRuntimeInfo>;

  searchMods: (params: ModSearchParams) => Promise<ModSearchResult>;
  listInstalledMods: (profileId: string) => Promise<InstalledModItem[]>;
  installMod: (request: ModInstallRequest) => Promise<ModInstallResult>;
  toggleMod: (
    profileId: string,
    fileName: string,
    enable: boolean,
  ) => Promise<InstalledModItem[]>;
  deleteMod: (profileId: string, fileName: string) => Promise<InstalledModItem[]>;
  pickAndImportMods: (profileId: string) => Promise<ModImportResult>;
  importModFiles: (profileId: string, filePaths: string[]) => Promise<ModImportResult>;
  importModBuffer: (
    profileId: string,
    fileName: string,
    data: Uint8Array,
  ) => Promise<ModImportResult>;
  openModsDirectory: (profileId: string) => Promise<void>;

  launchGame: (profileId: string, options?: LaunchGameOptions) => Promise<void>;
  stopGame: (profileId: string) => Promise<void>;

  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;

  onDownloadProgress: (cb: (payload: DownloadProgressPayload) => void) => () => void;
  onGameLog: (cb: (payload: GameLogPayload) => void) => () => void;
  onGameStatus: (cb: (payload: GameStatusPayload) => void) => () => void;
  onUpdaterStatus: (cb: (payload: UpdaterStatusPayload) => void) => () => void;
  onSettingsChanged: (cb: (settings: LauncherSettings) => void) => () => void;
  onModInstallProgress: (cb: (payload: ModInstallProgressPayload) => void) => () => void;
}
