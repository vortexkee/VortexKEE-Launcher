export type DetectedOS = 'windows' | 'macos' | 'linux';
export type DetectedArch = 'arm64' | 'x64';

export interface ClientEnvironment {
  os: DetectedOS;
  arch: DetectedArch;
  osLabel: string;
}

interface NavigatorUADataLike {
  platform?: string;
}

export function detectClientEnvironment(): ClientEnvironment {
  if (typeof navigator === 'undefined') {
    return { os: 'windows', arch: 'x64', osLabel: 'Windows' };
  }

  const ua = navigator.userAgent.toLowerCase();
  const uaDataPlatform = (
    (navigator as Navigator & { userAgentData?: NavigatorUADataLike }).userAgentData?.platform ?? ''
  ).toLowerCase();
  const navPlatform = (navigator.platform || '').toLowerCase();
  const combined = `${uaDataPlatform} ${navPlatform} ${ua}`;

  let os: DetectedOS = 'windows';
  let osLabel = 'Windows';

  if (combined.includes('mac') || combined.includes('darwin')) {
    os = 'macos';
    osLabel = 'macOS';
  } else if (combined.includes('linux') || combined.includes('x11') || combined.includes('ubuntu')) {
    os = 'linux';
    osLabel = 'Linux';
  } else {
    os = 'windows';
    osLabel = 'Windows';
  }

  const isArm =
    combined.includes('arm64') ||
    combined.includes('aarch64') ||
    (os === 'macos' && !combined.includes('intel'));

  return {
    os,
    arch: isArm ? 'arm64' : 'x64',
    osLabel,
  };
}
