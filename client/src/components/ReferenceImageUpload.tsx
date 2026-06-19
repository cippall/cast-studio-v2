/**
 * ReferenceImageUpload — dynamic reference image slot manager.
 *
 * Displays a centered row of small image slots. Each "+" slot triggers a
 * file-input upload. On upload, the slot shows the image and a new "+"
 * appears if max slots allow. Each image has an X to remove.
 *
 * Props:
 *   images — data-URL strings of uploaded images
 *   onChange — callback with updated array
 *   maxSlots — maximum number of reference images (admin-configured, default 4)
 */
import { useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReferenceImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxSlots?: number;
}

export default function ReferenceImageUpload({
  images,
  onChange,
  maxSlots = 4,
}: ReferenceImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result && images.length < maxSlots) {
        onChange([...images, result]);
      }
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const canAdd = images.length < maxSlots;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {images.map((src, index) => (
        <div key={index} className="relative size-20 border border-border-subtle">
          <img src={src} alt={`Reference ${index + 1}`} className="size-full object-cover" />
          <button
            type="button"
            onClick={() => handleRemove(index)}
            className={cn(
              'absolute -top-2 -right-2 flex size-5 items-center justify-center',
              'border border-border-subtle bg-background text-muted-foreground',
              'hover:bg-muted hover:text-foreground',
            )}
            aria-label={`Remove reference image ${index + 1}`}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}

      {canAdd && (
        <Button
          variant="outline"
          size="icon"
          className="size-20 border-dashed text-muted-foreground"
          onClick={handleUploadClick}
          type="button"
        >
          <Plus className="size-5" />
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
