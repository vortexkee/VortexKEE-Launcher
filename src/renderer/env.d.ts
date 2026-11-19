/// <reference types="vite/client" />
import type { LauncherAPI } from '../shared/types';

declare global {
  interface Window {
    launcherAPI: LauncherAPI;
    electronAPI: LauncherAPI;
  }
}

export {};
