import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { AuthAccount, AuthState } from '../../shared/types';
import { PathManager } from '../paths';
import { MicrosoftAuthProvider } from './MicrosoftAuthProvider';
import { OfflineAuthProvider } from './OfflineAuthProvider';
import { TokenCrypto } from './TokenCrypto';

/**
 * Dual-mode account & authentication manager supporting:
 * 1. Accountless / Offline mode (default, TLauncher-style username + UUID v3, accessToken: "0")
 * 2. Optional Microsoft OAuth mode (MSA -> Xbox Live -> XSTS -> Minecraft Services)
 * Multi-account persistence in accounts.json with Electron safeStorage token protection.
 */
export class AuthManager {
  private readonly accountsFilePath: string;
  private readonly offlineProvider = new OfflineAuthProvider();
  private readonly microsoftProvider = new MicrosoftAuthProvider();
  private readonly tokenCrypto = new TokenCrypto();

  private state: AuthState = {
    activeAccountId: null,
    accounts: [],
  };

  constructor(private readonly paths: PathManager) {
    this.accountsFilePath = this.paths.getConfigFilePath('accounts.json');
  }

  public async initialize(): Promise<void> {
    await fsp.mkdir(path.dirname(this.accountsFilePath), { recursive: true });
    try {
      const raw = await fsp.readFile(this.accountsFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as AuthState;
      if (Array.isArray(parsed.accounts)) {
        const decryptedAccounts = parsed.accounts.map((acc) => this.decryptAccount(acc));
        const activeStillExists = decryptedAccounts.some(
          (acc) => acc.id === parsed.activeAccountId,
        );
        this.state = {
          activeAccountId: activeStillExists
            ? parsed.activeAccountId
            : (decryptedAccounts[0]?.id ?? null),
          accounts: decryptedAccounts,
        };
      }
    } catch {
      await this.save();
    }
  }

  private encryptAccount(account: AuthAccount): AuthAccount {
    if (account.type === 'offline') {
      return { ...account, accessToken: '0', refreshToken: undefined };
    }
    return {
      ...account,
      accessToken: this.tokenCrypto.encryptSecret(account.accessToken) ?? '',
      refreshToken: this.tokenCrypto.encryptSecret(account.refreshToken),
    };
  }

  private decryptAccount(account: AuthAccount): AuthAccount {
    if (account.type === 'offline') {
      return { ...account, accessToken: '0', refreshToken: undefined };
    }
    return {
      ...account,
      accessToken: this.tokenCrypto.decryptSecret(account.accessToken) ?? '',
      refreshToken: this.tokenCrypto.decryptSecret(account.refreshToken),
    };
  }

  private sanitizeForRenderer(account: AuthAccount): AuthAccount {
    if (account.type === 'offline') {
      return { ...account };
    }
    return {
      ...account,
      accessToken: account.accessToken ? '***' : '',
      refreshToken: undefined,
    };
  }

  private async save(): Promise<void> {
    await fsp.mkdir(path.dirname(this.accountsFilePath), { recursive: true });
    const persistedState: AuthState = {
      activeAccountId: this.state.activeAccountId,
      accounts: this.state.accounts.map((acc) => this.encryptAccount(acc)),
    };
    const tempPath = `${this.accountsFilePath}.tmp`;
    await fsp.writeFile(tempPath, JSON.stringify(persistedState, null, 2), 'utf-8');
    await fsp.rename(tempPath, this.accountsFilePath);
  }

  public getAuthState(): AuthState {
    return {
      activeAccountId: this.state.activeAccountId,
      accounts: this.state.accounts.map((acc) => this.sanitizeForRenderer(acc)),
    };
  }

  public getActiveAccount(): AuthAccount | null {
    if (!this.state.activeAccountId) {
      return this.state.accounts[0] ?? null;
    }
    return (
      this.state.accounts.find((acc) => acc.id === this.state.activeAccountId) ??
      this.state.accounts[0] ??
      null
    );
  }

  public computeOfflineUuid(username: string): string {
    return this.offlineProvider.computeOfflineUuid(username);
  }

  public getMicrosoftAuthUrl(): string | null {
    return this.microsoftProvider.getAuthorizeUrl();
  }

  public async loginOffline(rawUsername: string): Promise<AuthState> {
    const account = this.offlineProvider.createOfflineAccount(rawUsername);
    await this.upsertAndActivateAccount(account);
    return this.getAuthState();
  }

  public async loginMicrosoft(msAccessTokenOrCode: string): Promise<AuthState> {
    const account = await this.microsoftProvider.authenticate(msAccessTokenOrCode);
    await this.upsertAndActivateAccount(account);
    return this.getAuthState();
  }

  public async refreshMicrosoftAccount(accountId: string): Promise<AuthState> {
    const existing = this.state.accounts.find((acc) => acc.id === accountId);
    if (!existing) {
      throw new Error(`Hesap bulunamadı: ${accountId}`);
    }
    const refreshed = await this.microsoftProvider.refreshAccount(existing);
    await this.upsertAndActivateAccount(refreshed);
    return this.getAuthState();
  }

  public async setActiveAccount(accountId: string): Promise<AuthState> {
    const exists = this.state.accounts.some((acc) => acc.id === accountId);
    if (!exists) {
      throw new Error(`Hesap bulunamadı: ${accountId}`);
    }
    this.state.activeAccountId = accountId;
    await this.save();
    return this.getAuthState();
  }

  public async removeAccount(accountId: string): Promise<AuthState> {
    this.state.accounts = this.state.accounts.filter((acc) => acc.id !== accountId);
    if (this.state.activeAccountId === accountId) {
      this.state.activeAccountId = this.state.accounts[0]?.id ?? null;
    }
    await this.save();
    return this.getAuthState();
  }

  /**
   * Resolves the account used to launch Minecraft:
   * - If an offline username is provided (TLauncher-style quick launch), creates/activates
   *   that offline account immediately without requiring pre-registration.
   * - Otherwise uses the active account, automatically refreshing expiring Microsoft tokens
   *   when a refresh token and AZURE_CLIENT_ID are available.
   */
  public async resolveLaunchAccount(offlineUsername?: string): Promise<AuthAccount> {
    const trimmedOffline = offlineUsername?.trim();
    if (trimmedOffline) {
      const offlineAccount = this.offlineProvider.createOfflineAccount(trimmedOffline);
      await this.upsertAndActivateAccount(offlineAccount);
      return offlineAccount;
    }

    const active = this.getActiveAccount();
    if (!active) {
      throw new Error(
        'Oyunu başlatmak için bir kullanıcı adı (Çevrimdışı Mod) girin veya isteğe bağlı olarak Microsoft hesabıyla giriş yapın.',
      );
    }

    if (
      active.type === 'microsoft' &&
      this.microsoftProvider.isTokenExpiringSoon(active)
    ) {
      if (active.refreshToken && process.env.AZURE_CLIENT_ID?.trim()) {
        const refreshed = await this.microsoftProvider.refreshAccount(active);
        await this.upsertAndActivateAccount(refreshed);
        return refreshed;
      }

      const expiresAtMs = active.expiresAt ? Date.parse(active.expiresAt) : NaN;
      if (Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs) {
        throw new Error(
          `Microsoft oturumunun süresi dolmuş (${active.username}). Lütfen tekrar giriş yapın veya Çevrimdışı Mod'a geçin.`,
        );
      }
    }

    return active;
  }

  private async upsertAndActivateAccount(account: AuthAccount): Promise<void> {
    const existingIndex = this.state.accounts.findIndex((acc) => acc.id === account.id);
    if (existingIndex >= 0) {
      this.state.accounts[existingIndex] = account;
    } else {
      this.state.accounts.push(account);
    }
    this.state.activeAccountId = account.id;
    await this.save();
  }
}
