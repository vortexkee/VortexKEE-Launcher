import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import {
  DownloadFileStatus,
  DownloadPhase,
  DownloadProgressPayload,
} from '../../shared/types';
import { HashAlgorithm, verifyFileHash } from './hash';

export interface DownloadTask {
  url: string;
  destPath: string;
  displayName?: string;
  expectedHash?: string;
  hashAlgorithm?: HashAlgorithm;
  size?: number;
  force?: boolean;
}

export interface DownloadBatchOptions {
  taskId: string;
  phase: DownloadPhase;
  concurrency?: number;
  retries?: number;
  onProgress?: (payload: DownloadProgressPayload) => void;
}

const USER_AGENT = 'VortexLauncher/1.0.0';
const MAX_REDIRECTS = 6;
const DEFAULT_TIMEOUT_MS = 30_000;

function requestWithRedirects(
  targetUrl: string,
  redirectsRemaining = MAX_REDIRECTS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const transport = parsedUrl.protocol === 'http:' ? http : https;

    const req = transport.get(
      parsedUrl,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: '*/*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        const statusCode = res.statusCode ?? 0;

        if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
          res.resume();
          if (redirectsRemaining <= 0) {
            reject(new Error(`Too many HTTP redirects while requesting ${targetUrl}`));
            return;
          }
          const nextUrl = new URL(res.headers.location, parsedUrl).toString();
          requestWithRedirects(nextUrl, redirectsRemaining - 1, timeoutMs)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${statusCode} while fetching ${targetUrl}`));
          return;
        }

        resolve(res);
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms: ${targetUrl}`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

export class DownloadEngine {
  /**
   * Fetches and parses a remote JSON endpoint.
   */
  public async fetchJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const response = await requestWithRedirects(url, MAX_REDIRECTS, timeoutMs);
    const chunks: Buffer[] = [];

    for await (const chunk of response) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const body = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(body) as T;
  }

  /**
   * Downloads a single file atomically via a .part temporary file and validates its hash if provided.
   */
  public async downloadFile(
    task: DownloadTask,
    options?: {
      retries?: number;
      onChunk?: (bytesReceived: number, contentLength: number) => void;
      onStatus?: (status: DownloadFileStatus) => void;
      onAttemptReset?: (discardedBytes: number) => void;
    },
  ): Promise<void> {
    const algo: HashAlgorithm = task.hashAlgorithm ?? 'sha1';
    const retries = options?.retries ?? 3;

    if (!task.force) {
      if (task.expectedHash) {
        options?.onStatus?.('verifying');
        const isValid = await verifyFileHash(task.destPath, task.expectedHash, algo);
        if (isValid) {
          const stat = await fsp.stat(task.destPath);
          options?.onStatus?.('cached');
          options?.onChunk?.(stat.size, stat.size);
          return;
        }
      } else {
        try {
          const stat = await fsp.stat(task.destPath);
          if (stat.isFile() && stat.size > 0) {
            options?.onStatus?.('cached');
            options?.onChunk?.(stat.size, stat.size);
            return;
          }
        } catch {
          // File missing; proceed with download
        }
      }
    }

    await fsp.mkdir(path.dirname(task.destPath), { recursive: true });
    const tempPartPath = `${task.destPath}.part`;

    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      let attemptBytes = 0;
      try {
        options?.onStatus?.('downloading');
        await this.streamDownloadToTemp(
          task.url,
          tempPartPath,
          (deltaBytes, contentLength) => {
            attemptBytes += deltaBytes;
            options?.onChunk?.(deltaBytes, contentLength);
          },
        );

        if (task.expectedHash) {
          options?.onStatus?.('verifying');
          const valid = await verifyFileHash(tempPartPath, task.expectedHash, algo);
          if (!valid) {
            throw new Error(
              `${algo.toUpperCase()} checksum mismatch for ${path.basename(task.destPath)}`,
            );
          }
        }

        await fsp.rename(tempPartPath, task.destPath);
        options?.onStatus?.('completed');
        return;
      } catch (err) {
        lastError = err;
        if (attemptBytes > 0) {
          options?.onAttemptReset?.(attemptBytes);
        }
        await fsp.rm(tempPartPath, { force: true }).catch(() => undefined);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
    }

    options?.onStatus?.('error');
    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to download ${task.url}`);
  }

  private async streamDownloadToTemp(
    url: string,
    tempPath: string,
    onChunk?: (bytesReceived: number, contentLength: number) => void,
  ): Promise<void> {
    const response = await requestWithRedirects(url);
    const contentLengthHeader = response.headers['content-length'];
    const totalLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) || 0 : 0;

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempPath);
      let settled = false;

      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        response.destroy();
        writeStream.destroy();
        reject(err);
      };

      response.on('data', (chunk: Buffer) => {
        onChunk?.(chunk.length, totalLength);
      });
      response.on('error', fail);
      writeStream.on('error', fail);
      writeStream.on('finish', () => {
        if (settled) return;
        settled = true;
        resolve();
      });

      response.pipe(writeStream);
    });
  }

  /**
   * Executes a batch of downloads with bounded concurrency and throttled progress reporting.
   */
  public async downloadBatch(
    tasks: DownloadTask[],
    options: DownloadBatchOptions,
  ): Promise<void> {
    if (tasks.length === 0) {
      return;
    }

    const concurrency = Math.max(1, options.concurrency ?? 8);
    const totalFiles = tasks.length;
    let knownTotalBytes = tasks.reduce((sum, item) => sum + (item.size ?? 0), 0);
    let downloadedBytes = 0;
    let completedFiles = 0;
    let nextIndex = 0;
    let currentFileName = tasks[0].displayName ?? path.basename(tasks[0].destPath);
    let currentStatus: DownloadFileStatus = 'downloading';

    const startTime = Date.now();
    let lastEmitTime = 0;

    const emitProgress = (force = false) => {
      if (!options.onProgress) return;
      const now = Date.now();
      if (!force && now - lastEmitTime < 80) return;
      lastEmitTime = now;

      const elapsedSec = Math.max(0.05, (now - startTime) / 1000);
      const speedBps = Math.round(downloadedBytes / elapsedSec);

      let percentage = 0;
      if (knownTotalBytes > 0) {
        percentage = Math.min(100, Math.round((downloadedBytes / knownTotalBytes) * 100));
      } else {
        percentage = Math.min(100, Math.round((completedFiles / totalFiles) * 100));
      }

      options.onProgress({
        taskId: options.taskId,
        phase: options.phase,
        status: currentStatus,
        fileName: currentFileName,
        currentFileIndex: Math.min(completedFiles + 1, totalFiles),
        totalFiles,
        downloadedBytes,
        totalBytes: Math.max(knownTotalBytes, downloadedBytes),
        percentage,
        speedBps,
      });
    };

    const worker = async () => {
      while (true) {
        const idx = nextIndex++;
        if (idx >= tasks.length) break;

        const task = tasks[idx];
        currentFileName = task.displayName ?? path.basename(task.destPath);

        let taskContentLengthAdded = Boolean(task.size && task.size > 0);
        let bytesForThisTask = 0;

        await this.downloadFile(task, {
          retries: options.retries ?? 3,
          onStatus: (status) => {
            currentStatus = status;
            emitProgress(status === 'error');
          },
          onAttemptReset: (discardedBytes) => {
            downloadedBytes = Math.max(0, downloadedBytes - discardedBytes);
            bytesForThisTask = Math.max(0, bytesForThisTask - discardedBytes);
          },
          onChunk: (deltaBytes, contentLength) => {
            if (!taskContentLengthAdded && contentLength > 0) {
              knownTotalBytes += contentLength;
              taskContentLengthAdded = true;
            }
            bytesForThisTask += deltaBytes;
            downloadedBytes += deltaBytes;
            emitProgress(false);
          },
        });

        // If the file was already cached and matched hash, ensure task bytes are accounted for
        if (bytesForThisTask === 0 && task.size) {
          downloadedBytes += task.size;
        }

        completedFiles += 1;
        emitProgress(completedFiles === totalFiles);
      }
    };

    emitProgress(true);
    const workers = Array.from({ length: Math.min(concurrency, totalFiles) }, () => worker());
    await Promise.all(workers);
    currentStatus = 'completed';
    emitProgress(true);
  }
}
