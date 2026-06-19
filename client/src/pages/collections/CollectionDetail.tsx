/**
 * CollectionDetail page — shows assets within a collection.
 * Mixed asset types in a grid. Marketplace items use marketplace card styling.
 * Owned items use plain cards. Add/remove assets, editable name, delete collection.
 */
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Folder, Pencil, Trash2, Plus, X, ShoppingBag, Check, AlertTriangle } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyStateV2 from '@/components/EmptyStateV2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useCollectionDetail,
  useCollectionItems,
  useUpdateCollection,
  useRemoveCollectionItem,
  useDeleteCollection,
} from '@/hooks/useCollectionDetail';
import type { CollectionItemWithAsset } from '@cast/types';

function assetTypeLabel(type: string): string {
  if (type === 'ACTOR') return 'Actor';
  if (type === 'LOOK') return 'Look';
  if (type === 'FASHION_ITEM') return 'Fashion Item';
  return type;
}

function detailPath(type: string, id: string): string {
  if (type === 'ACTOR') return `/actors/${id}`;
  if (type === 'LOOK') return `/looks/${id}`;
  return `/fashion-items/${id}`;
}

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const collectionId = id!;

  const {
    data: collection,
    isLoading: loadingCollection,
    isError: errorCollection,
    error: collectionError,
  } = useCollectionDetail(collectionId);
  const { data: items = [], isLoading: loadingItems } = useCollectionItems(collectionId);

  const updateCollection = useUpdateCollection(collectionId);
  const removeItem = useRemoveCollectionItem(collectionId);
  const deleteCollection = useDeleteCollection();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const isLoading = loadingCollection || loadingItems;

  const handleStartEdit = useCallback(() => {
    setNameValue(collection?.name ?? '');
    setEditingName(true);
  }, [collection?.name]);

  const handleSaveName = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== collection?.name) {
      updateCollection.mutate(trimmed);
    }
    setEditingName(false);
  }, [nameValue, collection?.name, updateCollection]);

  const handleDelete = useCallback(() => {
    deleteCollection.mutate(collectionId, {
      onSuccess: () => {
        navigate('/collections');
      },
    });
  }, [deleteCollection, collectionId, navigate]);

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      removeItem.mutate(itemId);
    },
    [removeItem],
  );

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState variant="detail" />
      </PageContainer>
    );
  }

  if (errorCollection) {
    return (
      <PageContainer>
        <ErrorState
          message={collectionError instanceof Error ? collectionError.message : undefined}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* Header with editable name */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center bg-surface">
                <Folder className="size-5 text-primary" />
              </div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    className="h-9 w-64"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSaveName}>
                    <Check className="mr-1 size-3" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                    <X className="mr-1 size-3" />
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                    {collection?.name}
                  </h1>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleStartEdit}
                    className="size-8 p-0"
                    aria-label="Edit collection name"
                  >
                    <Pencil className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 size-4" />
              Add Assets
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="border-error/20 text-error hover:bg-error/5 hover:text-error"
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Asset grid or empty state */}
        {items.length === 0 ? (
          <EmptyStateV2
            icon={<Folder className="size-8 text-muted-foreground" />}
            title="This collection is empty"
            description="Add assets from your library or the marketplace to get started."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <CollectionAssetCard
                key={item.id}
                item={item}
                onRemove={() => handleRemoveItem(item.id)}
                onNavigate={() => navigate(detailPath(item.asset_type, item.asset_id))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-error" />
              Delete Collection
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{collection?.name}&rdquo;? This will remove all{' '}
              {items.length} item{items.length !== 1 ? 's' : ''} from the collection. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteCollection.isPending}
            >
              {deleteCollection.isPending ? 'Deleting...' : 'Delete Collection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Assets dialog */}
      <AddAssetsDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
    </PageContainer>
  );
}

/* --------------------------------------------------------------------------- */
/* Collection asset card                                                       */
/* --------------------------------------------------------------------------- */

interface CollectionAssetCardProps {
  item: CollectionItemWithAsset;
  onRemove: () => void;
  onNavigate: () => void;
}

function CollectionAssetCard({ item, onRemove, onNavigate }: CollectionAssetCardProps) {
  const asset = item.asset;

  if (!asset) {
    return (
      <div className="border border-border bg-background p-4">
        <p className="text-sm text-muted-foreground">Asset unavailable</p>
        <Button size="sm" variant="ghost" onClick={onRemove} className="mt-2">
          <X className="mr-1 size-3" />
          Remove
        </Button>
      </div>
    );
  }

  const imageUrl = asset.headshot_url ?? asset.image_url;
  const isMarketplace = item.asset_type.startsWith('MARKETPLACE');

  return (
    <div className="group relative border border-border bg-background">
      <button
        type="button"
        onClick={onNavigate}
        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        <div className="aspect-square w-full overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={asset.name}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">{asset.name}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] font-medium">
              {assetTypeLabel(item.asset_type)}
            </Badge>
            {isMarketplace && (
              <Badge variant="outline" className="flex items-center gap-1 text-[10px]">
                <ShoppingBag className="size-2.5" />
                Marketplace
              </Badge>
            )}
          </div>
        </div>
      </button>
      {/* Remove button - top right overlay */}
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-2 top-2 size-7 p-0 opacity-0 transition-opacity group-hover:opacity-100 bg-background/80 hover:bg-background"
        aria-label="Remove from collection"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------------------- */
/* Add Assets dialog                                                           */
/* --------------------------------------------------------------------------- */

interface AddAssetsDialogProps {
  open: boolean;
  onClose: () => void;
}

function AddAssetsDialog({ open, onClose }: AddAssetsDialogProps) {
  const navigate = useNavigate();

  const browseOptions = [
    {
      icon: <Folder className="size-5 text-primary" />,
      title: 'Browse Actors',
      description: 'Add actors from your library',
      path: '/actors',
    },
    {
      icon: <Folder className="size-5 text-primary" />,
      title: 'Browse Looks',
      description: 'Add looks from your library',
      path: '/looks',
    },
    {
      icon: <Folder className="size-5 text-primary" />,
      title: 'Browse Fashion Items',
      description: 'Add fashion items from your library',
      path: '/fashion-items',
    },
    {
      icon: <ShoppingBag className="size-5 text-primary" />,
      title: 'Browse Marketplace',
      description: 'Add marketplace listings',
      path: '/marketplace',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Assets to Collection</DialogTitle>
          <DialogDescription>
            Browse your library or the marketplace to add assets to this collection.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-4">
          {browseOptions.map((opt) => (
            <Button
              key={opt.path}
              variant="outline"
              className="h-auto justify-start p-4"
              onClick={() => {
                onClose();
                navigate(opt.path);
              }}
            >
              <div className="mr-3">{opt.icon}</div>
              <div className="text-left">
                <div className="text-sm font-medium">{opt.title}</div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
