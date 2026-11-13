import { type CatalogModel, type CatalogResponse } from './contracts.js';
/** Business model id, without the `moris/` provider prefix OpenCode adds. */
export declare function businessModelId(value: string): string | null;
/**
 * Read `GET /api/catalog` defensively. Malformed models are dropped; the
 * provider id must match so a misconfigured URL cannot be mistaken for the
 * gateway.
 */
export declare function normalizeCatalog(value: unknown): CatalogResponse | null;
export declare function syncedAtMs(model: CatalogModel): number | null;
/**
 * Supplier freshness, not local cache age. A cache write never extends the
 * supplier's `syncedAt` window.
 */
export declare function isSupplierFresh(model: CatalogModel, now: number, ttlMs: number): boolean;
