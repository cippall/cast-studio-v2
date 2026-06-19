export interface CollectionRow {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionItemRow {
  id: string;
  collection_id: string;
  asset_type: string;
  asset_id: string;
  created_at: string;
}

export interface CollectionWithItemCount extends CollectionRow {
  item_count: number;
}

export interface CreateCollectionInput {
  workspace_id: string;
  user_id: string;
  name: string;
}

export interface UpdateCollectionInput {
  name: string;
}

export interface AddCollectionItemInput {
  collection_id: string;
  asset_type: string;
  asset_id: string;
}

export interface CollectionListResult {
  data: CollectionWithItemCount[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
