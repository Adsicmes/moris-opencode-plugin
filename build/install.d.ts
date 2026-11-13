import type { Context } from '@opencode/plugin/promise/plugin';
/**
 * OpenCode v2 server plugin for the Moris LLM Gateway.
 *
 * - registers exactly one provider, `moris`, and nothing else;
 * - syncs every model from `GET /api/catalog`, with each model's protocol
 *   selecting its own runtime package;
 * - caches the catalog locally, but never past the supplier's `syncedAt`
 *   plus the 24 h TTL;
 * - refreshes every five minutes, keeps the last successful catalog on a
 *   failed refresh, and releases its timer and hook registrations on unload;
 * - forbids OpenCode retries for this provider only (the gateway retries
 *   upstream), and disables the WebSocket transport through
 *   `settings.transport: "http"`.
 */
export declare function install(ctx: Context): Promise<() => Promise<void>>;
