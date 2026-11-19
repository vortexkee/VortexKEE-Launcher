import AdmZip from 'adm-zip';
import { execFile } from 'node:child_process';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as tar from 'tar';
import { DownloadProgressPayload, JavaRuntimeInfo } from '../../shared/types';
import { PathManager } from '../paths';
import { DownloadEngine } from '../utils/downloader';

const execFileAsync = promisify(execFile);

interface AdoptiumAssetResponse {
  binary: {
    architecture: 'x64' | 'aarch64';
    image_type: 'jre' | 'jdk';
    os: 'windows' | 'mac' | 'linux';
    package: {
      checksum: string;
      link: string;
      name: string;
      size: number;
    };
  };
  version: {
    major: number;
    semver: string;
  };
}

export class JavaManager {
  constructor(
    private readonly paths: PathManager,
    private readonly downloader: DownloadEngine,
  ) {}

  /**
   * Determines the required Eclipse Temurin Java LTS major version for a given Minecraft version.
   */
  public getRequiredJavaMajor(mcVersion: string): 8 | 17 | 21 {
    const trimmed = mcVersion.trim();

    // Snapshot format: e.g. 24w14a, 25w02a
    const snapshotMatch = /^(\d{2})w(\d{2})[a-z]?$/i.exec(trimmed);
    if (snapshotMatch) {
      const year = Number.parseInt(snapshotMatch[1], 10);
      const week = Number.parseInt(snapshotMatch[2], 10);
      if (year > 24 || (year === 24 && week >= 14)) return 21;
      if (year >= 21) return 17;
      return 8;
    }

    // Standard release format: 1.<minor>[.<patch>]
    const semverMatch = /^1\.(\d+)(?:\.(\d+))?/.exec(trimmed);
    if (semverMatch) {
      const minor = Number.parseInt(semverMatch[1], 10);
      const patch = semverMatch[2] ? Number.parseInt(semverMatch[2], 10) : 0;

      if (minor >= 21) return 21;
      if (minor === 20) return patch >= 5 ? 21 : 17;
      if (minor >= 17) return 17;
      return 8;
    }

    // Modern versions fallback
    return 21;
  }

  /**
   * Maps Node.js runtime OS and CPU architecture (including Apple Silicon arm64)
   * to Adoptium API v3 identifiers.
   */
  public getAdoptiumPlatform(): {
    os: 'windows' | 'mac' | 'linux';
    arch: 'x64' | 'aarch64';
  } {
    let osName: 'windows' | 'mac' | 'linux' = 'linux';
    if (process.platform === 'win32') {
      osName = 'windows';
    } else if (process.platform === 'darwin') {
      osName = 'mac';
    }

    const archName: 'x64' | 'aarch64' =
      process.arch === 'arm64' ? 'aarch64' : 'x64';

    return { os: osName, arch: archName };
  }

  private getJavaExecutableName(): string {
    return process.platform === 'win32' ? 'java.exe' : 'java';
  }

  /**
   * 3-stage Java discovery:
   * 1. Profile custom Java path override
   * 2. Launcher-managed Adoptium JRE in runtimes/
   * 3. System installations (JAVA_HOME, standard OS paths, PATH)
   */
  public async detectJava(
    requiredMajor: number,
    customPath?: string,
  ): Promise<JavaRuntimeInfo | null> {
    const { os: targetOs, arch: targetArch } = this.getAdoptiumPlatform();

    // Stage 1: Custom profile Java override
    if (customPath && customPath.trim().length > 0) {
      const probed = await this.probeJavaBinary(customPath.trim(), false);
      if (probed && probed.major >= requiredMajor) {
        return probed;
      }
    }

    // Stage 2: Launcher-managed runtime directory
    const managedDir = this.paths.getManagedJavaDir(requiredMajor, targetOs, targetArch);
    const managedBin = await this.findJavaExecutableInDir(managedDir);
    if (managedBin) {
      const probed = await this.probeJavaBinary(managedBin, true);
      if (probed && probed.major === requiredMajor && probed.arch === targetArch) {
        return probed;
      }
    }

    // Stage 3: System Java installations
    const candidateBinaries = await this.collectSystemJavaCandidates();
    for (const candidate of candidateBinaries) {
      const probed = await this.probeJavaBinary(candidate, false);
      if (probed && probed.major === requiredMajor && probed.arch === targetArch) {
        return probed;
      }
    }

    return null;
  }

  /**
   * Ensures a compatible Java runtime exists, downloading and SHA-256 verifying
   * Eclipse Temurin JRE from Adoptium API v3 if missing.
   */
  public async ensureJavaRuntime(
    requiredMajor: number,
    onProgress?: (payload: DownloadProgressPayload) => void,
    customPath?: string,
  ): Promise<JavaRuntimeInfo> {
    const existing = await this.detectJava(requiredMajor, customPath);
    if (existing) {
      return existing;
    }

    return this.installJavaRuntime(requiredMajor, onProgress);
  }

  /**
   * Downloads, verifies SHA-256 checksum, extracts, and configures permissions
   * for the platform-matched Eclipse Temurin JRE.
   */
  public async installJavaRuntime(
    requiredMajor: number,
    onProgress?: (payload: DownloadProgressPayload) => void,
  ): Promise<JavaRuntimeInfo> {
    const { os: targetOs, arch: targetArch } = this.getAdoptiumPlatform();
    const apiUrl = `https://api.adoptium.net/v3/assets/latest/${requiredMajor}/hotspot?architecture=${targetArch}&image_type=jre&os=${targetOs}&vendor=eclipse`;

    const assets = await this.downloader.fetchJson<AdoptiumAssetResponse[]>(apiUrl);
    if (!Array.isArray(assets) || assets.length === 0) {
      throw new Error(
        `No Adoptium Temurin JRE ${requiredMajor} package found for ${targetOs}/${targetArch}`,
      );
    }

    const pkg = assets[0].binary.package;
    const archivePath = path.join(this.paths.getCacheDir(), pkg.name);
    const targetDir = this.paths.getManagedJavaDir(requiredMajor, targetOs, targetArch);

    await this.downloader.downloadBatch(
      [
        {
          url: pkg.link,
          destPath: archivePath,
          displayName: pkg.name,
          expectedHash: pkg.checksum,
          hashAlgorithm: 'sha256',
          size: pkg.size,
        },
      ],
      {
        taskId: `java-${requiredMajor}`,
        phase: 'java',
        concurrency: 1,
        onProgress,
      },
    );

    await fsp.rm(targetDir, { recursive: true, force: true });
    await fsp.mkdir(targetDir, { recursive: true });

    if (pkg.name.endsWith('.zip')) {
      const zip = new AdmZip(archivePath);
      zip.extractAllTo(targetDir, true);
    } else {
      await tar.x({
        file: archivePath,
        cwd: targetDir,
      });
    }

    const javaBin = await this.findJavaExecutableInDir(targetDir);
    if (!javaBin) {
      throw new Error(
        `Extracted Java ${requiredMajor} runtime into ${targetDir}, but could not locate ${this.getJavaExecutableName()}`,
      );
    }

    if (process.platform !== 'win32') {
      await fsp.chmod(javaBin, 0o755);
      // Ensure jspawnhelper / sibling binaries in bin/ or lib/ also keep executable bit if needed
      const binDir = path.dirname(javaBin);
      const binEntries = await fsp.readdir(binDir).catch(() => []);
      await Promise.all(
        binEntries.map((entry) =>
          fsp.chmod(path.join(binDir, entry), 0o755).catch(() => undefined),
        ),
      );
    }

    const probed = await this.probeJavaBinary(javaBin, true);
    if (!probed) {
      throw new Error(`Installed Java binary failed verification at ${javaBin}`);
    }

    return probed;
  }

  private async collectSystemJavaCandidates(): Promise<string[]> {
    const candidates: string[] = [];
    const exe = this.getJavaExecutableName();

    if (process.env.JAVA_HOME) {
      candidates.push(path.join(process.env.JAVA_HOME, 'bin', exe));
    }

    const searchRoots: string[] = [];
    if (process.platform === 'win32') {
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      searchRoots.push(
        path.join(programFiles, 'Eclipse Adoptium'),
        path.join(programFiles, 'Java'),
        path.join(programFiles, 'Microsoft'),
        path.join(programFiles, 'Zulu'),
      );
    } else if (process.platform === 'darwin') {
      searchRoots.push('/Library/Java/JavaVirtualMachines');
    } else {
      searchRoots.push('/usr/lib/jvm');
    }

    for (const root of searchRoots) {
      const subDirs = await fsp.readdir(root).catch(() => [] as string[]);
      for (const sub of subDirs) {
        const subPath = path.join(root, sub);
        const found = await this.findJavaExecutableInDir(subPath);
        if (found) {
          candidates.push(found);
        }
      }
    }

    candidates.push(exe);
    return Array.from(new Set(candidates));
  }

  private async findJavaExecutableInDir(dir: string): Promise<string | null> {
    const exe = this.getJavaExecutableName();
    const directCandidates = [
      path.join(dir, 'bin', exe),
      path.join(dir, 'Contents', 'Home', 'bin', exe),
    ];

    for (const candidate of directCandidates) {
      if (await this.isFile(candidate)) {
        return candidate;
      }
    }

    // Adoptium archives usually wrap contents in a top-level version directory (e.g. jdk-21.0.5+11-jre)
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const nestedDirect = path.join(dir, entry.name, 'bin', exe);
      if (await this.isFile(nestedDirect)) return nestedDirect;

      const nestedMac = path.join(dir, entry.name, 'Contents', 'Home', 'bin', exe);
      if (await this.isFile(nestedMac)) return nestedMac;
    }

    return null;
  }

  private async isFile(targetPath: string): Promise<boolean> {
    try {
      const stat = await fsp.stat(targetPath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private async probeJavaBinary(
    executablePath: string,
    isManaged: boolean,
  ): Promise<JavaRuntimeInfo | null> {
    try {
      const { stdout, stderr } = await execFileAsync(
        executablePath,
        ['-XshowSettings:properties', '-version'],
        { timeout: 6000 },
      );

      const combined = `${stdout}\n${stderr}`;
      const versionMatch =
        /java\.version\s*=\s*([^\r\n]+)/i.exec(combined) ||
        /version\s+"([^"]+)"/i.exec(combined);
      if (!versionMatch) return null;

      const versionString = versionMatch[1].trim();
      const major = this.parseJavaMajor(versionString);
      if (!major) return null;

      const archMatch = /os\.arch\s*=\s*([^\r\n]+)/i.exec(combined);
      const rawArch = archMatch ? archMatch[1].trim().toLowerCase() : process.arch;
      const arch: 'x64' | 'aarch64' =
        rawArch.includes('aarch64') || rawArch.includes('arm64') ? 'aarch64' : 'x64';

      const { os: detectedOs } = this.getAdoptiumPlatform();

      return {
        major,
        versionString,
        path: executablePath,
        arch,
        os: detectedOs,
        isManaged,
      };
    } catch {
      return null;
    }
  }

  private parseJavaMajor(versionString: string): number | null {
    if (versionString.startsWith('1.')) {
      const parts = versionString.split('.');
      const legacy = Number.parseInt(parts[1] ?? '', 10);
      return Number.isNaN(legacy) ? null : legacy;
    }
    const majorMatch = /^(\d+)/.exec(versionString);
    if (!majorMatch) return null;
    const parsed = Number.parseInt(majorMatch[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
