import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import {
  FabricLoaderEntry,
  LoaderType,
  VanillaVersionEntry,
} from '../../shared/types';
import { PathManager } from '../paths';
import { DownloadEngine } from '../utils/downloader';

export interface MojangRule {
  action: 'allow' | 'disallow';
  os?: {
    name?: 'windows' | 'osx' | 'linux';
    arch?: string;
    version?: string;
  };
  features?: Record<string, boolean>;
}

export interface MojangArtifact {
  path?: string;
  sha1?: string;
  size?: number;
  url: string;
}

export interface MojangLibrary {
  name: string;
  url?: string;
  sha1?: string;
  size?: number;
  downloads?: {
    artifact?: MojangArtifact;
    classifiers?: Record<string, MojangArtifact>;
  };
  natives?: Record<string, string>;
  extract?: {
    exclude?: string[];
  };
  rules?: MojangRule[];
}

export type MojangArgumentItem =
  | string
  | {
      rules: MojangRule[];
      value: string | string[];
    };

export interface VersionMetadata {
  id: string;
  inheritsFrom?: string;
  mainClass: string;
  assets?: string;
  assetIndex?: {
    id: string;
    sha1: string;
    size: number;
    totalSize?: number;
    url: string;
  };
  downloads?: {
    client?: {
      sha1: string;
      size: number;
      url: string;
    };
  };
  javaVersion?: {
    component?: string;
    majorVersion: number;
  };
  libraries: MojangLibrary[];
  arguments?: {
    game?: MojangArgumentItem[];
    jvm?: MojangArgumentItem[];
  };
  minecraftArguments?: string;
}

interface MojangManifestV2 {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: VanillaVersionEntry[];
}

interface FabricMetaLoaderResponseItem {
  loader: {
    version: string;
    stable: boolean;
  };
}

const MOJANG_MANIFEST_URL =
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC_META_BASE = 'https://meta.fabricmc.net/v2/versions/loader';

export class VersionManager {
  private cachedVanillaVersions: VanillaVersionEntry[] | null = null;

  constructor(
    private readonly paths: PathManager,
    private readonly downloader: DownloadEngine,
  ) {}

  public async getVanillaVersions(
    forceRefresh = false,
  ): Promise<VanillaVersionEntry[]> {
    if (this.cachedVanillaVersions && !forceRefresh) {
      return this.cachedVanillaVersions;
    }

    const cachePath = path.join(this.paths.getCacheDir(), 'version_manifest_v2.json');

    try {
      const manifest = await this.downloader.fetchJson<MojangManifestV2>(MOJANG_MANIFEST_URL);
      if (Array.isArray(manifest.versions)) {
        this.cachedVanillaVersions = manifest.versions;
        await fsp.mkdir(path.dirname(cachePath), { recursive: true });
        await fsp.writeFile(cachePath, JSON.stringify(manifest), 'utf-8').catch(() => undefined);
        return this.cachedVanillaVersions;
      }
    } catch (err) {
      try {
        const cachedRaw = await fsp.readFile(cachePath, 'utf-8');
        const cached = JSON.parse(cachedRaw) as MojangManifestV2;
        if (Array.isArray(cached.versions)) {
          this.cachedVanillaVersions = cached.versions;
          return this.cachedVanillaVersions;
        }
      } catch {
        throw err;
      }
    }

    return [];
  }

  public async getFabricLoaders(gameVersion: string): Promise<FabricLoaderEntry[]> {
    const url = `${FABRIC_META_BASE}/${encodeURIComponent(gameVersion)}`;
    const items = await this.downloader.fetchJson<FabricMetaLoaderResponseItem[]>(url);
    if (!Array.isArray(items)) return [];

    return items.map((item) => ({
      version: item.loader.version,
      stable: Boolean(item.loader.stable),
    }));
  }

  /**
   * Resolves and merges Vanilla + optional Fabric version metadata into a single launchable descriptor.
   */
  public async resolveVersionMetadata(
    gameVersion: string,
    loaderType: LoaderType,
    loaderVersion?: string,
  ): Promise<{ effectiveVersionId: string; metadata: VersionMetadata }> {
    const vanillaMeta = await this.fetchAndCacheVanillaMetadata(gameVersion);

    if (loaderType === 'vanilla') {
      return {
        effectiveVersionId: gameVersion,
        metadata: vanillaMeta,
      };
    }

    // Fabric loader resolution
    let resolvedLoader = loaderVersion?.trim();
    if (!resolvedLoader) {
      const available = await this.getFabricLoaders(gameVersion);
      const preferred = available.find((item) => item.stable) ?? available[0];
      if (!preferred) {
        throw new Error(`Minecraft ${gameVersion} için uyumlu Fabric sürümü bulunamadı.`);
      }
      resolvedLoader = preferred.version;
    }

    const effectiveVersionId = `fabric-loader-${resolvedLoader}-${gameVersion}`;
    const fabricJsonPath = this.paths.getVersionJsonPath(effectiveVersionId);
    const fabricProfileUrl = `${FABRIC_META_BASE}/${encodeURIComponent(gameVersion)}/${encodeURIComponent(resolvedLoader)}/profile/json`;

    let fabricMeta: VersionMetadata;
    try {
      fabricMeta = await this.downloader.fetchJson<VersionMetadata>(fabricProfileUrl);
      await fsp.mkdir(path.dirname(fabricJsonPath), { recursive: true });
      await fsp.writeFile(fabricJsonPath, JSON.stringify(fabricMeta, null, 2), 'utf-8');
    } catch (err) {
      const cachedRaw = await fsp.readFile(fabricJsonPath, 'utf-8').catch(() => null);
      if (!cachedRaw) throw err;
      fabricMeta = JSON.parse(cachedRaw) as VersionMetadata;
    }

    const merged = this.mergeVersionMetadata(vanillaMeta, fabricMeta, effectiveVersionId);
    return {
      effectiveVersionId,
      metadata: merged,
    };
  }

  private async fetchAndCacheVanillaMetadata(gameVersion: string): Promise<VersionMetadata> {
    const jsonPath = this.paths.getVersionJsonPath(gameVersion);
    const versions = await this.getVanillaVersions(false);
    const entry = versions.find((v) => v.id === gameVersion);

    if (entry) {
      await this.downloader.downloadFile({
        url: entry.url,
        destPath: jsonPath,
        displayName: `${gameVersion}.json`,
        expectedHash: entry.sha1,
        hashAlgorithm: 'sha1',
      });
    }

    const raw = await fsp.readFile(jsonPath, 'utf-8');
    return JSON.parse(raw) as VersionMetadata;
  }

  private mergeVersionMetadata(
    parent: VersionMetadata,
    child: VersionMetadata,
    effectiveVersionId: string,
  ): VersionMetadata {
    // Fabric libraries take precedence over Vanilla libraries for matching group:artifact[:classifier]
    const libMap = new Map<string, MojangLibrary>();
    for (const lib of child.libraries ?? []) {
      libMap.set(this.getLibraryArtifactKey(lib.name), lib);
    }
    for (const lib of parent.libraries ?? []) {
      const key = this.getLibraryArtifactKey(lib.name);
      if (!libMap.has(key)) {
        libMap.set(key, lib);
      }
    }

    const mergedGameArgs = [
      ...(parent.arguments?.game ?? []),
      ...(child.arguments?.game ?? []),
    ];
    const mergedJvmArgs = [
      ...(parent.arguments?.jvm ?? []),
      ...(child.arguments?.jvm ?? []),
    ];

    return {
      ...parent,
      ...child,
      id: effectiveVersionId,
      inheritsFrom: parent.id,
      mainClass: child.mainClass || parent.mainClass,
      assets: child.assets || parent.assets,
      assetIndex: child.assetIndex || parent.assetIndex,
      downloads: child.downloads?.client ? child.downloads : parent.downloads,
      javaVersion: child.javaVersion || parent.javaVersion,
      libraries: Array.from(libMap.values()),
      arguments: {
        game: mergedGameArgs,
        jvm: mergedJvmArgs,
      },
      minecraftArguments: child.minecraftArguments || parent.minecraftArguments,
    };
  }

  private getLibraryArtifactKey(coordinate: string): string {
    const [coordWithoutExt] = coordinate.split('@');
    const parts = coordWithoutExt.split(':');
    const group = parts[0] ?? '';
    const artifact = parts[1] ?? '';
    const classifier = parts[3] ?? '';
    return classifier ? `${group}:${artifact}:${classifier}` : `${group}:${artifact}`;
  }

  public getMojangOsName(): 'windows' | 'osx' | 'linux' {
    if (process.platform === 'win32') return 'windows';
    if (process.platform === 'darwin') return 'osx';
    return 'linux';
  }

  /**
   * Evaluates Mojang OS, architecture, and feature rule blocks.
   */
  public isRuleAllowed(
    rules?: MojangRule[],
    featuresContext: Record<string, boolean> = {},
  ): boolean {
    if (!rules || rules.length === 0) {
      return true;
    }

    const currentOs = this.getMojangOsName();
    const isArm64 = process.arch === 'arm64';
    let allowed = false;

    for (const rule of rules) {
      let matches = true;

      if (rule.os) {
        if (rule.os.name && rule.os.name !== currentOs) {
          matches = false;
        }
        if (rule.os.arch) {
          const expectedArch = rule.os.arch.toLowerCase();
          if (expectedArch === 'x86' && process.arch !== 'ia32') {
            matches = false;
          } else if (
            (expectedArch === 'arm64' || expectedArch === 'aarch64') &&
            !isArm64
          ) {
            matches = false;
          } else if (
            (expectedArch === 'x64' || expectedArch === 'x86_64') &&
            process.arch !== 'x64'
          ) {
            matches = false;
          }
        }
      }

      if (rule.features) {
        for (const [featureKey, requiredVal] of Object.entries(rule.features)) {
          if (Boolean(featuresContext[featureKey]) !== Boolean(requiredVal)) {
            matches = false;
            break;
          }
        }
      }

      if (matches) {
        allowed = rule.action === 'allow';
      }
    }

    return allowed;
  }

  /**
   * Resolves Maven relative URL path for Fabric or third-party libraries lacking a downloads.artifact block.
   */
  public getMavenRelativeUrlPath(coordinate: string): string {
    const [coordWithoutExt, explicitExt] = coordinate.split('@');
    const ext = explicitExt || 'jar';
    const parts = coordWithoutExt.split(':');
    const [group, artifact, version, classifier] = parts;
    const groupPath = group.split('.').join('/');
    const fileName = classifier
      ? `${artifact}-${version}-${classifier}.${ext}`
      : `${artifact}-${version}.${ext}`;
    return `${groupPath}/${artifact}/${version}/${fileName}`;
  }
}
