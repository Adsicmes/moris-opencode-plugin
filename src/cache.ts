import { normalizeCatalog } from './catalog.js';
import type { CatalogResponse } from './contracts.js';

export const CACHE_KEY = 'catalog/moris/v1';
export const CACHE_VERSION = 1;

export interface CatalogCacheRecord {
  v: typeof CACHE_VERSION;
  /** When the client wrote the record. Diagnostics only: it never extends `syncedAt`. */
  savedAt: string;
  catalog: CatalogResponse;
}

/**
 * Build the durable cache payload. It contains the gateway catalog only:
 * plugin options, the gateway base URL and the device key are not stored.
 */
export function encodeCache(catalog: CatalogResponse, savedAt: string): CatalogCacheRecord {
  return { v: CACHE_VERSION, savedAt, catalog };
}

export function decodeCache(value: unknown): CatalogCacheRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== CACHE_VERSION || typeof raw.savedAt !== 'string') return null;
  const catalog = normalizeCatalog(raw.catalog);
  if (catalog === null) return null;
  return { v: CACHE_VERSION, savedAt: raw.savedAt, catalog };
}

/** True when the catalog has at least one entry the gateway synced within `ttlMs`. */
export function hasFreshEntry(catalog: CatalogResponse | null, now: number, ttlMs: number): boolean {
  if (catalog === null) return false;
  return catalog.models.some((model) => {
    const synced = Date.parse(model.syncedAt);
    return Number.isFinite(synced) && now - synced < ttlMs;
  });
}
