import { safeStorage } from 'electron';

const ENC_PREFIX = 'enc:v1:';
const PLAIN_PREFIX = 'plain:v1:';

/**
 * Encrypts and decrypts sensitive authentication tokens using Electron safeStorage
 * (Windows DPAPI, macOS Keychain, Linux Secret Service) when available.
 */
export class TokenCrypto {
  public encryptSecret(value?: string): string | undefined {
    if (!value) return undefined;
    if (value.startsWith(ENC_PREFIX) || value.startsWith(PLAIN_PREFIX)) {
      return value;
    }

    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(value);
        return `${ENC_PREFIX}${encrypted.toString('base64')}`;
      }
    } catch {
      // Fallback below when OS keyring is unavailable
    }

    return `${PLAIN_PREFIX}${Buffer.from(value, 'utf-8').toString('base64')}`;
  }

  public decryptSecret(stored?: string): string | undefined {
    if (!stored) return undefined;

    if (stored.startsWith(ENC_PREFIX)) {
      const payload = stored.slice(ENC_PREFIX.length);
      try {
        if (safeStorage.isEncryptionAvailable()) {
          return safeStorage.decryptString(Buffer.from(payload, 'base64'));
        }
      } catch {
        return undefined;
      }
      return undefined;
    }

    if (stored.startsWith(PLAIN_PREFIX)) {
      const payload = stored.slice(PLAIN_PREFIX.length);
      return Buffer.from(payload, 'base64').toString('utf-8');
    }

    // Legacy unprefixed plaintext compatibility
    return stored;
  }
}
