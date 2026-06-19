/**
 * AddAssetsDialog — shows user's library assets with multi-select
 * and adds selected assets to a collection.
 */
import { useState, useCallback, useMemo } from 'react';
import { Folder, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useUserLibrary } from '@/hooks/useUserLibrary';
import { useAddCollectionItem } from '@/hooks/useCollectionDetail';

function assetTypeLabel(type: string): string {
  if (type === 'ACTOR') return 'Actor';
  if (type === 'LOOK') return 'Look';
  if (type === 'FASHION_ITEM') return 'Fashion Item';
  return type;
}

interface AddAssetsDialogProps {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  existingAssetIds: Set<string>;
}

export default function AddAssetsDialog({
  open,
  onClose,
  collectionId,
  existingAssetIds,
}: AddAssetsDialogProps) {
  const { data: libraryAssets = [], isLoading } = useUserLibrary();
  const addItem = useAddCollectionItem(collectionId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const availableAssets = useMemo(() => {
    return libraryAssets.filter((asset) => {
      const key = `${asset.asset_type}:${asset.id}`;
      if (existingAssetIds.has(key)) return false;
      if (search) {
        const q = search.toLowerCase();
        return asset.name.toLowerCase().includes(q) || asset.asset_type.toLowerCase().includes(q);
      }
      return true;
    });
  }, [libraryAssets, existingAssetIds, search]);

  const toggleAsset = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleAdd = useCallback(() => {
    if (selected.size === 0) return;

    let completed = 0;
    const total = selected.size;

    selected.forEach((key) => {
      const [assetType, assetId] = key.split(':');
      addItem.mutate(
        { assetType, assetId },
        {
          onSuccess: () => {
            completed++;
            if (completed === total) {
              setSelected(new Set());
              setSearch('');
              onClose();
            }
          },
          onError: () => {
            completed++;
            if (completed === total) {
              setSelected(new Set());
            }
          },
        },
      );
    });
  }, [selected, addItem, onClose]);

  const handleClose = useCallback(() => {
    setSelected(new Set());
    setSearch('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Assets to Collection</DialogTitle>
          <DialogDescription>
            Select assets from your library to add to this collection.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 border border-border">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-muted-foreground">Loading assets...</span>
            </div>
          ) : availableAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Folder className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {search ? 'No matching assets found' : 'All assets are already in this collection'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {availableAssets.map((asset) => {
                const key = `${asset.asset_type}:${asset.id}`;
                const isSelected = selected.has(key);
                const imageUrl = asset.headshot_url ?? asset.image_url;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAsset(key)}
                    className={`flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 ${
                      isSelected ? 'bg-muted' : ''
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleAsset(key)}
                      aria-label={`Select ${asset.name}`}
                    />
                    <div className="size-10 shrink-0 overflow-hidden bg-muted">
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Folder className="size-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {assetTypeLabel(asset.asset_type)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-sm text-muted-foreground">{selected.size} selected</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={selected.size === 0 || addItem.isPending}>
              {addItem.isPending
                ? 'Adding...'
                : `Add ${selected.size > 0 ? `(${selected.size})` : ''}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
