// Shared TypeScript types for Cast Studio v2
// Import as: import { AssetType } from '@cast/types'

export enum AssetType {
  ACTOR = 'ACTOR',
  LOOK = 'LOOK',
  FASHION_ITEM = 'FASHION_ITEM',
}

/**
 * Generation status for async image generation jobs
 */
export enum GenerationStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum AccountRole {
  ADMIN = 'ADMIN',
  ARTIST = 'ARTIST',
  CLIENT = 'CLIENT',
  AGENT = 'AGENT',
}

export enum EntryMethod {
  FORM = 'FORM',
  REFERENCE = 'REFERENCE',
  TEXT = 'TEXT',
  RANDOMIZE = 'RANDOMIZE',
}

export enum SourceType {
  ORIGINAL = 'ORIGINAL',
  MARKETPLACE_PURCHASE = 'MARKETPLACE_PURCHASE',
  COMMISSION = 'COMMISSION',
  DUPLICATE = 'DUPLICATE',
}

export enum MarketplaceStatus {
  NONE = 'NONE',
  MARKETPLACE_PENDING = 'MARKETPLACE_PENDING',
  MARKETPLACE_APPROVED = 'MARKETPLACE_APPROVED',
  MARKETPLACE_REJECTED = 'MARKETPLACE_REJECTED',
  MARKETPLACE_DELISTED = 'MARKETPLACE_DELISTED',
}

export enum CommissionStatus {
  REQUESTED = 'REQUESTED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// --- Commission types ---

export interface CommissionBrief {
  project_type?: string;
  style?: string;
  reference_images?: string[];
  notes?: string;
  [key: string]: unknown;
}

export interface CommissionAsset {
  id: string;
  asset_id: string;
  asset_output_id: string;
}

export interface Commission {
  id: string;
  title: string;
  status: CommissionStatus | string;
  client_id: string;
  client_workspace_id: string;
  studio_workspace_id: string;
  assignee_id?: string;
  brief: CommissionBrief;
  premium_cost?: number;
  submitted_at?: string;
  created_at: string;
  updated_at?: string;
  assets?: CommissionAsset[];
}

export interface CommissionFormTemplate {
  id: string;
  name: string;
  fields: FormField[];
  is_active: boolean;
}

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'file';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

// --- Asset list types ---

export interface ActorListItem {
  id: string;
  name: string;
  creator_id: string;
  asset_type: string;
  seed: number;
  prompt_recipe: Record<string, unknown>;
  headshot_url: string | null;
  created_at: string;
  taxonomy_values?: Record<string, string>;
}

export interface LookListItem {
  id: string;
  name: string;
  creator_id: string;
  asset_type: string;
  image_url: string | null;
  created_at: string;
  taxonomy_values?: Record<string, string>;
}

export interface FashionItemListItem {
  id: string;
  name: string;
  creator_id: string;
  asset_type: string;
  image_url: string | null;
  created_at: string;
  taxonomy_values?: Record<string, string>;
}

export interface WalletBalance {
  balance: number;
  currency: string;
}

export interface DashboardStats {
  totalActors: number;
  totalLooks: number;
  totalItems: number;
  activeMembers: number;
  pendingCommissions: number;
}
