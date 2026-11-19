import AdmZip from 'adm-zip';
import { ChildProcess, spawn } from 'node:child_process';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import {
  AuthAccount,
  DownloadProgressPayload,
  GameLogLevel,
  GameLogPayload,
  GameStatusPayload,
  LaunchGameOptions,
  MinecraftProfile,
} from '../../shared/types';
import { AuthManager } from '../auth/AuthManager';
import { JavaManager } from '../java/JavaManager';
import { PathManager } from '../paths';
import { ProfileManager } from '../profiles/ProfileManager';
import { SettingsManager } from '../settings/SettingsManager';
import { DownloadEngine, DownloadTask } from '../utils/downloader';
import {
  MojangArgumentItem,
  MojangLibrary,
  VersionManager,
  VersionMetadata,
} from '../versions/VersionManager';

interface AssetIndexFile {
  objects: Record<
    string,
    {
      hash: string;
      size: number;
    }
  >;
}

export interface LaunchEventCallbacks {
  onDownloadProgress: (payload: DownloadProgressPayload) => void;
  onGameLog: (payload: GameLogPayload) => void;
  onGameStatus: (payload: GameStatusPayload) => void;
  onWindowVisibilityChange?: (visible: boolean) => void;
}

export class GameLauncher {
  private readonly activeProcesses = new Map<string, ChildProcess>();

  constructor(
    private readonly paths: PathManager,
    private readonly downloader: DownloadEngine,
    private readonly javaManager: JavaManager,
    private readonly versionManager: VersionManager,
    private readonly profileManager: ProfileManager,
    private readonly authManager: AuthManager,
    private readonly settingsManager: SettingsManager,
  ) {}

  public isRunning(profileId: string): boolean {
    return this.activeProcesses.has(profileId);
  }

  public async stopGame(profileId: string): Promise<void> {
    const child = this.activeProcesses.get(profileId);
    if (!child) return;

    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 4000);
  }

  public async launch(
    profileId: string,
    callbacks: LaunchEventCallbacks,
    options?: LaunchGameOptions,
  ): Promise<void> {
    if (this.activeProcesses.has(profileId)) {
      throw new Error('Bu profil zaten çalışıyor.');
    }

    const profile = this.profileManager.getProfile(profileId);
    const settings = this.settingsManager.getSettings();
    const fallbackOffline = !this.authManager.getActiveAccount()
      ? settings.lastOfflineUsername
      : undefined;
    const requestedOfflineUsername = options?.offlineUsername?.trim() || fallbackOffline;
    const account = await this.authManager.resolveLaunchAccount(requestedOfflineUsername);

    if (options?.offlineUsername?.trim()) {
      await this.settingsManager.updateSettings({
        lastOfflineUsername: account.username,
      });
    }

    const effectiveJavaPath =
      profile.customJavaPath?.trim() || settings.javaPath.trim() || undefined;
    const effectiveMemoryGB = profile.memoryGB || settings.memoryGB;

    const emitStatus = (
      state: GameStatusPayload['state'],
      extra?: Partial<GameStatusPayload>,
    ) => {
      callbacks.onGameStatus({
        profileId: profile.id,
        state,
        ...extra,
      });
    };

    const emitLog = (level: GameLogLevel, line: string) => {
      callbacks.onGameLog({
        profileId: profile.id,
        timestamp: new Date().toISOString(),
        level,
        line,
      });
    };

    try {
      emitStatus('preparing', { message: 'Sürüm ve Java gereksinimleri hazırlanıyor...' });
      emitLog(
        'INFO',
        `[Vortex] Başlatılıyor: ${profile.name} (${profile.gameVersion} / ${profile.loaderType}) — Hesap: ${account.username} (${account.type === 'offline' ? 'Çevrimdışı' : 'Microsoft'}) — Sistem: ${process.platform}/${process.arch}`,
      );

      // 1. Ensure metadata (Vanilla + Fabric merge if needed)
      callbacks.onDownloadProgress({
        taskId: `meta-${profile.id}`,
        phase: 'metadata',
        status: 'verifying',
        fileName: `${profile.gameVersion}.json`,
        currentFileIndex: 0,
        totalFiles: 1,
        downloadedBytes: 0,
        totalBytes: 1,
        percentage: 0,
        speedBps: 0,
      });

      const { effectiveVersionId, metadata } =
        await this.versionManager.resolveVersionMetadata(
          profile.gameVersion,
          profile.loaderType,
          profile.loaderVersion,
        );

      callbacks.onDownloadProgress({
        taskId: `meta-${profile.id}`,
        phase: 'metadata',
        status: 'completed',
        fileName: `${effectiveVersionId}.json`,
        currentFileIndex: 1,
        totalFiles: 1,
        downloadedBytes: 1,
        totalBytes: 1,
        percentage: 100,
        speedBps: 0,
      });

      // 2. Ensure required Java runtime (Temurin 8/17/21 matched to OS & CPU arch)
      const requiredJavaMajor =
        metadata.javaVersion?.majorVersion ??
        this.javaManager.getRequiredJavaMajor(profile.gameVersion);

      emitStatus('downloading', {
        message: `Java ${requiredJavaMajor} çalışma zamanı doğrulanıyor...`,
      });
      const javaRuntime = await this.javaManager.ensureJavaRuntime(
        requiredJavaMajor,
        callbacks.onDownloadProgress,
        effectiveJavaPath,
      );
      emitLog(
        'INFO',
        `[Vortex] Java hazır: ${javaRuntime.versionString} (${javaRuntime.arch}) -> ${javaRuntime.path}`,
      );

      // 3. Download Client JAR
      const clientVersionId = metadata.inheritsFrom ?? profile.gameVersion;
      const clientJarPath = this.paths.getVersionJarPath(clientVersionId);
      if (metadata.downloads?.client) {
        emitStatus('downloading', { message: 'Minecraft istemci JAR indiriliyor...' });
        await this.downloader.downloadBatch(
          [
            {
              url: metadata.downloads.client.url,
              destPath: clientJarPath,
              displayName: `${clientVersionId}.jar`,
              expectedHash: metadata.downloads.client.sha1,
              hashAlgorithm: 'sha1',
              size: metadata.downloads.client.size,
            },
          ],
          {
            taskId: `client-${profile.id}`,
            phase: 'client',
            concurrency: 1,
            onProgress: callbacks.onDownloadProgress,
          },
        );
      }

      // 4. Collect and download Libraries + Natives
      emitStatus('downloading', { message: 'Kütüphaneler ve native dosyalar doğrulanıyor...' });
      const { libraryTasks, nativeArtifacts, classpathEntries } =
        this.collectLibraries(metadata, clientJarPath);

      await this.downloader.downloadBatch(libraryTasks, {
        taskId: `libs-${profile.id}`,
        phase: 'libraries',
        concurrency: 8,
        onProgress: callbacks.onDownloadProgress,
      });

      // Extract native libraries for current OS/Arch
      const nativesDir = this.paths.getNativesDir(effectiveVersionId);
      await this.extractNatives(nativeArtifacts, nativesDir, callbacks.onDownloadProgress);

      // 5. Download Asset Index & Asset Objects
      const assetIndexId = metadata.assetIndex?.id ?? metadata.assets ?? 'legacy';
      if (metadata.assetIndex) {
        emitStatus('downloading', { message: 'Oyun varlıkları (Assets) indiriliyor...' });
        const assetIndexPath = this.paths.getAssetIndexPath(assetIndexId);
        await this.downloader.downloadBatch(
          [
            {
              url: metadata.assetIndex.url,
              destPath: assetIndexPath,
              displayName: `${assetIndexId}.json`,
              expectedHash: metadata.assetIndex.sha1,
              hashAlgorithm: 'sha1',
              size: metadata.assetIndex.size,
            },
          ],
          {
            taskId: `asset-index-${profile.id}`,
            phase: 'metadata',
            concurrency: 1,
            onProgress: callbacks.onDownloadProgress,
          },
        );

        const assetIndexRaw = await fsp.readFile(assetIndexPath, 'utf-8');
        const assetIndex = JSON.parse(assetIndexRaw) as AssetIndexFile;
        const assetTasks: DownloadTask[] = Object.entries(assetIndex.objects ?? {}).map(
          ([logicalName, obj]) => {
            const prefix = obj.hash.slice(0, 2);
            return {
              url: `https://resources.download.minecraft.net/${prefix}/${obj.hash}`,
              destPath: this.paths.getAssetObjectPath(obj.hash),
              displayName: logicalName,
              expectedHash: obj.hash,
              hashAlgorithm: 'sha1',
              size: obj.size,
            };
          },
        );

        await this.downloader.downloadBatch(assetTasks, {
          taskId: `assets-${profile.id}`,
          phase: 'assets',
          concurrency: 12,
          onProgress: callbacks.onDownloadProgress,
        });
      }

      // 6. Prepare instance directory & launch arguments
      const instanceDir = this.paths.getInstanceDir(profile.id);
      await fsp.mkdir(path.join(instanceDir, 'mods'), { recursive: true });
      await fsp.mkdir(path.join(instanceDir, 'logs'), { recursive: true });

      const classpath = classpathEntries.join(path.delimiter);
      const launchArgs = this.buildLaunchArguments({
        profile,
        memoryGB: effectiveMemoryGB,
        account,
        metadata,
        effectiveVersionId,
        instanceDir,
        nativesDir,
        classpath,
        assetIndexId,
      });

      emitStatus('launching', { message: 'Minecraft JVM başlatılıyor...' });
      emitLog('INFO', `[Vortex] Ana Sınıf: ${metadata.mainClass} | RAM: ${effectiveMemoryGB} GB`);

      const child = spawn(javaRuntime.path, launchArgs, {
        cwd: instanceDir,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.activeProcesses.set(profile.id, child);
      await this.profileManager.updateProfile(profile.id, {
        lastPlayed: new Date().toISOString(),
      });

      emitStatus('running', {
        pid: child.pid,
        message: 'Minecraft çalışıyor',
      });

      if (settings.closeLauncherOnGameStart) {
        callbacks.onWindowVisibilityChange?.(false);
      }

      this.attachStreamLogger(child, profile.id, emitLog);

      child.on('error', (err) => {
        this.activeProcesses.delete(profile.id);
        emitLog('ERROR', `[Vortex] Süreç hatası: ${err.message}`);
        emitStatus('crashed', { message: err.message });
        if (settings.closeLauncherOnGameStart) {
          callbacks.onWindowVisibilityChange?.(true);
        }
      });

      child.on('close', (code) => {
        this.activeProcesses.delete(profile.id);
        if (settings.closeLauncherOnGameStart) {
          callbacks.onWindowVisibilityChange?.(true);
        }
        if (code === 0 || code === null) {
          emitLog('INFO', `[Vortex] Oyun normal şekilde kapandı (çıkış kodu: ${code ?? 0}).`);
          emitStatus('stopped', { exitCode: code ?? 0, message: 'Oyun kapatıldı' });
        } else {
          emitLog('ERROR', `[Vortex] Oyun beklenmedik şekilde kapandı (çıkış kodu: ${code}).`);
          emitStatus('crashed', {
            exitCode: code,
            message: `Oyun hata koduyla kapandı (${code})`,
          });
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emitLog('ERROR', `[Vortex] Başlatma başarısız: ${message}`);
      emitStatus('crashed', { message });
      throw err;
    }
  }

  private collectLibraries(
    metadata: VersionMetadata,
    clientJarPath: string,
  ): {
    libraryTasks: DownloadTask[];
    nativeArtifacts: Array<{ jarPath: string; exclude: string[] }>;
    classpathEntries: string[];
  } {
    const libraryTasks: DownloadTask[] = [];
    const nativeArtifacts: Array<{ jarPath: string; exclude: string[] }> = [];
    const classpathSet = new Set<string>();
    const seenDownloadPaths = new Set<string>();

    const mojangOs = this.versionManager.getMojangOsName();
    const archBits = process.arch === 'ia32' ? '32' : '64';

    for (const lib of metadata.libraries) {
      if (!this.versionManager.isRuleAllowed(lib.rules)) {
        continue;
      }

      // Main Java library artifact
      const artifact = lib.downloads?.artifact;
      if (artifact) {
        const destPath = artifact.path
          ? path.join(this.paths.getLibrariesDir(), ...artifact.path.split('/'))
          : this.paths.getLibraryPathFromMaven(lib.name);

        classpathSet.add(destPath);
        if (!seenDownloadPaths.has(destPath)) {
          seenDownloadPaths.add(destPath);
          libraryTasks.push({
            url: artifact.url,
            destPath,
            displayName: path.basename(destPath),
            expectedHash: artifact.sha1,
            hashAlgorithm: 'sha1',
            size: artifact.size,
          });
        }
      } else if (lib.url) {
        const destPath = this.paths.getLibraryPathFromMaven(lib.name);
        const relUrl = this.versionManager.getMavenRelativeUrlPath(lib.name);
        const baseUrl = lib.url.endsWith('/') ? lib.url : `${lib.url}/`;
        classpathSet.add(destPath);

        if (!seenDownloadPaths.has(destPath)) {
          seenDownloadPaths.add(destPath);
          libraryTasks.push({
            url: `${baseUrl}${relUrl}`,
            destPath,
            displayName: path.basename(destPath),
            expectedHash: lib.sha1,
            hashAlgorithm: 'sha1',
            size: lib.size,
          });
        }
      }

      // Legacy Mojang native classifier extraction (MC <= 1.18.2)
      const classifierTemplate = lib.natives?.[mojangOs];
      if (classifierTemplate && lib.downloads?.classifiers) {
        const classifierKey = classifierTemplate.replace('${arch}', archBits);
        const nativeArtifact = lib.downloads.classifiers[classifierKey];
        if (nativeArtifact) {
          const nativeJarPath = nativeArtifact.path
            ? path.join(this.paths.getLibrariesDir(), ...nativeArtifact.path.split('/'))
            : path.join(this.paths.getCacheDir(), `${classifierKey}-${path.basename(nativeArtifact.url)}`);

          if (!seenDownloadPaths.has(nativeJarPath)) {
            seenDownloadPaths.add(nativeJarPath);
            libraryTasks.push({
              url: nativeArtifact.url,
              destPath: nativeJarPath,
              displayName: path.basename(nativeJarPath),
              expectedHash: nativeArtifact.sha1,
              hashAlgorithm: 'sha1',
              size: nativeArtifact.size,
            });
          }

          nativeArtifacts.push({
            jarPath: nativeJarPath,
            exclude: lib.extract?.exclude ?? ['META-INF/'],
          });
        }
      }
    }

    classpathSet.add(clientJarPath);
    return {
      libraryTasks,
      nativeArtifacts,
      classpathEntries: Array.from(classpathSet),
    };
  }

  private async extractNatives(
    nativeArtifacts: Array<{ jarPath: string; exclude: string[] }>,
    nativesDir: string,
    onProgress: (payload: DownloadProgressPayload) => void,
  ): Promise<void> {
    await fsp.mkdir(nativesDir, { recursive: true });
    if (nativeArtifacts.length === 0) return;

    const total = nativeArtifacts.length;
    for (let i = 0; i < total; i++) {
      const item = nativeArtifacts[i];
      onProgress({
        taskId: 'natives-extract',
        phase: 'natives',
        status: 'extracting',
        fileName: path.basename(item.jarPath),
        currentFileIndex: i + 1,
        totalFiles: total,
        downloadedBytes: i + 1,
        totalBytes: total,
        percentage: Math.round(((i + 1) / total) * 100),
        speedBps: 0,
      });

      const zip = new AdmZip(item.jarPath);
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const normalizedEntry = entry.entryName.replace(/\\/g, '/');
        if (item.exclude.some((prefix) => normalizedEntry.startsWith(prefix))) {
          continue;
        }
        const safeRelative = normalizedEntry.split('/').filter((seg) => seg !== '..' && seg !== '.');
        const outPath = path.join(nativesDir, ...safeRelative);
        await fsp.mkdir(path.dirname(outPath), { recursive: true });
        await fsp.writeFile(outPath, entry.getData());
      }
    }

    onProgress({
      taskId: 'natives-extract',
      phase: 'natives',
      status: 'completed',
      fileName: path.basename(nativeArtifacts[total - 1].jarPath),
      currentFileIndex: total,
      totalFiles: total,
      downloadedBytes: total,
      totalBytes: total,
      percentage: 100,
      speedBps: 0,
    });
  }

  private buildLaunchArguments(params: {
    profile: MinecraftProfile;
    memoryGB: number;
    account: AuthAccount;
    metadata: VersionMetadata;
    effectiveVersionId: string;
    instanceDir: string;
    nativesDir: string;
    classpath: string;
    assetIndexId: string;
  }): string[] {
    const {
      profile,
      memoryGB,
      account,
      metadata,
      effectiveVersionId,
      instanceDir,
      nativesDir,
      classpath,
      assetIndexId,
    } = params;

    const replacements: Record<string, string> = {
      '${auth_player_name}': account.username,
      '${version_name}': effectiveVersionId,
      '${game_directory}': instanceDir,
      '${assets_root}': this.paths.getAssetsDir(),
      '${game_assets}': this.paths.getAssetsDir(),
      '${assets_index_name}': assetIndexId,
      '${auth_uuid}': account.uuid,
      '${auth_access_token}': account.accessToken,
      '${auth_session}': account.accessToken,
      '${user_type}': account.type === 'microsoft' ? 'msa' : 'legacy',
      '${version_type}': profile.loaderType === 'fabric' ? 'Fabric' : 'release',
      '${clientid}': 'vortex-launcher',
      '${auth_xuid}': '0',
      '${user_properties}': '{}',
      '${natives_directory}': nativesDir,
      '${library_directory}': this.paths.getLibrariesDir(),
      '${classpath_separator}': path.delimiter,
      '${classpath}': classpath,
      '${launcher_name}': 'VortexLauncher',
      '${launcher_version}': '1.0.0',
    };

    const substitute = (token: string): string => {
      let result = token;
      for (const [key, val] of Object.entries(replacements)) {
        if (result.includes(key)) {
          result = result.split(key).join(val);
        }
      }
      return result;
    };

    const jvmArgs: string[] = [
      `-Xms512M`,
      `-Xmx${Math.round(memoryGB * 1024)}M`,
      ...profile.jvmArgs,
    ];

    if (process.platform === 'darwin' && !jvmArgs.includes('-XstartOnFirstThread')) {
      jvmArgs.push('-XstartOnFirstThread');
    }

    if (metadata.arguments?.jvm && metadata.arguments.jvm.length > 0) {
      const resolvedJvm = this.resolveArgumentList(metadata.arguments.jvm).map(substitute);
      for (const arg of resolvedJvm) {
        if (arg === '-XstartOnFirstThread' && jvmArgs.includes('-XstartOnFirstThread')) {
          continue;
        }
        jvmArgs.push(arg);
      }
    } else {
      jvmArgs.push(`-Djava.library.path=${nativesDir}`, '-cp', classpath);
    }

    // Ensure classpath is present even if Fabric/custom profile omitted -cp
    if (!jvmArgs.includes('-cp')) {
      jvmArgs.push('-cp', classpath);
    }

    const gameArgs: string[] = [];
    if (metadata.arguments?.game && metadata.arguments.game.length > 0) {
      gameArgs.push(...this.resolveArgumentList(metadata.arguments.game).map(substitute));
    } else if (metadata.minecraftArguments) {
      gameArgs.push(
        ...metadata.minecraftArguments
          .split(/\s+/)
          .filter(Boolean)
          .map(substitute),
      );
    }

    // Apply user resolution configuration explicitly
    gameArgs.push(
      '--width',
      String(profile.resolution.width),
      '--height',
      String(profile.resolution.height),
    );
    if (profile.resolution.fullscreen) {
      gameArgs.push('--fullscreen');
    }

    return [...jvmArgs, metadata.mainClass, ...gameArgs];
  }

  private resolveArgumentList(items: MojangArgumentItem[]): string[] {
    const resolved: string[] = [];
    for (const item of items) {
      if (typeof item === 'string') {
        resolved.push(item);
      } else if (this.versionManager.isRuleAllowed(item.rules)) {
        if (Array.isArray(item.value)) {
          resolved.push(...item.value);
        } else {
          resolved.push(item.value);
        }
      }
    }
    return resolved;
  }

  private attachStreamLogger(
    child: ChildProcess,
    profileId: string,
    emitLog: (level: GameLogLevel, line: string) => void,
  ): void {
    const bindStream = (
      stream: NodeJS.ReadableStream | null,
      fallbackLevel: GameLogLevel,
    ) => {
      if (!stream) return;
      let remainder = '';
      stream.setEncoding('utf-8');
      stream.on('data', (chunk: string) => {
        remainder += chunk;
        const lines = remainder.split(/\r?\n/);
        remainder = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          emitLog(this.detectLogLevel(line, fallbackLevel), line);
        }
      });
      stream.on('end', () => {
        if (remainder.trim()) {
          emitLog(this.detectLogLevel(remainder, fallbackLevel), remainder.trim());
        }
      });
    };

    void profileId;
    bindStream(child.stdout, 'INFO');
    bindStream(child.stderr, 'STDERR');
  }

  private detectLogLevel(line: string, fallback: GameLogLevel): GameLogLevel {
    if (/\/ERROR\]|\bFATAL\b|\bException\b/i.test(line)) return 'ERROR';
    if (/\/WARN\]|\bWARNING\b/i.test(line)) return 'WARN';
    if (fallback === 'STDERR') return 'STDERR';
    return 'INFO';
  }
}
