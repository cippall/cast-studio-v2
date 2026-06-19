import { query } from '../db/pool.js';
import type { AccountRow } from '../middleware/requireSession.js';
import type {
  CollectionRow,
  CollectionItemRow,
  CollectionItemDetail,
  CollectionWithItemCount,
  CollectionListResult,
  CreateCollectionInput,
  UpdateCollectionInput,
  AddCollectionItemInput,
} from '../types/collection.js';

export class DuplicateItemError extends Error {
  constructor() {
    super('Asset already in collection');
    this.name = 'DuplicateItemError';
  }
}

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
  search?: string;
}): Promise<CollectionListResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ['c.user_id = $1', 'c.workspace_id = $2'];
  const params: (string | number)[] = [options.userId, options.workspaceId];
  if (options.search) {
    conditions.push(`c.name ILIKE $${params.length + 1}`);
    params.push(`%${options.search}%`);
  }
  const whereClause = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*)::int AS count FROM collections WHERE ${whereClause}`,
    params,
  );
  const totalItems = countResult.rows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const dataParams = [...params, pageSize, offset];
  const dataResult = await query(
    `SELECT c.*, COUNT(ci.id)::int AS item_count
     FROM collections c
     LEFT JOIN collection_items ci ON ci.collection_id = c.id
     WHERE ${whereClause}
     GROUP BY c.id
     ORDER BY c.updated_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams,
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

export async function findCollectionItemByAsset(
  collectionId: string,
  assetId: string,
): Promise<CollectionItemRow | null> {
  const result = await query(
    `SELECT * FROM collection_items WHERE collection_id = $1 AND asset_id = $2`,
    [collectionId, assetId],
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
  options: { page?: number; pageSize?: number; search?: string },
  account: AccountRow,
): Promise<CollectionListResult> {
  return listCollections({
    userId: account.id,
    workspaceId: account.workspace_id,
    page: options.page,
    pageSize: options.pageSize,
    search: options.search,
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

  // Check for duplicate: same asset already in this collection
  const existing = await findCollectionItemByAsset(collectionId, assetId);
  if (existing) {
    throw new DuplicateItemError();
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

export async function getCollectionItems(
  collectionId: string,
  userId: string,
  workspaceId: string,
): Promise<CollectionItemRow[]> {
  // Verify the collection belongs to the user
  const collection = await findCollectionById(collectionId, userId, workspaceId);
  if (!collection) {
    return [];
  }

  const result = await query(
    `SELECT ci.*
     FROM collection_items ci
     WHERE ci.collection_id = $1
     ORDER BY ci.created_at DESC`,
    [collectionId],
  );
  return result.rows as CollectionItemRow[];
}

export async function getCollectionItemsWithAssets(
  collectionId: string,
  userId: string,
  workspaceId: string,
): Promise<CollectionItemDetail[]> {
  // Verify the collection belongs to the user
  const collection = await findCollectionById(collectionId, userId, workspaceId);
  if (!collection) {
    return [];
  }

  const result = await query(
    `SELECT ci.*,
            a.name AS asset_name,
            a.asset_type AS asset_type_ref,
            ao.image_url AS asset_image_url
     FROM collection_items ci
     LEFT JOIN assets a ON ci.asset_id = a.id
     LEFT JOIN LATERAL (
       SELECT ao2.image_url
       FROM asset_outputs ao2
       WHERE ao2.asset_id = ci.asset_id
       ORDER BY ao2.created_at DESC
       LIMIT 1
     ) ao ON TRUE
     WHERE ci.collection_id = $1
     ORDER BY ci.created_at DESC`,
    [collectionId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    collection_id: row.collection_id,
    asset_type: row.asset_type,
    asset_id: row.asset_id,
    created_at: row.created_at,
    asset: row.asset_name
      ? {
          name: row.asset_name,
          image_url: row.asset_image_url,
          headshot_url: row.asset_type === 'ACTOR' ? row.asset_image_url : null,
        }
      : null,
  }));
}
