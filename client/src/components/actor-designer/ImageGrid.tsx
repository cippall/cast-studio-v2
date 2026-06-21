import { Card } from '@/components/ui/card';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeneratedOption } from './types';

interface ImageGridProps {
  options: GeneratedOption[];
  selectedId: string | null;
  isStepConfirmed: boolean;
  onSelect: (id: string) => void;
}

function isSimulatedImage(url: string | null): boolean {
  return url != null && url.includes('picsum.photos');
}

export default function ImageGrid({
  options,
  selectedId,
  isStepConfirmed,
  onSelect,
}: ImageGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {options.map((option) => (
        <Card
          key={option.id}
          className={cn(
            'cursor-pointer overflow-hidden transition-all',
            selectedId === option.id && 'ring-2 ring-primary',
            option.status === 'PENDING' && 'animate-pulse',
          )}
          onClick={() => {
            if (option.status === 'SUCCESS' && !isStepConfirmed) {
              onSelect(option.id);
            }
          }}
        >
          <div className="relative aspect-square bg-muted">
            {option.imageUrl ? (
              <>
                <img
                  src={option.imageUrl}
                  alt="Generated option"
                  className="size-full object-cover"
                  width={300}
                  height={300}
                />
                {isSimulatedImage(option.imageUrl) && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-center">
                    <span className="text-xs font-semibold tracking-wider text-white">
                      SIMULATED
                    </span>
                  </div>
                )}
              </>
            ) : option.status === 'PENDING' ? (
              <div className="flex size-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex size-full items-center justify-center">
                <span className="text-sm text-muted-foreground">Failed</span>
              </div>
            )}
            {selectedId === option.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                <Check className="size-8 text-primary" />
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
