import type { CatalogResponse } from './contracts.js';
export declare const CACHE_KEY = "catalog/moris/v1";
export declare const CACHE_VERSION = 1;
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
export declare function encodeCache(catalog: CatalogResponse, savedAt: string): CatalogCacheRecord;
export declare function decodeCache(value: unknown): CatalogCacheRecord | null;
/** True when the catalog has at least one entry the gateway synced within `ttlMs`. */
export declare function hasFreshEntry(catalog: CatalogResponse | null, now: number, ttlMs: number): boolean;
