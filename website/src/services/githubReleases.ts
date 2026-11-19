import {
  buildFallbackReleaseInfo,
  DownloadAssetLink,
  GITHUB_LATEST_RELEASE_API,
  GITHUB_LATEST_RELEASE_PAGE,
  ResolvedReleaseInfo,
} from '../config/releaseConfig';

interface GitHubReleaseAssetApi {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubReleaseApiResponse {
  tag_name?: string;
  published_at?: string;
  html_url?: string;
  assets?: GitHubReleaseAssetApi[];
}

const CACHE_KEY = 'vortex-github-release-cache-v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

function matchAsset(
  assets: GitHubReleaseAssetApi[],
  ext: string,
  archTokens: string[],
  excludeTokens: string[] = [],
): GitHubReleaseAssetApi | undefined {
  const lowerExt = ext.toLowerCase();
  const byExt = assets.filter(
    (a) =>
      a.name.toLowerCase().endsWith(lowerExt) &&
      !a.name.toLowerCase().endsWith('.blockmap'),
  );
  if (byExt.length === 0) return undefined;

  const exactArch = byExt.find((asset) => {
    const lower = asset.name.toLowerCase();
    const matchesArch = archTokens.some((tok) => lower.includes(tok));
    const excluded = excludeTokens.some((tok) => lower.includes(tok));
    return matchesArch && !excluded;
  });
  if (exactArch) return exactArch;

  return byExt.find((asset) => {
    const lower = asset.name.toLowerCase();
    return !excludeTokens.some((tok) => lower.includes(tok));
  });
}

function toDownloadLink(
  asset: GitHubReleaseAssetApi | undefined,
  fallback: DownloadAssetLink,
): DownloadAssetLink {
  if (!asset) return fallback;
  return {
    ...fallback,
    fileName: asset.name,
    url: asset.browser_download_url,
    sizeBytes: asset.size,
  };
}

export function formatFileSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export async function fetchLatestReleaseInfo(): Promise<ResolvedReleaseInfo> {
  const fallback = buildFallbackReleaseInfo();

  // Check session cache first to stay well within GitHub API unauthenticated limits
  try {
    const cachedRaw = window.sessionStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as {
        cachedAt: number;
        data: ResolvedReleaseInfo;
      };
      if (Date.now() - parsed.cachedAt < CACHE_TTL_MS && parsed.data?.version) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore storage errors
  }

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);

    const response = await fetch(GITHUB_LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);

    if (!response.ok) {
      return fallback;
    }

    const release = (await response.json()) as GitHubReleaseApiResponse;
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const version = release.tag_name?.trim() || fallback.version;

    const winX64 = matchAsset(assets, '.exe', ['x64', 'x86_64', 'win64'], ['arm64']);
    const winArm64 = matchAsset(assets, '.exe', ['arm64', 'aarch64'], ['x64']);

    const macArm64 = matchAsset(assets, '.dmg', ['arm64', 'aarch64', 'universal'], ['x64']);
    const macX64 = matchAsset(assets, '.dmg', ['x64', 'x86_64', 'intel', 'universal'], ['arm64']);

    const linuxAppImageX64 = matchAsset(assets, '.appimage', ['x64', 'x86_64', 'amd64'], ['arm64', 'aarch64']);
    const linuxDebX64 = matchAsset(assets, '.deb', ['x64', 'amd64', 'x86_64'], ['arm64', 'aarch64']);
    const linuxAppImageArm64 = matchAsset(assets, '.appimage', ['arm64', 'aarch64'], ['x64', 'x86_64']);
    const linuxDebArm64 = matchAsset(assets, '.deb', ['arm64', 'aarch64'], ['x64', 'amd64']);

    const resolved: ResolvedReleaseInfo = {
      version,
      publishedAt: release.published_at,
      releasePageUrl: release.html_url || GITHUB_LATEST_RELEASE_PAGE,
      isFallback: assets.length === 0,
      downloads: {
        windows: {
          primary: toDownloadLink(winX64, fallback.downloads.windows.primary),
          arm64: winArm64
            ? toDownloadLink(winArm64, fallback.downloads.windows.arm64!)
            : fallback.downloads.windows.arm64,
        },
        macos: {
          arm64: toDownloadLink(macArm64, fallback.downloads.macos.arm64),
          x64: toDownloadLink(macX64, fallback.downloads.macos.x64),
        },
        linux: {
          appImage: toDownloadLink(linuxAppImageX64, fallback.downloads.linux.appImage),
          deb: toDownloadLink(linuxDebX64, fallback.downloads.linux.deb),
          appImageArm64: linuxAppImageArm64
            ? {
                label: 'Linux AppImage (ARM64)',
                sublabel: 'ARM64 / Raspberry Pi / Linux ARM',
                extension: '.AppImage',
                arch: 'arm64',
                fileName: linuxAppImageArm64.name,
                url: linuxAppImageArm64.browser_download_url,
                sizeBytes: linuxAppImageArm64.size,
              }
            : undefined,
          debArm64: linuxDebArm64
            ? {
                label: 'Debian / Ubuntu ARM64 (.deb)',
                sublabel: 'APT paket kurulumu (arm64)',
                extension: '.deb',
                arch: 'arm64',
                fileName: linuxDebArm64.name,
                url: linuxDebArm64.browser_download_url,
                sizeBytes: linuxDebArm64.size,
              }
            : undefined,
        },
      },
    };

    try {
      window.sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ cachedAt: Date.now(), data: resolved }),
      );
    } catch {
      // Ignore storage errors
    }

    return resolved;
  } catch {
    return fallback;
  }
}
