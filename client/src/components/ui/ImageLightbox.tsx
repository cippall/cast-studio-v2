/**
 * ImageLightbox — full-screen overlay for viewing images at full resolution.
 *
 * Opens on click, closes on Escape / click-outside / close button.
 * Uses position: fixed overlay (no layout shift).
 * Subtle backdrop blur, not full black — keeps it elegant.
 */
import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  /** Whether the lightbox is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Image src — supports any URL including data: URLs */
  src: string;
  /** Alt text for the image */
  alt?: string;
  /** Additional className for the image element */
  className?: string;
}

export default function ImageLightbox({
  open,
  onClose,
  src,
  alt = '',
  className,
}: ImageLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-none border border-white/20 bg-black/40 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
        aria-label="Close lightbox"
      >
        <X className="size-5" />
      </button>

      {/* Image — max viewport, click stops propagation so it doesn't close */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className={cn('max-h-[90vh] max-w-[90vw] object-contain', className)}
      />
    </div>
  );
}
