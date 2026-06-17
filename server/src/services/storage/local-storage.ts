import fs from 'node:fs';
import path from 'node:path';
import type { StorageProvider } from './types.js';

/**
 * Local disk implementation of StorageProvider.
 *
 * Files are stored under `basePath` and served via a static file mount
 * at `/uploads/ref/`. The base path defaults to `./uploads/ref` but can
 * be overridden via the `UPLOAD_DIR` environment variable or constructor.
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string;
  private readonly urlPrefix: string;

  constructor(basePath?: string, urlPrefix?: string) {
    this.basePath = basePath ?? process.env.UPLOAD_DIR ?? path.resolve('uploads/ref');
    this.urlPrefix = urlPrefix ?? '/uploads/ref';
  }

  /**
   * Save a buffer to disk under the given key.
   * Creates the base directory if it does not exist.
   */
  async save(key: string, data: Buffer): Promise<string> {
    // Ensure the upload directory exists
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }

    const filePath = path.join(this.basePath, key);
    await fs.promises.writeFile(filePath, data);

    return key;
  }

  /**
   * Get the public URL for a stored file.
   */
  getUrl(key: string): string {
    return `${this.urlPrefix}/${key}`;
  }

  /**
   * Get a signed URL. For local storage this returns the same static URL.
   * In production (S3), this would generate a presigned URL with expiration.
   */
  getSignedUrl(key: string, _expiresInSeconds?: number): string {
    return this.getUrl(key);
  }

  /**
   * Delete a file by key. Silently ignores non-existent files.
   */
  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);

    try {
      await fs.promises.unlink(filePath);
    } catch (err: unknown) {
      // Silently ignore if file does not exist
      if (
        err instanceof Error &&
        'code' in err &&
        (err as NodeJS.ErrnoException).code !== 'ENOENT'
      ) {
        throw err;
      }
    }
  }
}
