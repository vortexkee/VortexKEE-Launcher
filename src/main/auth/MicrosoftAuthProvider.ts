import { AuthAccount } from '../../shared/types';

interface XboxAuthResponse {
  Token: string;
  XErr?: number;
  DisplayClaims?: {
    xui?: Array<{ uhs?: string }>;
  };
}

interface MinecraftAuthResponse {
  access_token: string;
  expires_in: number;
}

interface MinecraftProfileResponse {
  id: string;
  name: string;
  skins?: Array<{ url: string; state?: string }>;
}

interface MicrosoftTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

const DESKTOP_REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';

/**
 * Modular Microsoft OAuth provider implementing:
 * Microsoft OAuth (Code/Refresh) -> Xbox Live -> XSTS -> Minecraft Services -> Profile.
 */
export class MicrosoftAuthProvider {
  public getAuthorizeUrl(clientId = process.env.AZURE_CLIENT_ID): string | null {
    const trimmed = clientId?.trim();
    if (!trimmed) return null;

    const params = new URLSearchParams({
      client_id: trimmed,
      response_type: 'code',
      redirect_uri: DESKTOP_REDIRECT_URI,
      scope: 'XboxLive.signin offline_access',
      prompt: 'select_account',
    });

    return `https://login.live.com/oauth20_authorize.srf?${params.toString()}`;
  }

  public isTokenExpiringSoon(account: AuthAccount, bufferMs = 5 * 60 * 1000): boolean {
    if (account.type !== 'microsoft' || !account.expiresAt) {
      return false;
    }
    const expiresAtMs = Date.parse(account.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      return false;
    }
    return Date.now() + bufferMs >= expiresAtMs;
  }

  public async authenticate(msAccessTokenOrCode: string): Promise<AuthAccount> {
    const tokenInput = msAccessTokenOrCode.trim();
    if (!tokenInput) {
      throw new Error(
        'Microsoft oturumu için geçerli bir OAuth erişim anahtarı (MSA Access Token) veya yetkilendirme kodu girin.',
      );
    }

    let msAccessToken = tokenInput;
    let msRefreshToken: string | undefined;

    const azureClientId = process.env.AZURE_CLIENT_ID?.trim();
    if (azureClientId && !tokenInput.startsWith('Ew')) {
      const exchanged = await this.exchangeMicrosoftAuthCode(tokenInput, azureClientId);
      msAccessToken = exchanged.accessToken;
      msRefreshToken = exchanged.refreshToken;
    }

    return this.exchangeMicrosoftTokensForMinecraft(msAccessToken, msRefreshToken);
  }

  public async refreshAccount(account: AuthAccount): Promise<AuthAccount> {
    if (account.type !== 'microsoft') {
      throw new Error('Yalnızca Microsoft hesapları yenilenebilir.');
    }
    if (!account.refreshToken) {
      throw new Error(
        'Bu Microsoft hesabı için yenileme belirteci (refresh token) bulunamadı. Lütfen yeniden giriş yapın.',
      );
    }

    const azureClientId = process.env.AZURE_CLIENT_ID?.trim();
    if (!azureClientId) {
      throw new Error(
        'Microsoft oturum yenileme için AZURE_CLIENT_ID ortam değişkeni tanımlı olmalıdır.',
      );
    }

    const refreshed = await this.refreshMicrosoftToken(account.refreshToken, azureClientId);
    return this.exchangeMicrosoftTokensForMinecraft(
      refreshed.accessToken,
      refreshed.refreshToken ?? account.refreshToken,
    );
  }

  private async exchangeMicrosoftTokensForMinecraft(
    msAccessToken: string,
    msRefreshToken?: string,
  ): Promise<AuthAccount> {
    // 1. Authenticate with Xbox Live
    const xblRes = await this.postJson<XboxAuthResponse>(
      'https://user.auth.xboxlive.com/user/authenticate',
      {
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${msAccessToken}`,
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT',
      },
    );

    const userHash = xblRes.DisplayClaims?.xui?.[0]?.uhs;
    if (!xblRes.Token || !userHash) {
      throw new Error('Xbox Live kimlik doğrulaması başarısız oldu.');
    }

    // 2. Authorize XSTS Token for Minecraft Services
    const xstsRes = await this.postJson<XboxAuthResponse>(
      'https://xsts.auth.xboxlive.com/xsts/authorize',
      {
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [xblRes.Token],
        },
        RelyingParty: 'rp://api.minecraftservices.com/',
        TokenType: 'JWT',
      },
    );

    if (!xstsRes.Token) {
      if (xstsRes.XErr) {
        const mapped = this.mapXstsErrorCode(xstsRes.XErr);
        if (mapped) throw new Error(mapped);
      }
      throw new Error('XSTS yetkilendirme belirteci alınamadı.');
    }

    // 3. Exchange XSTS token for Minecraft Access Token
    const mcAuth = await this.postJson<MinecraftAuthResponse>(
      'https://api.minecraftservices.com/authentication/login_with_xbox',
      {
        identityToken: `XBL3.0 x=${userHash};${xstsRes.Token}`,
      },
    );

    // 4. Fetch Minecraft Profile (UUID + Username + Skin)
    const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      headers: {
        Authorization: `Bearer ${mcAuth.access_token}`,
      },
    });

    if (!profileRes.ok) {
      throw new Error(
        `Minecraft profili alınamadı (HTTP ${profileRes.status}). Hesapta Minecraft lisansı olmayabilir.`,
      );
    }

    const profile = (await profileRes.json()) as MinecraftProfileResponse;
    const formattedUuid = this.formatDashedUuid(profile.id);
    const activeSkin = profile.skins?.find((s) => s.state === 'ACTIVE')?.url;

    return {
      id: `microsoft:${formattedUuid}`,
      type: 'microsoft',
      username: profile.name,
      uuid: formattedUuid,
      accessToken: mcAuth.access_token,
      refreshToken: msRefreshToken,
      expiresAt: new Date(Date.now() + mcAuth.expires_in * 1000).toISOString(),
      skinUrl: activeSkin,
    };
  }

  private async exchangeMicrosoftAuthCode(
    code: string,
    clientId: string,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    const body = new URLSearchParams({
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: DESKTOP_REDIRECT_URI,
      scope: 'XboxLive.signin offline_access',
    });

    const response = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Microsoft OAuth kod değişimi başarısız (HTTP ${response.status}).`);
    }

    const data = (await response.json()) as MicrosoftTokenResponse;
    if (!data.access_token) {
      throw new Error('Microsoft OAuth yanıtında access_token bulunamadı.');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  private async refreshMicrosoftToken(
    refreshToken: string,
    clientId: string,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    const body = new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      redirect_uri: DESKTOP_REDIRECT_URI,
      scope: 'XboxLive.signin offline_access',
    });

    const response = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Microsoft oturum yenileme başarısız (HTTP ${response.status}). Lütfen tekrar giriş yapın.`,
      );
    }

    const data = (await response.json()) as MicrosoftTokenResponse;
    if (!data.access_token) {
      throw new Error('Microsoft token yenileme yanıtında access_token bulunamadı.');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  private async postJson<T>(url: string, payload: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const mappedXbox = this.tryParseXstsError(errorText);
      if (mappedXbox) {
        throw new Error(mappedXbox);
      }
      throw new Error(`Auth API hatası (${response.status}): ${errorText || url}`);
    }

    return (await response.json()) as T;
  }

  private tryParseXstsError(rawBody: string): string | null {
    if (!rawBody) return null;
    try {
      const parsed = JSON.parse(rawBody) as { XErr?: number };
      if (typeof parsed.XErr === 'number') {
        return this.mapXstsErrorCode(parsed.XErr);
      }
    } catch {
      // Ignore non-JSON error body
    }
    return null;
  }

  private mapXstsErrorCode(xerr: number): string | null {
    switch (xerr) {
      case 2148916233:
        return 'Bu Microsoft hesabında Xbox profili bulunamadı. Lütfen önce xbox.com üzerinden bir Xbox profili oluşturun.';
      case 2148916235:
        return 'Xbox Live hizmeti bu ülke veya bölgede kullanılamıyor.';
      case 2148916236:
      case 2148916237:
        return 'Hesapta yetişkin doğrulaması gerekiyor. Xbox güvenlik ayarlarınızdan onaylayın.';
      case 2148916238:
        return 'Bu hesap çocuk hesabı olarak işaretlenmiş. Devam etmek için bir Microsoft Aile grubuna eklenmeniz gerekir.';
      default:
        return null;
    }
  }

  private formatDashedUuid(raw: string): string {
    const clean = raw.replace(/-/g, '');
    if (clean.length !== 32) return raw;
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`;
  }
}
