export const IPC_CHANNELS = {
  SYSTEM_GET_INFO: 'system:get-info',
  SYSTEM_SELECT_JAVA: 'system:select-java',
  SYSTEM_OPEN_DIR: 'system:open-dir',
  SYSTEM_OPEN_EXTERNAL: 'system:open-external',

  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window:toggle-maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',

  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_RESET: 'settings:reset',

  PROFILES_LIST: 'profiles:list',
  PROFILES_CREATE: 'profiles:create',
  PROFILES_UPDATE: 'profiles:update',
  PROFILES_DELETE: 'profiles:delete',

  AUTH_LIST: 'auth:list',
  AUTH_LOGIN_OFFLINE: 'auth:login-offline',
  AUTH_LOGIN_MICROSOFT: 'auth:login-microsoft',
  AUTH_REFRESH_MICROSOFT: 'auth:refresh-microsoft',
  AUTH_GET_MICROSOFT_URL: 'auth:get-microsoft-url',
  AUTH_SET_ACTIVE: 'auth:set-active',
  AUTH_REMOVE: 'auth:remove',

  VERSIONS_LIST_VANILLA: 'versions:list-vanilla',
  VERSIONS_LIST_FABRIC: 'versions:list-fabric',

  JAVA_DETECT: 'java:detect',
  JAVA_INSTALL: 'java:install',

  MODS_SEARCH: 'mods:search',
  MODS_LIST_INSTALLED: 'mods:list-installed',
  MODS_INSTALL: 'mods:install',
  MODS_TOGGLE: 'mods:toggle',
  MODS_DELETE: 'mods:delete',
  MODS_PICK_FILES: 'mods:pick-files',
  MODS_IMPORT_FILES: 'mods:import-files',
  MODS_IMPORT_BUFFER: 'mods:import-buffer',
  MODS_OPEN_DIR: 'mods:open-dir',

  GAME_LAUNCH: 'game:launch',
  GAME_STOP: 'game:stop',

  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install',

  EVENT_DOWNLOAD_PROGRESS: 'download:progress',
  EVENT_GAME_LOG: 'game:log',
  EVENT_GAME_STATUS: 'game:status',
  EVENT_UPDATER_STATUS: 'updater:status',
  EVENT_SETTINGS_CHANGED: 'settings:changed',
  EVENT_WINDOW_MAXIMIZED: 'window:maximized-changed',
  EVENT_MOD_INSTALL_PROGRESS: 'mods:install-progress',
} as const;
