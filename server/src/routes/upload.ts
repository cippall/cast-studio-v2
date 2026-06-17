import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import { LocalStorageProvider } from '../services/storage/local-storage.js';
import type { Request, Response } from 'express';

const router = Router();

// --- Multer config ---

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('UNSUPPORTED_FILE_TYPE'));
    }
  },
});

// --- Storage provider (lazy init to respect process.env.UPLOAD_DIR at runtime) ---

let _storageProvider: LocalStorageProvider | null = null;

function getStorageProvider(): LocalStorageProvider {
  if (!_storageProvider) {
    _storageProvider = new LocalStorageProvider();
  }
  return _storageProvider;
}

// --- Helpers ---

function generateShortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

function generateFileName(assetId?: string, version?: number, ext?: string): string {
  const extension = ext || 'png';
  const shortId = generateShortId();

  const parts: string[] = ['ref'];

  if (assetId) {
    parts.push(assetId);
  }
  if (version !== undefined && version !== null) {
    parts.push(String(version));
  }

  parts.push(shortId);

  return `${parts.join('_')}.${extension}`;
}

// --- POST /api/upload ---

router.post('/', requireSession, requireWorkspace, (req: Request, res: Response) => {
  upload.single('image')(req, res, async (err) => {
    try {
      // Handle multer errors
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(422).json({
              error: {
                code: 'FILE_TOO_LARGE',
                message: 'File exceeds maximum size of 10MB',
              },
            });
            return;
          }
          res.status(422).json({
            error: {
              code: 'UPLOAD_ERROR',
              message: err.message,
            },
          });
          return;
        }

        if (err.message === 'UNSUPPORTED_FILE_TYPE') {
          res.status(422).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Unsupported file type. Allowed: png, jpg, webp',
            },
          });
          return;
        }

        res.status(422).json({
          error: {
            code: 'UPLOAD_ERROR',
            message: 'File upload failed',
          },
        });
        return;
      }

      // Validate file exists
      if (!req.file) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No image file provided. Send a file in the "image" field.',
          },
        });
        return;
      }

      // Parse optional fields
      const assetId = req.body?.asset_id as string | undefined;
      const versionStr = req.body?.version as string | undefined;
      const version = versionStr ? parseInt(versionStr, 10) : undefined;

      // Extract extension from original filename
      const originalName = req.file.originalname || 'image.png';
      const ext = originalName.split('.').pop()?.toLowerCase() || 'png';

      // Generate filename
      const key = generateFileName(assetId, isNaN(version as number) ? undefined : version, ext);

      // Save to storage
      await getStorageProvider().save(key, req.file.buffer);

      // Return the URL
      const url = getStorageProvider().getUrl(key);

      res.json({ url, key });
    } catch (saveErr) {
      console.error('Upload error:', saveErr);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to save uploaded file' },
      });
    }
  });
});

export default router;
