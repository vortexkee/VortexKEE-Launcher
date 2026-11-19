import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import {
  DownloadProgressPayload,
  InstalledModItem,
  ModImportResult,
  ModInstallProgressPayload,
  ModInstallRequest,
  ModInstallResult,
  ModrinthSearchHit,
  ModSearchParams,
  ModSearchResult,
} from '../../shared/types';
import { PathManager } from '../paths';
import { DownloadEngine, DownloadTask } from '../utils/downloader';

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';

interface ModrinthSearchApiResponse {
  hits: Array<{
    project_id: string;
    slug: string;
    title: string;
    description: string;
    author: string;
    downloads: number;
    icon_url?: string | null;
    categories?: string[];
    latest_version?: string;
  }>;
  total_hits: number;
  offset: number;
  limit: number;
}

interface ModrinthProjectApiResponse {
  id: string;
  slug: string;
  title: string;
  icon_url?: string | null;
}

interface ModrinthDependencyApi {
  version_id?: string | null;
  project_id?: string | null;
  file_name?: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

interface ModrinthVersionFileApi {
  hashes?: {
    sha512?: string;
    sha1?: string;
  };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

interface ModrinthVersionApi {
  id: string;
  project_id: string;
  version_number: string;
  version_type: 'release' | 'beta' | 'alpha';
  game_versions: string[];
  loaders: string[];
  files: ModrinthVersionFileApi[];
  dependencies: ModrinthDependencyApi[];
}

interface PersistedModRecord {
  baseName: string;
  projectId: string;
  versionId: string;
  versionNumber: string;
  title: string;
  iconUrl?: string;
  isDependency?: boolean;
  installedAt: string;
}

interface PlannedModDownload {
  projectId: string;
  title: string;
  iconUrl?: string;
  version: ModrinthVersionApi;
  file: ModrinthVersionFileApi;
  safeFileName: string;
  isDependency: boolean;
}

export interface ModInstallCallbacks {
  onDownloadProgress?: (payload: DownloadProgressPayload) => void;
  onModInstallProgress?: (payload: ModInstallProgressPayload) => void;
}

/**
 * Manages Modrinth API v2 discovery, recursive required dependency resolution,
 * SHA-verified downloads, and local .jar / .jar.disabled mod management.
 */
export class ModManager {
  constructor(
    private readonly paths: PathManager,
    private readonly downloader: DownloadEngine,
  ) {}

  public async ensureModsDir(profileId: string): Promise<string> {
    const modsDir = this.paths.getProfileModsDir(profileId);
    await fsp.mkdir(modsDir, { recursive: true });
    return modsDir;
  }

  /**
   * Queries Modrinth v2 /search with game version and mod loader facets.
   */
  public async searchMods(params: ModSearchParams): Promise<ModSearchResult> {
    const facets: string[][] = [['project_type:mod']];
    const trimmedVersion = params.gameVersion.trim();
    if (trimmedVersion) {
      facets.push([`versions:${trimmedVersion}`]);
    }
    if (params.loader) {
      facets.push([`categories:${params.loader}`]);
    }

    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const offset = Math.max(0, params.offset ?? 0);
    const searchParams = new URLSearchParams({
      facets: JSON.stringify(facets),
      index: params.index ?? 'downloads',
      limit: String(limit),
      offset: String(offset),
    });

    const trimmedQuery = params.query.trim();
    if (trimmedQuery) {
      searchParams.set('query', trimmedQuery);
    }

    const url = `${MODRINTH_API_BASE}/search?${searchParams.toString()}`;
    const data = await this.downloader.fetchJson<ModrinthSearchApiResponse>(url);

    const hits: ModrinthSearchHit[] = (data.hits ?? []).map((item) => ({
      projectId: item.project_id,
      slug: item.slug,
      title: item.title,
      description: item.description,
      author: item.author,
      downloads: item.downloads,
      iconUrl: item.icon_url ?? undefined,
      categories: item.categories ?? [],
      latestVersion: item.latest_version,
    }));

    return {
      hits,
      totalHits: data.total_hits ?? hits.length,
      offset: data.offset ?? offset,
      limit: data.limit ?? limit,
    };
  }

  /**
   * Lists all .jar and .jar.disabled files in the profile's mods/ folder,
   * enriched with Modrinth metadata where available.
   */
  public async listInstalledMods(profileId: string): Promise<InstalledModItem[]> {
    const modsDir = await this.ensureModsDir(profileId);
    const metadataMap = await this.readMetadataMap(profileId);
    const entries = await fsp.readdir(modsDir, { withFileTypes: true }).catch(() => []);

    const items: InstalledModItem[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (name.startsWith('.') || name.endsWith('.part')) continue;

      const lower = name.toLowerCase();
      const isEnabled = lower.endsWith('.jar');
      const isDisabled = lower.endsWith('.jar.disabled');
      if (!isEnabled && !isDisabled) continue;

      const baseName = isDisabled ? name.slice(0, -'.disabled'.length) : name;
      const fullPath = path.join(modsDir, name);
      const stat = await fsp.stat(fullPath).catch(() => null);
      if (!stat) continue;

      const meta = metadataMap.get(baseName);
      items.push({
        fileName: name,
        baseName,
        displayName: meta?.title || this.formatDisplayNameFromFile(baseName),
        enabled: isEnabled,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        projectId: meta?.projectId,
        versionId: meta?.versionId,
        versionNumber: meta?.versionNumber,
        iconUrl: meta?.iconUrl,
        source: meta ? 'modrinth' : 'local',
      });
    }

    return items.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }

  /**
   * Resolves a Modrinth mod and its required dependencies for the active MC version & loader,
   * verifies hashes via SHA-512/SHA-1, and downloads missing .jar files into mods/.
   */
  public async installMod(
    request: ModInstallRequest,
    callbacks: ModInstallCallbacks = {},
  ): Promise<ModInstallResult> {
    const modsDir = await this.ensureModsDir(request.profileId);
    const modTitle = request.title?.trim() || request.projectId;

    const emitModProgress = (
      status: ModInstallProgressPayload['status'],
      percentage: number,
      currentFile: string,
      dependencyCount: number,
      message: string,
    ) => {
      callbacks.onModInstallProgress?.({
        profileId: request.profileId,
        projectId: request.projectId,
        modTitle,
        status,
        percentage,
        currentFile,
        dependencyCount,
        message,
      });
    };

    try {
      emitModProgress(
        'resolving',
        5,
        modTitle,
        0,
        `${modTitle} ve zorunlu bağımlılıkları (${request.gameVersion} / ${request.loader}) çözümleniyor...`,
      );

      const existingMods = await this.listInstalledMods(request.profileId);
      const existingBaseNames = new Set(existingMods.map((m) => m.baseName));
      const installedProjectIds = new Set(
        existingMods
          .map((m) => m.projectId)
          .filter((id): id is string => Boolean(id)),
      );

      const visitedProjects = new Set<string>();
      const planned: PlannedModDownload[] = [];

      const resolveTree = async (
        projectId: string,
        isDependency: boolean,
        preferredTitle?: string,
        preferredIconUrl?: string,
        preferredVersionId?: string,
      ): Promise<void> => {
        if (visitedProjects.has(projectId)) return;
        if (isDependency && installedProjectIds.has(projectId)) {
          return;
        }
        visitedProjects.add(projectId);

        const version = await this.findCompatibleVersion(
          projectId,
          request.gameVersion,
          request.loader,
          preferredVersionId,
          preferredTitle,
        );
        const primaryFile = this.selectPrimaryJarFile(version);
        const safeFileName = path.basename(primaryFile.filename);

        let resolvedTitle = preferredTitle;
        let resolvedIconUrl = preferredIconUrl;
        if (!resolvedTitle) {
          const projectInfo = await this.fetchProjectInfo(projectId);
          resolvedTitle = projectInfo?.title || projectId;
          resolvedIconUrl = projectInfo?.icon_url ?? undefined;
        }

        const alreadyOnDisk =
          existingBaseNames.has(safeFileName) ||
          (isDependency && installedProjectIds.has(projectId));

        if (!alreadyOnDisk) {
          planned.push({
            projectId,
            title: resolvedTitle,
            iconUrl: resolvedIconUrl,
            version,
            file: primaryFile,
            safeFileName,
            isDependency,
          });
        }

        for (const dep of version.dependencies ?? []) {
          if (dep.dependency_type !== 'required') continue;

          let depProjectId = dep.project_id ?? undefined;
          const depVersionId = dep.version_id ?? undefined;

          if (!depProjectId && depVersionId) {
            const depVersion = await this.fetchVersionById(depVersionId);
            depProjectId = depVersion?.project_id;
          }

          if (!depProjectId) continue;
          await resolveTree(depProjectId, true, undefined, undefined, depVersionId);
        }
      };

      await resolveTree(
        request.projectId,
        false,
        modTitle,
        request.iconUrl,
      );

      if (planned.length === 0) {
        const mods = await this.listInstalledMods(request.profileId);
        emitModProgress(
          'installed',
          100,
          modTitle,
          0,
          `${modTitle} zaten kurulu.`,
        );
        return {
          installedFiles: [],
          installedDependencies: [],
          mods,
        };
      }

      const depItems = planned.filter((item) => item.isDependency);
      const downloadTasks: DownloadTask[] = planned.map((item) => {
        const sha512 = item.file.hashes?.sha512;
        const sha1 = item.file.hashes?.sha1;
        return {
          url: item.file.url,
          destPath: path.join(modsDir, item.safeFileName),
          displayName: item.safeFileName,
          expectedHash: sha512 || sha1,
          hashAlgorithm: sha512 ? 'sha512' : 'sha1',
          size: item.file.size,
        };
      });

      emitModProgress(
        depItems.length > 0 ? 'installing-deps' : 'downloading',
        10,
        planned[0].safeFileName,
        depItems.length,
        depItems.length > 0
          ? `${modTitle} + ${depItems.length} zorunlu bağımlılık indiriliyor...`
          : `${modTitle} indiriliyor...`,
      );

      await this.downloader.downloadBatch(downloadTasks, {
        taskId: `mod-${request.projectId}`,
        phase: 'mods',
        concurrency: 4,
        onProgress: (payload) => {
          callbacks.onDownloadProgress?.(payload);
          emitModProgress(
            depItems.length > 0 ? 'installing-deps' : 'downloading',
            Math.max(10, Math.min(99, payload.percentage)),
            payload.fileName,
            depItems.length,
            `${payload.fileName} (%${payload.percentage})`,
          );
        },
      });

      // Persist Modrinth metadata atomically
      const metadataMap = await this.readMetadataMap(request.profileId);
      const nowIso = new Date().toISOString();
      for (const item of planned) {
        metadataMap.set(item.safeFileName, {
          baseName: item.safeFileName,
          projectId: item.projectId,
          versionId: item.version.id,
          versionNumber: item.version.version_number,
          title: item.title,
          iconUrl: item.iconUrl,
          isDependency: item.isDependency,
          installedAt: nowIso,
        });
      }
      await this.writeMetadataMap(request.profileId, metadataMap);

      const mods = await this.listInstalledMods(request.profileId);
      const installedFiles = planned.map((p) => p.safeFileName);
      const installedDependencies = depItems.map((d) => d.title);

      emitModProgress(
        'installed',
        100,
        planned[0].safeFileName,
        depItems.length,
        installedDependencies.length > 0
          ? `${modTitle} (+ ${installedDependencies.join(', ')}) kuruldu.`
          : `${modTitle} kuruldu.`,
      );

      return {
        installedFiles,
        installedDependencies,
        mods,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emitModProgress('error', 0, modTitle, 0, message);
      throw err;
    }
  }

  /**
   * Enables or disables a local mod by renaming between .jar and .jar.disabled.
   */
  public async toggleMod(
    profileId: string,
    fileName: string,
    enable: boolean,
  ): Promise<InstalledModItem[]> {
    const modsDir = await this.ensureModsDir(profileId);
    const safeName = this.sanitizeExistingModFileName(fileName);
    const srcPath = path.join(modsDir, safeName);

    const baseName = safeName.toLowerCase().endsWith('.jar.disabled')
      ? safeName.slice(0, -'.disabled'.length)
      : safeName;
    const targetName = enable ? baseName : `${baseName}.disabled`;
    const destPath = path.join(modsDir, targetName);

    if (safeName !== targetName) {
      await fsp.rename(srcPath, destPath);
    }

    return this.listInstalledMods(profileId);
  }

  /**
   * Permanently removes a mod file (.jar or .jar.disabled) and its metadata entry.
   */
  public async deleteMod(profileId: string, fileName: string): Promise<InstalledModItem[]> {
    const modsDir = await this.ensureModsDir(profileId);
    const safeName = this.sanitizeExistingModFileName(fileName);
    const targetPath = path.join(modsDir, safeName);

    await fsp.unlink(targetPath);

    const baseName = safeName.toLowerCase().endsWith('.jar.disabled')
      ? safeName.slice(0, -'.disabled'.length)
      : safeName;
    const metadataMap = await this.readMetadataMap(profileId);
    if (metadataMap.delete(baseName)) {
      await this.writeMetadataMap(profileId, metadataMap);
    }

    return this.listInstalledMods(profileId);
  }

  /**
   * Imports external .jar files into the profile's mods/ directory.
   */
  public async importLocalModFiles(
    profileId: string,
    sourcePaths: string[],
  ): Promise<ModImportResult> {
    const modsDir = await this.ensureModsDir(profileId);
    const imported: string[] = [];
    const skipped: string[] = [];

    for (const rawPath of sourcePaths) {
      const resolvedSrc = path.resolve(rawPath);
      const baseName = path.basename(resolvedSrc);
      if (!baseName.toLowerCase().endsWith('.jar')) {
        skipped.push(baseName || rawPath);
        continue;
      }

      try {
        const stat = await fsp.stat(resolvedSrc);
        if (!stat.isFile()) {
          skipped.push(baseName);
          continue;
        }
        const destPath = path.join(modsDir, baseName);
        if (path.resolve(destPath) !== resolvedSrc) {
          await fsp.copyFile(resolvedSrc, destPath);
        }
        imported.push(baseName);
      } catch {
        skipped.push(baseName);
      }
    }

    const mods = await this.listInstalledMods(profileId);
    return { imported, skipped, mods };
  }

  /**
   * Fallback import handler for Drag & Drop when only file bytes are available.
   */
  public async importLocalModBuffer(
    profileId: string,
    fileName: string,
    data: Uint8Array,
  ): Promise<ModImportResult> {
    const modsDir = await this.ensureModsDir(profileId);
    const baseName = path.basename(fileName.trim());

    if (!baseName || !baseName.toLowerCase().endsWith('.jar')) {
      return {
        imported: [],
        skipped: [baseName || fileName],
        mods: await this.listInstalledMods(profileId),
      };
    }

    const destPath = path.join(modsDir, baseName);
    const tempPath = `${destPath}.part`;
    await fsp.writeFile(tempPath, Buffer.from(data));
    await fsp.rename(tempPath, destPath);

    const mods = await this.listInstalledMods(profileId);
    return {
      imported: [baseName],
      skipped: [],
      mods,
    };
  }

  private async findCompatibleVersion(
    projectId: string,
    gameVersion: string,
    loader: string,
    preferredVersionId?: string,
    label?: string,
  ): Promise<ModrinthVersionApi> {
    const query = new URLSearchParams({
      loaders: JSON.stringify([loader]),
      game_versions: JSON.stringify([gameVersion]),
    });
    const url = `${MODRINTH_API_BASE}/project/${encodeURIComponent(projectId)}/version?${query.toString()}`;
    const versions = await this.downloader.fetchJson<ModrinthVersionApi[]>(url);

    let candidates = Array.isArray(versions) ? versions : [];

    if (candidates.length === 0 && preferredVersionId) {
      const exact = await this.fetchVersionById(preferredVersionId);
      if (
        exact &&
        exact.loaders.includes(loader) &&
        exact.game_versions.includes(gameVersion)
      ) {
        candidates = [exact];
      }
    }

    if (candidates.length === 0) {
      throw new Error(
        `"${label || projectId}" için Minecraft ${gameVersion} (${loader}) ile uyumlu sürüm bulunamadı.`,
      );
    }

    if (preferredVersionId) {
      const exactPreferred = candidates.find((v) => v.id === preferredVersionId);
      if (exactPreferred) return exactPreferred;
    }

    const releaseMatch = candidates.find((v) => v.version_type === 'release');
    if (releaseMatch) return releaseMatch;
    const betaMatch = candidates.find((v) => v.version_type === 'beta');
    return betaMatch ?? candidates[0];
  }

  private selectPrimaryJarFile(version: ModrinthVersionApi): ModrinthVersionFileApi {
    const jarFiles = (version.files ?? []).filter((f) =>
      f.filename.toLowerCase().endsWith('.jar'),
    );
    const primary = jarFiles.find((f) => f.primary) ?? jarFiles[0];
    if (!primary) {
      throw new Error(`Sürüm (${version.version_number}) içinde indirilebilir .jar dosyası bulunamadı.`);
    }
    return primary;
  }

  private async fetchProjectInfo(projectId: string): Promise<ModrinthProjectApiResponse | null> {
    try {
      return await this.downloader.fetchJson<ModrinthProjectApiResponse>(
        `${MODRINTH_API_BASE}/project/${encodeURIComponent(projectId)}`,
      );
    } catch {
      return null;
    }
  }

  private async fetchVersionById(versionId: string): Promise<ModrinthVersionApi | null> {
    try {
      return await this.downloader.fetchJson<ModrinthVersionApi>(
        `${MODRINTH_API_BASE}/version/${encodeURIComponent(versionId)}`,
      );
    } catch {
      return null;
    }
  }

  private sanitizeExistingModFileName(fileName: string): string {
    const trimmed = fileName.trim();
    const base = path.basename(trimmed);
    const lower = base.toLowerCase();
    if (
      !base ||
      base !== trimmed ||
      base === '.' ||
      base === '..' ||
      base.startsWith('.') ||
      (!lower.endsWith('.jar') && !lower.endsWith('.jar.disabled'))
    ) {
      throw new Error(`Geçersiz mod dosya adı: ${fileName}`);
    }
    return base;
  }

  private formatDisplayNameFromFile(baseName: string): string {
    return baseName.replace(/\.jar$/i, '');
  }

  private async readMetadataMap(
    profileId: string,
  ): Promise<Map<string, PersistedModRecord>> {
    const metaPath = this.paths.getProfileModsMetadataPath(profileId);
    const map = new Map<string, PersistedModRecord>();
    try {
      const raw = await fsp.readFile(metaPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, PersistedModRecord>;
      if (parsed && typeof parsed === 'object') {
        for (const [key, val] of Object.entries(parsed)) {
          if (val && typeof val === 'object' && val.baseName) {
            map.set(key, val);
          }
        }
      }
    } catch {
      // No metadata file yet
    }
    return map;
  }

  private async writeMetadataMap(
    profileId: string,
    map: Map<string, PersistedModRecord>,
  ): Promise<void> {
    const metaPath = this.paths.getProfileModsMetadataPath(profileId);
    await fsp.mkdir(path.dirname(metaPath), { recursive: true });
    const serialized = Object.fromEntries(map.entries());
    const tempPath = `${metaPath}.tmp`;
    await fsp.writeFile(tempPath, JSON.stringify(serialized, null, 2), 'utf-8');
    await fsp.rename(tempPath, metaPath);
  }
}
