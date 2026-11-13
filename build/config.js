import { PROVIDER_ID } from './contracts.js';
/** Refresh the gateway catalog every five minutes. */
export const DEFAULT_REFRESH_MS = 300_000;
/** A catalog entry is only usable while its supplier `syncedAt` is younger than this. */
export const DEFAULT_CATALOG_TTL_MS = 86_400_000;
export const MIN_REFRESH_MS = 60_000;
export const MIN_TTL_MS = 60_000;
/** Mirrors `DEFAULT_SETTINGS` in packages/contracts. */
export const DEFAULT_HEADER_TIMEOUT_MS = 120_000;
export const DEFAULT_CHUNK_TIMEOUT_MS = 90_000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 900_000;
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
function text(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
function positive(value, fallback, min) {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}
/** `https://host[/path]` with any trailing slash and one trailing `/v1` removed. */
export function gatewayRoot(baseUrl) {
    const trimmed = baseUrl.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed;
}
/** What the OpenAI/Anthropic compatible packages expect: the gateway's `/v1` root. */
export function gatewayApiBase(baseUrl) {
    const root = gatewayRoot(baseUrl);
    return `${root}/v1`;
}
function validUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    }
    catch {
        return false;
    }
}
/**
 * Read plugin options. The device key may come from `options.apiKey` or the
 * server process environment; it is never written to the catalog cache.
 */
export function readConfig(options, env = {}) {
    const baseUrl = text(options.baseUrl) ?? text(options.baseURL) ?? text(env.MORIS_GATEWAY_URL);
    if (baseUrl === null) {
        return {
            ok: false,
            error: `missing plugin option "baseUrl" (or MORIS_GATEWAY_URL) for provider "${PROVIDER_ID}"`,
        };
    }
    if (!validUrl(gatewayRoot(baseUrl))) {
        return { ok: false, error: `plugin option "baseUrl" is not an http(s) URL` };
    }
    const apiKey = text(options.apiKey) ?? text(env.MORIS_GATEWAY_KEY);
    return {
        ok: true,
        value: {
            rootUrl: gatewayRoot(baseUrl),
            apiBase: gatewayApiBase(baseUrl),
            apiKey,
            refreshMs: positive(options.refreshIntervalMs, DEFAULT_REFRESH_MS, MIN_REFRESH_MS),
            catalogTtlMs: positive(options.catalogTtlMs, DEFAULT_CATALOG_TTL_MS, MIN_TTL_MS),
            fetchTimeoutMs: positive(options.fetchTimeoutMs, DEFAULT_FETCH_TIMEOUT_MS, 1_000),
            headerTimeoutMs: positive(options.headerTimeoutMs, DEFAULT_HEADER_TIMEOUT_MS, 1_000),
            chunkTimeoutMs: positive(options.chunkTimeoutMs, DEFAULT_CHUNK_TIMEOUT_MS, 1_000),
            requestTimeoutMs: positive(options.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS, 1_000),
        },
    };
}
/** The gateway route backing a protocol. Each model names its own package. */
export function gatewayPath(protocol) {
    switch (protocol) {
        case 'chat-completions':
            return '/chat/completions';
        case 'responses':
            return '/responses';
        case 'messages':
            return '/messages';
        default:
            return null;
    }
}
