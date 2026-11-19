import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { LauncherSettings, LoaderType, UpdateSettingsPatch } from '../../shared/types';
import { PathManager } from '../paths';

export const DEFAULT_THEME_ID = 'patrick-jane';

/**
 * Manages persistent launcher preferences (RAM allocation, Java path,
 * active profile, active theme ID, and behavioral toggles) inside settings.json.
 */
export class SettingsManager {
  private readonly settingsFilePath: string;
  private settings: LauncherSettings;

  constructor(private readonly paths: PathManager) {
    this.settingsFilePath = this.paths.getSettingsFilePath();
    this.settings = this.createDefaultSettings();
  }

  public async initialize(): Promise<void> {
    await fsp.mkdir(path.dirname(this.settingsFilePath), { recursive: true });
    try {
      const raw = await fsp.readFile(this.settingsFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<LauncherSettings>;
      const normalized = this.normalizeSettings(parsed);
      this.settings = normalized;

      const needsRepair =
        !parsed ||
        typeof parsed !== 'object' ||
        parsed.themeId !== normalized.themeId ||
        parsed.memoryGB !== normalized.memoryGB ||
        parsed.javaPath !== normalized.javaPath ||
        parsed.language !== normalized.language ||
        parsed.activeProfileId !== normalized.activeProfileId ||
        parsed.selectedVersion !== normalized.selectedVersion ||
        parsed.selectedLoader !== normalized.selectedLoader ||
        parsed.lastOfflineUsername !== normalized.lastOfflineUsername ||
        parsed.closeLauncherOnGameStart !== normalized.closeLauncherOnGameStart ||
        parsed.showSnapshots !== normalized.showSnapshots ||
        parsed.autoCheckUpdates !== normalized.autoCheckUpdates;

      if (needsRepair) {
        await this.save();
      }
    } catch {
      this.settings = this.createDefaultSettings();
      await this.save();
    }
  }

  public getSettings(): LauncherSettings {
    return { ...this.settings };
  }

  public async updateSettings(patch: UpdateSettingsPatch): Promise<LauncherSettings> {
    const merged: Partial<LauncherSettings> = {
      ...this.settings,
      ...patch,
    };
    this.settings = this.normalizeSettings(merged);
    await this.save();
    return this.getSettings();
  }

  public async resetSettings(): Promise<LauncherSettings> {
    this.settings = this.createDefaultSettings();
    await this.save();
    return this.getSettings();
  }

  private createDefaultSettings(): LauncherSettings {
    return {
      memoryGB: this.getDefaultMemoryGB(),
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
  }

  private normalizeSettings(input?: Partial<LauncherSettings> | null): LauncherSettings {
    const defaults = this.createDefaultSettings();
    if (!input || typeof input !== 'object') {
      return defaults;
    }

    const themeId =
      typeof input.themeId === 'string' && input.themeId.trim().length > 0
        ? input.themeId.trim()
        : defaults.themeId;

    const language =
      typeof input.language === 'string' && input.language.trim().length > 0
        ? input.language.trim()
        : defaults.language;

    const javaPath =
      typeof input.javaPath === 'string' ? input.javaPath.trim() : defaults.javaPath;

    const activeProfileId =
      typeof input.activeProfileId === 'string' && input.activeProfileId.trim().length > 0
        ? input.activeProfileId.trim()
        : null;

    const selectedVersion =
      typeof input.selectedVersion === 'string' && input.selectedVersion.trim().length > 0
        ? input.selectedVersion.trim()
        : defaults.selectedVersion;

    const selectedLoader: LoaderType =
      input.selectedLoader === 'fabric' || input.selectedLoader === 'vanilla'
        ? input.selectedLoader
        : defaults.selectedLoader;

    const lastOfflineUsername =
      typeof input.lastOfflineUsername === 'string'
        ? input.lastOfflineUsername.trim()
        : defaults.lastOfflineUsername;

    const memoryGB =
      typeof input.memoryGB === 'number' && Number.isFinite(input.memoryGB)
        ? this.clampMemoryGB(input.memoryGB)
        : defaults.memoryGB;

    return {
      memoryGB,
      javaPath,
      activeProfileId,
      selectedVersion,
      selectedLoader,
      lastOfflineUsername,
      themeId,
      language,
      closeLauncherOnGameStart:
        typeof input.closeLauncherOnGameStart === 'boolean'
          ? input.closeLauncherOnGameStart
          : defaults.closeLauncherOnGameStart,
      showSnapshots:
        typeof input.showSnapshots === 'boolean'
          ? input.showSnapshots
          : defaults.showSnapshots,
      autoCheckUpdates:
        typeof input.autoCheckUpdates === 'boolean'
          ? input.autoCheckUpdates
          : defaults.autoCheckUpdates,
    };
  }

  private getDefaultMemoryGB(): number {
    const totalGB = Math.floor(os.totalmem() / (1024 * 1024 * 1024));
    if (totalGB >= 16) return 4;
    if (totalGB >= 8) return 3;
    return 2;
  }

  private clampMemoryGB(value: number): number {
    const totalSystemGB = Math.max(2, Math.floor(os.totalmem() / (1024 * 1024 * 1024)));
    return Math.min(Math.max(1, Math.round(value * 2) / 2), totalSystemGB);
  }

  private async save(): Promise<void> {
    await fsp.mkdir(path.dirname(this.settingsFilePath), { recursive: true });
    const tempPath = `${this.settingsFilePath}.tmp`;
    await fsp.writeFile(tempPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    await fsp.rename(tempPath, this.settingsFilePath);
  }
}
