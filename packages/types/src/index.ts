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
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
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
