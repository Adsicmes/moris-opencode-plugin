/**
 * Local mirror of the provider/model fields this plugin reads from
 * `GET /api/catalog` (see `packages/contracts/src/index.ts` and
 * `docs/API.md`).
 *
 * The package is published independently of the private workspace, so it
 * keeps its own copy of the wire contract. Only the fields the OpenCode
 * plugin consumes are modelled; unknown fields are dropped by
 * `normalizeCatalog`.
 */
export declare const PROVIDER_ID: "moris";
export type Protocol = 'chat-completions' | 'responses' | 'messages' | 'unknown';
export type BillingType = 'subscription' | 'metered';
export type DataState = 'ok' | 'unknown' | 'stale' | 'error' | 'unsupported';
export type PriceKind = 'token' | 'request' | 'complex' | 'unknown';
export interface Price {
    kind: PriceKind;
    currency: 'USD' | 'CNY';
    /** Per-million-token amount in the price currency. */
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    perRequest?: number;
    expression?: string;
    source?: string;
    version?: string;
}
export interface ModelCapabilities {
    tools: boolean;
    input: Array<'text' | 'image'>;
    output: Array<'text'>;
    reasoning?: boolean;
}
export interface CatalogModel {
    id: string;
    accountId: string;
    namespace: string;
    path: string;
    upstreamModel: string;
    name: string;
    family: string;
    protocol: Protocol;
    capabilities: ModelCapabilities;
    limit: {
        context: number | null;
        output: number | null;
        input?: number;
    };
    variants: Record<string, Record<string, unknown>>;
    price: Price;
    billingType: BillingType;
    enabled: boolean;
    syncedAt: string;
    group?: string;
    disabledReason?: string;
    sources?: Record<string, string>;
}
export interface CatalogResponse {
    providerID: 'moris';
    fetchedAt: string;
    models: CatalogModel[];
    accounts: Array<{
        id: string;
        lastSyncedAt: string | null;
        state: DataState;
        error?: string;
    }>;
}
