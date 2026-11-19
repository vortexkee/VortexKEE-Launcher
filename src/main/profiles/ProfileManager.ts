import * as crypto from 'node:crypto';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CreateProfileInput,
  MinecraftProfile,
  UpdateProfilePatch,
} from '../../shared/types';
import { PathManager } from '../paths';

export class ProfileManager {
  private readonly profilesFilePath: string;
  private profiles: MinecraftProfile[] = [];

  constructor(private readonly paths: PathManager) {
    this.profilesFilePath = this.paths.getConfigFilePath('profiles.json');
  }

  public async initialize(): Promise<void> {
    await fsp.mkdir(path.dirname(this.profilesFilePath), { recursive: true });
    try {
      const raw = await fsp.readFile(this.profilesFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as MinecraftProfile[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.profiles = parsed;
        return;
      }
    } catch {
      // Seed defaults on first run
    }

    const defaultRam = this.getDefaultMemoryGB();
    const now = new Date().toISOString();
    this.profiles = [
      {
        id: 'vanilla-latest',
        name: 'Vanilla 1.21.4',
        gameVersion: '1.21.4',
        loaderType: 'vanilla',
        memoryGB: defaultRam,
        resolution: { width: 1280, height: 720, fullscreen: false },
        jvmArgs: ['-XX:+UseG1GC'],
        createdAt: now,
      },
      {
        id: 'fabric-latest',
        name: 'Fabric 1.21.4',
        gameVersion: '1.21.4',
        loaderType: 'fabric',
        memoryGB: defaultRam,
        resolution: { width: 1280, height: 720, fullscreen: false },
        jvmArgs: ['-XX:+UseG1GC'],
        createdAt: now,
      },
    ];
    await this.save();
  }

  private getDefaultMemoryGB(): number {
    const totalGB = Math.floor(os.totalmem() / (1024 * 1024 * 1024));
    if (totalGB >= 16) return 4;
    if (totalGB >= 8) return 3;
    return 2;
  }

  private async save(): Promise<void> {
    await fsp.mkdir(path.dirname(this.profilesFilePath), { recursive: true });
    const tempPath = `${this.profilesFilePath}.tmp`;
    await fsp.writeFile(tempPath, JSON.stringify(this.profiles, null, 2), 'utf-8');
    await fsp.rename(tempPath, this.profilesFilePath);
  }

  public listProfiles(): MinecraftProfile[] {
    return [...this.profiles];
  }

  public getProfile(id: string): MinecraftProfile {
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) {
      throw new Error(`Profil bulunamadı: ${id}`);
    }
    return profile;
  }

  public async createProfile(input: CreateProfileInput): Promise<MinecraftProfile> {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Profil adı boş olamaz.');
    }

    const sanitizedSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const id = `${sanitizedSlug || 'profile'}-${crypto.randomBytes(3).toString('hex')}`;

    const profile: MinecraftProfile = {
      id,
      name,
      gameVersion: input.gameVersion.trim(),
      loaderType: input.loaderType,
      loaderVersion: input.loaderVersion?.trim() || undefined,
      memoryGB: this.clampMemoryGB(input.memoryGB),
      resolution: {
        width: this.clampDimension(input.resolution.width, 640, 7680, 1280),
        height: this.clampDimension(input.resolution.height, 480, 4320, 720),
        fullscreen: Boolean(input.resolution.fullscreen),
      },
      jvmArgs: input.jvmArgs ?? ['-XX:+UseG1GC'],
      customJavaPath: input.customJavaPath?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    this.profiles.push(profile);
    await fsp.mkdir(this.paths.getInstanceDir(profile.id), { recursive: true });
    await this.save();
    return profile;
  }

  public async updateProfile(
    id: string,
    patch: UpdateProfilePatch,
  ): Promise<MinecraftProfile> {
    const index = this.profiles.findIndex((p) => p.id === id);
    if (index < 0) {
      throw new Error(`Profil bulunamadı: ${id}`);
    }

    const current = this.profiles[index];
    const nextResolution = patch.resolution
      ? {
          width: this.clampDimension(patch.resolution.width, 640, 7680, current.resolution.width),
          height: this.clampDimension(patch.resolution.height, 480, 4320, current.resolution.height),
          fullscreen: Boolean(patch.resolution.fullscreen),
        }
      : current.resolution;

    const updated: MinecraftProfile = {
      ...current,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() || current.name : current.name,
      memoryGB:
        patch.memoryGB !== undefined ? this.clampMemoryGB(patch.memoryGB) : current.memoryGB,
      resolution: nextResolution,
      customJavaPath:
        patch.customJavaPath !== undefined
          ? patch.customJavaPath.trim() || undefined
          : current.customJavaPath,
    };

    this.profiles[index] = updated;
    await this.save();
    return updated;
  }

  public async deleteProfile(id: string): Promise<void> {
    if (this.profiles.length <= 1) {
      throw new Error('En az bir profil bulunmalıdır.');
    }
    this.profiles = this.profiles.filter((p) => p.id !== id);
    await this.save();
  }

  private clampMemoryGB(value: number): number {
    const totalSystemGB = Math.max(2, Math.floor(os.totalmem() / (1024 * 1024 * 1024)));
    const parsed = Number.isFinite(value) ? value : 2;
    return Math.min(Math.max(1, Math.round(parsed * 2) / 2), totalSystemGB);
  }

  private clampDimension(
    value: number,
    min: number,
    max: number,
    fallback: number,
  ): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
  }
}
