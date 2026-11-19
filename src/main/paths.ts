import { app } from 'electron';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { SystemPathsInfo } from '../shared/types';

const LAUNCHER_DIR_NAME = 'VortexLauncher';

/**
 * Resolves cross-platform directory paths using Electron's app.getPath('appData')
 * and Node's path.join so Windows, macOS, and Linux layouts remain strictly isolated and portable.
 */
export class PathManager {
  private readonly rootDir: string;
  private readonly configRootDir: string;

  constructor(customRootDir?: string) {
    if (customRootDir) {
      this.rootDir = path.resolve(customRootDir);
      this.configRootDir = this.rootDir;
      return;
    }

    const appDataDir = this.resolveAppDataDir();
    this.configRootDir = path.join(appDataDir, LAUNCHER_DIR_NAME);

    if (process.platform === 'linux') {
      // On Linux, app.getPath('appData') points to ~/.config ($XDG_CONFIG_HOME).
      // Large game data belongs in ~/.local/share ($XDG_DATA_HOME), while configs remain in ~/.config.
      const xdgDataHome =
        process.env.XDG_DATA_HOME && process.env.XDG_DATA_HOME.trim().length > 0
          ? process.env.XDG_DATA_HOME
          : path.join(os.homedir(), '.local', 'share');
      this.rootDir = path.join(xdgDataHome, LAUNCHER_DIR_NAME);
    } else {
      // Windows (%APPDATA%) and macOS (~/Library/Application Support)
      this.rootDir = path.join(appDataDir, LAUNCHER_DIR_NAME);
    }
  }

  private resolveAppDataDir(): string {
    try {
      return app.getPath('appData');
    } catch {
      if (process.platform === 'win32') {
        return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      }
      if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support');
      }
      return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    }
  }

  public getRootDir(): string {
    return this.rootDir;
  }

  public getConfigDir(): string {
    return path.join(this.configRootDir, 'config');
  }

  public getConfigFilePath(fileName: string): string {
    return path.join(this.getConfigDir(), fileName);
  }

  public getSettingsFilePath(): string {
    return this.getConfigFilePath('settings.json');
  }

  public isPathInsideLauncher(targetPath: string): boolean {
    return (
      this.isWithinDir(this.rootDir, targetPath) ||
      this.isWithinDir(this.configRootDir, targetPath)
    );
  }

  private isWithinDir(baseDir: string, candidatePath: string): boolean {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(candidatePath);
    const rel = path.relative(resolvedBase, resolvedTarget);
    return (
      rel === '' ||
      (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))
    );
  }

  public getRuntimesDir(): string {
    return path.join(this.rootDir, 'runtimes');
  }

  public getManagedJavaDir(major: number, osName: string, archName: string): string {
    return path.join(this.getRuntimesDir(), `java-${major}-${osName}-${archName}`);
  }

  public getVersionsDir(): string {
    return path.join(this.rootDir, 'versions');
  }

  public getVersionDir(versionId: string): string {
    return path.join(this.getVersionsDir(), versionId);
  }

  public getVersionJsonPath(versionId: string): string {
    return path.join(this.getVersionDir(versionId), `${versionId}.json`);
  }

  public getVersionJarPath(versionId: string): string {
    return path.join(this.getVersionDir(versionId), `${versionId}.jar`);
  }

  public getNativesDir(versionId: string): string {
    return path.join(this.getVersionDir(versionId), 'natives');
  }

  public getLibrariesDir(): string {
    return path.join(this.rootDir, 'libraries');
  }

  /**
   * Converts a Maven coordinate (group:artifact:version[:classifier][@ext])
   * into a platform-safe file path inside libraries/.
   */
  public getLibraryPathFromMaven(coordinate: string): string {
    const [coordWithoutExt, explicitExt] = coordinate.split('@');
    const ext = explicitExt || 'jar';
    const parts = coordWithoutExt.split(':');
    const [group, artifact, version, classifier] = parts;
    const groupSegments = group.split('.');
    const fileName = classifier
      ? `${artifact}-${version}-${classifier}.${ext}`
      : `${artifact}-${version}.${ext}`;
    return path.join(this.getLibrariesDir(), ...groupSegments, artifact, version, fileName);
  }

  public getAssetsDir(): string {
    return path.join(this.rootDir, 'assets');
  }

  public getAssetIndexesDir(): string {
    return path.join(this.getAssetsDir(), 'indexes');
  }

  public getAssetIndexPath(indexId: string): string {
    return path.join(this.getAssetIndexesDir(), `${indexId}.json`);
  }

  public getAssetObjectsDir(): string {
    return path.join(this.getAssetsDir(), 'objects');
  }

  public getAssetObjectPath(sha1Hash: string): string {
    const prefix = sha1Hash.slice(0, 2);
    return path.join(this.getAssetObjectsDir(), prefix, sha1Hash);
  }

  public getInstancesDir(): string {
    return path.join(this.rootDir, 'instances');
  }

  public getInstanceDir(profileId: string): string {
    return path.join(this.getInstancesDir(), profileId);
  }

  public getProfileModsDir(profileId: string): string {
    return path.join(this.getInstanceDir(profileId), 'mods');
  }

  public getProfileModsMetadataPath(profileId: string): string {
    return path.join(this.getProfileModsDir(profileId), '.vortex-mods.json');
  }

  public getCacheDir(): string {
    return path.join(this.rootDir, 'cache');
  }

  public getSystemPathsInfo(): SystemPathsInfo {
    return {
      rootDir: this.getRootDir(),
      configDir: this.getConfigDir(),
      settingsFile: this.getSettingsFilePath(),
      runtimesDir: this.getRuntimesDir(),
      versionsDir: this.getVersionsDir(),
      librariesDir: this.getLibrariesDir(),
      assetsDir: this.getAssetsDir(),
      instancesDir: this.getInstancesDir(),
    };
  }

  public async ensureDirectories(): Promise<void> {
    const dirs = [
      this.getRootDir(),
      this.getConfigDir(),
      this.getRuntimesDir(),
      this.getVersionsDir(),
      this.getLibrariesDir(),
      this.getAssetIndexesDir(),
      this.getAssetObjectsDir(),
      this.getInstancesDir(),
      this.getCacheDir(),
    ];
    await Promise.all(dirs.map((dir) => fs.mkdir(dir, { recursive: true })));
  }
}
