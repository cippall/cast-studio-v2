/**
 * AddToCollectionDropdown — shared "Add to Collection" action for asset cards.
 * Fetches user's collections, shows dropdown to pick or create new.
 * Prevents duplicates, toast confirmation after adding.
 */
import { useState } from 'react';
import { FolderPlus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import type { Collection, CollectionWithItemCount, CollectionListResult } from '@cast/types';

interface AddToCollectionDropdownProps {
  assetType: string; // 'ACTOR' | 'LOOK' | 'FASHION_ITEM'
  assetId: string;
  assetName: string;
  onAdded?: () => void;
}

export default function AddToCollectionDropdown({
  assetType,
  assetId,
  assetName,
  onAdded,
}: AddToCollectionDropdownProps) {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const queryClient = useQueryClient();

  const { data: collectionsData } = useQuery<CollectionListResult>({
    queryKey: ['collections', { pageSize: 100 }],
    queryFn: async () => {
      const { data } = await apiClient.get('/collections?pageSize=100');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.post<Collection>('/collections', { name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      await apiClient.post(`/collections/${collectionId}/items`, {
        asset_type: assetType,
        asset_id: assetId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const collections = collectionsData?.data ?? [];

  const filteredCollections = collections.filter((c: CollectionWithItemCount) => {
    if (search) {
      return c.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleAddToCollection = (collectionId: string, collectionName: string) => {
    addMutation.mutate(collectionId, {
      onSuccess: () => {
        toast.success(`Added "${assetName}" to "${collectionName}"`);
        onAdded?.();
      },
      onError: () => {
        toast.error(`Failed to add "${assetName}" to "${collectionName}"`);
      },
    });
  };

  const handleCreateAndAdd = () => {
    if (!newCollectionName.trim()) return;

    createMutation.mutate(newCollectionName.trim(), {
      onSuccess: (newCollection) => {
        addMutation.mutate(newCollection.id, {
          onSuccess: () => {
            toast.success(`Created "${newCollection.name}" and added "${assetName}"`);
            setNewCollectionName('');
            setShowCreate(false);
            onAdded?.();
          },
          onError: () => {
            toast.error('Created collection but failed to add item');
          },
        });
      },
      onError: () => {
        toast.error('Failed to create collection');
      },
    });
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) {
          setShowCreate(false);
          setSearch('');
          setNewCollectionName('');
        }
      }}
    >
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <FolderPlus className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Add to Collection</DropdownMenuLabel>
        <DropdownMenuGroup>
          <div className="px-2 pb-1">
            <Input
              placeholder="Search or create..."
              value={showCreate ? newCollectionName : search}
              onChange={(e) => {
                if (showCreate) {
                  setNewCollectionName(e.target.value);
                } else {
                  setSearch(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !showCreate &&
                  filteredCollections.length === 0 &&
                  search.trim()
                ) {
                  setShowCreate(true);
                  setNewCollectionName(search);
                  setSearch('');
                }
                if (e.key === 'Enter' && showCreate && newCollectionName.trim()) {
                  handleCreateAndAdd();
                }
                if (e.key === 'Escape') {
                  setShowCreate(false);
                  setNewCollectionName('');
                }
              }}
              className="h-8 text-xs"
              autoFocus
            />
          </div>
          {filteredCollections.length === 0 && !showCreate && search.trim() && (
            <DropdownMenuItem
              onClick={() => {
                setShowCreate(true);
                setNewCollectionName(search);
                setSearch('');
              }}
            >
              <Plus className="mr-2 size-4" />
              Create &quot;{search.trim()}&quot;
            </DropdownMenuItem>
          )}
          {filteredCollections.map((c: CollectionWithItemCount) => (
            <DropdownMenuItem key={c.id} onClick={() => handleAddToCollection(c.id, c.name)}>
              <FolderPlus className="mr-2 size-4" />
              {c.name}
            </DropdownMenuItem>
          ))}
          {!showCreate && filteredCollections.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 size-4" />
                Create new collection
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
