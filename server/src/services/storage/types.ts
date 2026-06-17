/**
 * Storage provider interface.
 *
 * Abstracts file storage behind a common interface so the backend
 * can switch between local disk, AWS S3, or other providers without
 * changing business logic.
 *
 * All implementations receive a **relative key** (e.g. "ref_abc123.png")
 * and return URLs that the frontend can use to access the file.
 */
export interface StorageProvider {
  /**
   * Save a file buffer to storage under the given key.
   * Returns the key on success.
   */
  save(key: string, data: Buffer): Promise<string>;

  /**
   * Get the public URL for a stored file by key.
   * Returns a URL path that can be served to the client.
   */
  getUrl(key: string): string;

  /**
   * Get a signed (time-limited) URL for private files.
   * For local storage this returns the same as getUrl();
   * for S3 it generates a presigned URL with a configurable TTL.
   */
  getSignedUrl(key: string, expiresInSeconds?: number): string;

  /**
   * Delete a file from storage by key.
   * Must not throw if the file does not exist.
   */
  delete(key: string): Promise<void>;
}
