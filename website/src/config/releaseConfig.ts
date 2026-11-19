/**
 * Tek merkezli sürüm ve depo yapılandırması.
 * GitHub deponuzu oluşturduktan sonra yalnızca GITHUB_REPO değerini
 * "kullanici-adi/depo-adi" şeklinde güncellemeniz yeterlidir.
 */
export const SITE_URL = 'https://vlauncher.vercel.app';
export const APP_ID = 'app.vercel.vlauncher';
export const PRODUCT_NAME = 'Vortex Launcher';

export const GITHUB_REPO = 'vortex-studio/vortex-launcher';
export const FALLBACK_VERSION = 'v1.0.0';

export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const GITHUB_LATEST_RELEASE_PAGE = `${GITHUB_RELEASES_URL}/latest`;
export const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface DownloadAssetLink {
  label: string;
  sublabel: string;
  extension: '.exe' | '.dmg' | '.AppImage' | '.deb';
  arch: 'x64' | 'arm64';
  url: string;
  fileName: string;
  sizeBytes?: number;
}

export interface PlatformDownloads {
  windows: {
    primary: DownloadAssetLink;
    arm64?: DownloadAssetLink;
  };
  macos: {
    arm64: DownloadAssetLink;
    x64: DownloadAssetLink;
  };
  linux: {
    appImage: DownloadAssetLink;
    deb: DownloadAssetLink;
    appImageArm64?: DownloadAssetLink;
    debArm64?: DownloadAssetLink;
  };
}

export interface ResolvedReleaseInfo {
  version: string;
  publishedAt?: string;
  releasePageUrl: string;
  isFallback: boolean;
  downloads: PlatformDownloads;
}

/**
 * GitHub API rate-limit, ağ hatası veya henüz yayınlanmamış sürüm durumunda
 * kullanılan yedek indirme bağlantıları.
 */
export function buildFallbackReleaseInfo(): ResolvedReleaseInfo {
  const numericVer = FALLBACK_VERSION.replace(/^v/i, '');
  const baseDownload = `${GITHUB_RELEASES_URL}/download/${FALLBACK_VERSION}`;

  return {
    version: FALLBACK_VERSION,
    releasePageUrl: GITHUB_LATEST_RELEASE_PAGE,
    isFallback: true,
    downloads: {
      windows: {
        primary: {
          label: 'Windows Yükleyici (x64)',
          sublabel: 'NSIS Kurulum Sihirbazı · Windows 10/11',
          extension: '.exe',
          arch: 'x64',
          fileName: `Vortex-Launcher-Setup-${numericVer}-x64.exe`,
          url: `${baseDownload}/Vortex.Launcher-Setup-${numericVer}-x64.exe`,
        },
        arm64: {
          label: 'Windows ARM64',
          sublabel: 'NSIS Kurulum · Snapdragon / ARM',
          extension: '.exe',
          arch: 'arm64',
          fileName: `Vortex-Launcher-Setup-${numericVer}-arm64.exe`,
          url: `${baseDownload}/Vortex.Launcher-Setup-${numericVer}-arm64.exe`,
        },
      },
      macos: {
        arm64: {
          label: 'macOS Apple Silicon',
          sublabel: 'M1 / M2 / M3 / M4 (arm64)',
          extension: '.dmg',
          arch: 'arm64',
          fileName: `Vortex-Launcher-${numericVer}-arm64.dmg`,
          url: `${baseDownload}/Vortex.Launcher-${numericVer}-arm64.dmg`,
        },
        x64: {
          label: 'macOS Intel',
          sublabel: 'Intel İşlemcili Mac (x64)',
          extension: '.dmg',
          arch: 'x64',
          fileName: `Vortex-Launcher-${numericVer}-x64.dmg`,
          url: `${baseDownload}/Vortex.Launcher-${numericVer}-x64.dmg`,
        },
      },
      linux: {
        appImage: {
          label: 'Linux AppImage (x64)',
          sublabel: 'Kurulum gerektirmez · Tüm dağıtımlar',
          extension: '.AppImage',
          arch: 'x64',
          fileName: `Vortex-Launcher-${numericVer}-x64.AppImage`,
          url: `${baseDownload}/Vortex.Launcher-${numericVer}-x64.AppImage`,
        },
        deb: {
          label: 'Debian / Ubuntu (.deb)',
          sublabel: 'APT paket kurulumu (x64)',
          extension: '.deb',
          arch: 'x64',
          fileName: `Vortex-Launcher-${numericVer}-x64.deb`,
          url: `${baseDownload}/Vortex.Launcher-${numericVer}-x64.deb`,
        },
      },
    },
  };
}
