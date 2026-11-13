import { normalizeCatalog } from './catalog.js';
export const CACHE_KEY = 'catalog/moris/v1';
export const CACHE_VERSION = 1;
/**
 * Build the durable cache payload. It contains the gateway catalog only:
 * plugin options, the gateway base URL and the device key are not stored.
 */
export function encodeCache(catalog, savedAt) {
    return { v: CACHE_VERSION, savedAt, catalog };
}
export function decodeCache(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return null;
    const raw = value;
    if (raw.v !== CACHE_VERSION || typeof raw.savedAt !== 'string')
        return null;
    const catalog = normalizeCatalog(raw.catalog);
    if (catalog === null)
        return null;
    return { v: CACHE_VERSION, savedAt: raw.savedAt, catalog };
}
/** True when the catalog has at least one entry the gateway synced within `ttlMs`. */
export function hasFreshEntry(catalog, now, ttlMs) {
    if (catalog === null)
        return false;
    return catalog.models.some((model) => {
        const synced = Date.parse(model.syncedAt);
        return Number.isFinite(synced) && now - synced < ttlMs;
    });
}
