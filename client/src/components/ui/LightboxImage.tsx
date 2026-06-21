/**
 * LightboxImage — clickable image that opens ImageLightbox on click.
 *
 * Wraps an <img> (or any ReactNode) with click-to-zoom behavior.
 * Manages its own open/close state internally.
 */
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import ImageLightbox from '@/components/ui/ImageLightbox';

interface LightboxImageProps {
  /** Image src — if null, renders children without lightbox */
  src: string | null;
  /** Alt text */
  alt?: string;
  /** The image content (typically an <img> tag) */
  children: ReactNode;
  /** Additional className for the clickable wrapper */
  className?: string;
}

export default function LightboxImage({ src, alt = '', children, className }: LightboxImageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => src && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (src) setOpen(true);
          }
        }}
        className={cn('cursor-zoom-in', className)}
        aria-label={`View ${alt} at full resolution`}
      >
        {children}
      </div>
      {src && <ImageLightbox open={open} onClose={() => setOpen(false)} src={src} alt={alt} />}
    </>
  );
}
