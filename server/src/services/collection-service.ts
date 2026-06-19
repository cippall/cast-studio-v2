import { query } from '../db/pool.js';
import type { AccountRow } from '../middleware/requireSession.js';
import type {
  CollectionRow,
  CollectionItemRow,
  CollectionWithItemCount,
  CollectionListResult,
  CreateCollectionInput,
  UpdateCollectionInput,
  AddCollectionItemInput,
} from '../types/collection.js';

// --- Repository Functions ---

export async function createCollection(input: CreateCollectionInput): Promise<CollectionRow> {
  const result = await query(
    `INSERT INTO collections (user_id, workspace_id, name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.user_id, input.workspace_id, input.name],
  );
  return result.rows[0] as CollectionRow;
}

export async function listCollections(options: {
  userId: string;
  workspaceId: string;
  page?: number;
  pageSize?: number;
  adminBypass?: boolean;
}): Promise<CollectionListResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const countResult = await query(
    `SELECT COUNT(*)::int AS count
     FROM collections
     WHERE user_id = $1 AND workspace_id = $2`,
    [options.userId, options.workspaceId],
  );
  const totalItems = countResult.rows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const dataResult = await query(
    `SELECT c.*, COUNT(ci.id)::int AS item_count
     FROM collections c
     LEFT JOIN collection_items ci ON ci.collection_id = c.id
     WHERE c.user_id = $1 AND c.workspace_id = $2
     GROUP BY c.id
     ORDER BY c.updated_at DESC
     LIMIT $3 OFFSET $4`,
    [options.userId, options.workspaceId, pageSize, offset],
  );

  return {
    data: dataResult.rows as CollectionWithItemCount[],
    pagination: { page, pageSize, totalItems, totalPages },
  };
}

export async function findCollectionById(
  id: string,
  userId: string,
  workspaceId: string,
): Promise<CollectionRow | null> {
  const result = await query(
    `SELECT * FROM collections WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
    [id, userId, workspaceId],
  );
  return (result.rows[0] as CollectionRow) ?? null;
}

export async function updateCollection(
  id: string,
  userId: string,
  workspaceId: string,
  data: UpdateCollectionInput,
): Promise<CollectionRow | null> {
  const result = await query(
    `UPDATE collections
     SET name = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3 AND workspace_id = $4
     RETURNING *`,
    [data.name, id, userId, workspaceId],
  );
  return (result.rows[0] as CollectionRow) ?? null;
}

export async function deleteCollection(
  id: string,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  // collection_items cascade on delete via FK
  const result = await query(
    `DELETE FROM collections WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
    [id, userId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function addCollectionItem(input: AddCollectionItemInput): Promise<CollectionItemRow> {
  const result = await query(
    `INSERT INTO collection_items (collection_id, asset_type, asset_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.collection_id, input.asset_type, input.asset_id],
  );
  return result.rows[0] as CollectionItemRow;
}

export async function findCollectionItem(
  itemId: string,
  collectionId: string,
): Promise<CollectionItemRow | null> {
  const result = await query(
    `SELECT * FROM collection_items WHERE id = $1 AND collection_id = $2`,
    [itemId, collectionId],
  );
  return (result.rows[0] as CollectionItemRow) ?? null;
}

export async function removeCollectionItem(
  itemId: string,
  collectionId: string,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const result = await query(
    `DELETE FROM collection_items ci
     USING collections c
     WHERE ci.id = $1
       AND ci.collection_id = $2
       AND c.id = ci.collection_id
       AND c.user_id = $3
       AND c.workspace_id = $4`,
    [itemId, collectionId, userId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}

// --- Service Functions ---

export async function createCollectionService(
  name: string,
  account: AccountRow,
): Promise<CollectionRow> {
  return createCollection({
    workspace_id: account.workspace_id,
    user_id: account.id,
    name,
  });
}

export async function listCollectionsService(
  options: { page?: number; pageSize?: number },
  account: AccountRow,
): Promise<CollectionListResult> {
  return listCollections({
    userId: account.id,
    workspaceId: account.workspace_id,
    page: options.page,
    pageSize: options.pageSize,
  });
}

export async function updateCollectionService(
  id: string,
  name: string,
  account: AccountRow,
): Promise<CollectionRow | null> {
  return updateCollection(id, account.id, account.workspace_id, { name });
}

export async function deleteCollectionService(id: string, account: AccountRow): Promise<boolean> {
  return deleteCollection(id, account.id, account.workspace_id);
}

export async function addItemToCollectionService(
  collectionId: string,
  assetType: string,
  assetId: string,
  account: AccountRow,
): Promise<CollectionItemRow | null> {
  // Verify the collection belongs to the user
  const collection = await findCollectionById(collectionId, account.id, account.workspace_id);
  if (!collection) {
    return null;
  }

  return addCollectionItem({
    collection_id: collectionId,
    asset_type: assetType,
    asset_id: assetId,
  });
}

export async function removeItemFromCollectionService(
  collectionId: string,
  itemId: string,
  account: AccountRow,
): Promise<boolean> {
  return removeCollectionItem(itemId, collectionId, account.id, account.workspace_id);
}
