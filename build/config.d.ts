/** Refresh the gateway catalog every five minutes. */
export declare const DEFAULT_REFRESH_MS = 300000;
/** A catalog entry is only usable while its supplier `syncedAt` is younger than this. */
export declare const DEFAULT_CATALOG_TTL_MS = 86400000;
export declare const MIN_REFRESH_MS = 60000;
export declare const MIN_TTL_MS = 60000;
/** Mirrors `DEFAULT_SETTINGS` in packages/contracts. */
export declare const DEFAULT_HEADER_TIMEOUT_MS = 120000;
export declare const DEFAULT_CHUNK_TIMEOUT_MS = 90000;
export declare const DEFAULT_REQUEST_TIMEOUT_MS = 900000;
export declare const DEFAULT_FETCH_TIMEOUT_MS = 15000;
export interface MorisPluginConfig {
    /** Gateway origin, without the trailing `/v1`. */
    rootUrl: string;
    /** Base URL handed to the OpenCode provider packages (`.../v1`). */
    apiBase: string;
    apiKey: string | null;
    refreshMs: number;
    catalogTtlMs: number;
    fetchTimeoutMs: number;
    headerTimeoutMs: number;
    chunkTimeoutMs: number;
    requestTimeoutMs: number;
}
export type ConfigResult = {
    ok: true;
    value: MorisPluginConfig;
} | {
    ok: false;
    error: string;
};
/** `https://host[/path]` with any trailing slash and one trailing `/v1` removed. */
export declare function gatewayRoot(baseUrl: string): string;
/** What the OpenAI/Anthropic compatible packages expect: the gateway's `/v1` root. */
export declare function gatewayApiBase(baseUrl: string): string;
/**
 * Read plugin options. The device key may come from `options.apiKey` or the
 * server process environment; it is never written to the catalog cache.
 */
export declare function readConfig(options: Record<string, unknown>, env?: Record<string, string | undefined>): ConfigResult;
/** The gateway route backing a protocol. Each model names its own package. */
export declare function gatewayPath(protocol: string): string | null;
