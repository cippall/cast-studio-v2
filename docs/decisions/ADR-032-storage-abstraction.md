# ADR-019: Storage Abstraction for Image Uploads

## Status

Accepted

## Date

2026-06-17

## Context

Cast Studio needs to store reference images uploaded by users (Artists and Clients) for use as input to generation pipelines. These images include:

1. **Reference photos** uploaded during Actor/Look/Fashion Item creation
2. **Input images** for image-to-image generation mode
3. **Future**: Generated output backups downloaded from fal.ai

The system requires:

1. **Pluggable backends** — Local disk now (MVP), AWS S3 later (production). The rest of the application should not care about where files are stored.
2. **Consistent file naming** — All uploads follow the `ref_{asset_id}_{version}_{short_uuid}.png` convention for traceability.
3. **Size and type limits** — Max 10MB per file, only PNG/JPG/WEBP accepted.
4. **Static serving** — Uploaded files must be accessible to the frontend via HTTP URLs.
5. **Signed URLs** — Future support for time-limited access to private workspace images.
6. **Workspace isolation** — Uploads are tied to workspace context (via auth middleware).

## Decision

### StorageProvider Interface

A `StorageProvider` interface in `server/src/services/storage/types.ts` defines three core methods:

| Method                                 | Purpose                                  | Returns         |
| -------------------------------------- | ---------------------------------------- | --------------- |
| `save(key, data)`                      | Persist a file buffer to storage         | The storage key |
| `getUrl(key)`                          | Get a public URL for a stored file       | URL string      |
| `getSignedUrl(key, expiresInSeconds?)` | Get a time-limited URL for private files | URL string      |
| `delete(key)`                          | Remove a file from storage               | Promise (void)  |

### LocalStorageProvider Implementation

`server/src/services/storage/local-storage.ts` implements the interface with:

- **Base path**: Configurable via `UPLOAD_DIR` env var (defaults to `./uploads/ref`)
- **URL prefix**: `/uploads/ref/` — served by Express static middleware
- **save()**: Writes buffer to disk, creating the directory if needed
- **getUrl()**: Returns the static path (e.g., `/uploads/ref/ref_abc_1_xyz.png`)
- **getSignedUrl()**: For local storage, returns the same static URL. Real signed URLs (expiring tokens) should be implemented when S3 is added.
- **delete()**: Removes file, silently ignores missing files

### Upload Route

`POST /api/upload` accepts multipart form data via `multer`:

| Field      | Type   | Required | Description                            |
| ---------- | ------ | -------- | -------------------------------------- |
| `image`    | file   | Yes      | The image file (PNG/JPG/WEBP)          |
| `asset_id` | string | No       | Asset ID for filename generation       |
| `version`  | number | No       | Version number for filename generation |

**Validation:**

- File type limited to `image/png`, `image/jpeg`, `image/webp`
- File size limited to 10MB (enforced by multer)
- Missing file returns 422

**File naming:** `ref_{asset_id}_{version}_{short_uuid}.{ext}`

- `short_uuid`: First 8 characters of a random UUID (no hyphens)
- Asset ID and version are optional — omitted from name when not provided
- Extension extracted from original filename, falls back to `png`

**File serving:** Express serves `/uploads` as a static directory, so uploaded files are immediately accessible at `GET /uploads/ref/{filename}`.

### Auth

The upload endpoint uses the same middleware as all other routes:

- `requireSession` — validates session cookie
- `requireWorkspace` — attaches workspace context

## Alternatives Considered

1. **External cloud storage only (no local fallback)** — Rejected because local storage is simpler for MVP and works offline. The interface makes it trivial to add S3 later without changing route code.

2. **Direct-to-multer-disk storage** — Rejected because it ties the route to a specific storage strategy. Using `multer.memoryStorage()` + explicit `storageProvider.save()` lets us swap backends transparently.

3. **Base64 in request body instead of multipart** — Rejected because multipart is more efficient for binary files and standard for image upload APIs. Base64 inflates size by ~33%.

4. **Signed URLs from day one** — Rejected as premature optimization. Local storage doesn't benefit from signed URLs; they add complexity with no security gain for local file serving. The interface includes `getSignedUrl()` so S3 integration can implement real presigned URLs later.

## Consequences

1. **Positive**: Adding S3 (or any other backend) only requires a new class implementing `StorageProvider` — swap in the route constructor, no other code changes.
2. **Positive**: 19 new tests cover the storage interface, local implementation, and upload route — all passing at time of writing.
3. **Positive**: File naming convention makes it easy to trace uploads back to their source asset and version.
4. **Neutral**: Files are served directly via Express static middleware — no access control on individual files. Workspace isolation is handled at the route/API level (who can upload), not at the file access level. S3 integration should add bucket-level access control.
5. **Negative**: Large files (near 10MB) are stored in memory before being written to disk when using multer's memory storage. For MVP with expected small reference images (<1MB typical), this is acceptable. If large uploads become common, switch to multer's disk storage.
