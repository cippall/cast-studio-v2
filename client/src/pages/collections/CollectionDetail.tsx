/**
 * CollectionDetail page — shows assets within a collection.
 * Mixed asset types in a grid. Add/remove assets, editable name, delete collection.
 */
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Folder, Trash2, Plus } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyStateV2 from '@/components/EmptyStateV2';
import { Button } from '@/components/ui/button';
import {
  useCollectionDetail,
  useCollectionItems,
  useUpdateCollection,
  useRemoveCollectionItem,
  useDeleteCollection,
} from '@/hooks/useCollectionDetail';
import CollectionAssetCard from '@/components/collections/CollectionAssetCard';
import CollectionNameEditor from '@/components/collections/CollectionNameEditor';
import AddAssetsDialog from '@/components/collections/AddAssetsDialog';
import DeleteCollectionDialog from '@/components/collections/DeleteCollectionDialog';

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
      onSuccess: () => navigate('/collections'),
    });
  }, [deleteCollection, collectionId, navigate]);

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      removeItem.mutate(itemId);
    },
    [removeItem],
  );

  const existingAssetIds = new Set(items.map((i) => `${i.asset_type}:${i.asset_id}`));

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center bg-surface">
              <Folder className="size-5 text-primary" />
            </div>
            <CollectionNameEditor
              name={collection?.name ?? ''}
              itemCount={items.length}
              editing={editingName}
              editValue={nameValue}
              onEditChange={setNameValue}
              onStartEdit={handleStartEdit}
              onSave={handleSaveName}
              onCancel={() => setEditingName(false)}
            />
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

        {items.length === 0 ? (
          <EmptyStateV2
            icon={<Folder className="size-8 text-muted-foreground" />}
            title="This collection is empty"
            description="Add assets from your library to get started."
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

      <DeleteCollectionDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        collectionName={collection?.name ?? ''}
        itemCount={items.length}
        onConfirm={handleDelete}
        isDeleting={deleteCollection.isPending}
      />

      <AddAssetsDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        collectionId={collectionId}
        existingAssetIds={existingAssetIds}
      />
    </PageContainer>
  );
}
