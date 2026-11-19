import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';

export type HashAlgorithm = 'sha1' | 'sha256' | 'sha512';

/**
 * Computes a streaming cryptographic digest for a file without buffering it entirely in memory.
 */
export function computeFileHash(filePath: string, algorithm: HashAlgorithm): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });
    stream.on('end', () => {
      resolve(hash.digest('hex').toLowerCase());
    });
    stream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Checks whether a file exists and matches the expected SHA-1 or SHA-256 digest.
 */
export async function verifyFileHash(
  filePath: string,
  expectedHash: string,
  algorithm: HashAlgorithm,
): Promise<boolean> {
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) {
      return false;
    }
    const actual = await computeFileHash(filePath, algorithm);
    return actual === expectedHash.trim().toLowerCase();
  } catch {
    return false;
  }
}
