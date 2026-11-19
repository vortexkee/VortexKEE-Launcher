import * as crypto from 'node:crypto';
import { AuthAccount } from '../../shared/types';

/**
 * Handles TLauncher-style accountless / offline authentication.
 * Generates deterministic Minecraft UUID v3 values from "OfflinePlayer:<username>".
 */
export class OfflineAuthProvider {
  public validateUsername(rawUsername: string): string {
    const username = rawUsername.trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
      throw new Error(
        'Geçersiz kullanıcı adı. 3-16 karakter uzunluğunda yalnızca harf, rakam ve alt çizgi (_) kullanın.',
      );
    }
    return username;
  }

  public computeOfflineUuid(username: string): string {
    const hash = crypto
      .createHash('md5')
      .update(`OfflinePlayer:${username}`, 'utf-8')
      .digest();
    hash[6] = (hash[6] & 0x0f) | 0x30; // UUID Version 3
    hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 Variant
    const hex = hash.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  public createOfflineAccount(rawUsername: string): AuthAccount {
    const username = this.validateUsername(rawUsername);
    const uuid = this.computeOfflineUuid(username);
    return {
      id: `offline:${username.toLowerCase()}`,
      type: 'offline',
      username,
      uuid,
      accessToken: '0',
    };
  }
}
