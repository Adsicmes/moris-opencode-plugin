import type { CatalogModel } from './contracts.js';
/** OpenAI-compatible chat, OpenAI-compatible Responses, Anthropic Messages. */
export declare const PACKAGE_BY_PROTOCOL: Record<string, string>;
export interface OpenCodeCost {
    input: number;
    output: number;
    cache: {
        read: number;
        write: number;
    };
}
export interface OpenCodeVariant {
    id: string;
    body: Record<string, unknown>;
}
/**
 * `capabilities.reasoning` is documented for models.dev v2 data, but
 * `@opencode/plugin` 2.2.7 decodes `Model.Info.capabilities` with a schema
 * that strips the key at runtime (verified). Emitting it would be a fake
 * support claim, so reasoning is carried only by the synced `variants`.
 */
export interface OpenCodeCapabilities {
    tools: boolean;
    input: string[];
    output: string[];
}
export interface OpenCodeModelSpec {
    id: string;
    modelID: string;
    providerID: 'moris';
    name: string;
    family: string;
    package: string;
    headers: Record<string, string>;
    capabilities: OpenCodeCapabilities;
    variants: OpenCodeVariant[];
    time: {
        released: number;
    };
    /** `[]` is the SDK's own "no price expressed" value (`Model.Info.default`). */
    cost: OpenCodeCost[];
    status: 'active' | 'deprecated';
    enabled: boolean;
    limit: {
        context: number;
        output: number;
        input?: number;
    };
}
export interface OpenCodeProviderSettings {
    baseURL: string;
    transport: 'http';
    headerTimeout: number;
    chunkTimeout: number;
    timeout: number;
}
export interface OpenCodeProviderInfo {
    id: 'moris';
    name: string;
    activation: 'enabled';
    package: string;
    settings: OpenCodeProviderSettings;
}
export interface SpecOptions {
    apiBase: string;
    apiKey: string | null;
    catalogTtlMs: number;
    now: number;
    headerTimeoutMs: number;
    chunkTimeoutMs: number;
    requestTimeoutMs: number;
}
export interface CostVerdict {
    /** `zero`: subscription, authoritative 0. `priced`: fully mapped USD tier. `unexpressed`: `cost: []`. */
    mode: 'zero' | 'priced' | 'unexpressed';
    reason?: string;
    cost: OpenCodeCost[];
}
/**
 * OpenCode's runtime `Model.Cost` needs input, output, cache.read and
 * cache.write; there is no `null` or "unknown" number, and `Schema.Finite`
 * rejects Infinity/NaN. `Model.Info.default` uses `cost: []` for "no price
 * expressed", so that is the only non-fabricated representation available.
 *
 * - subscription: `[0,0,0,0]` (the billing contract says client cost is 0);
 * - metered USD token price with all four amounts: the real tier;
 * - everything else (complex, per-request, unknown, CNY, or a token price
 *   missing an amount): `[]` and the model stays callable with a name hint.
 *
 * A missing cache amount is never filled from the input price: that would
 * invent a charge the gateway's price did not state.
 */
export declare function costForModel(model: CatalogModel): CostVerdict;
/**
 * Map one gateway catalog entry to an OpenCode model definition.
 *
 * A model stays callable whenever the supplier synced it within the TTL, the
 * gateway still marks it enabled, its protocol has a runtime package, and its
 * context/output limits are known. Pricing is never a reason to hide a model:
 * an unexpressible price is carried as `cost: []` and the name says
 * "价格见网关" so the client's zero/absent price is not read as a real quote.
 * Unknown limits or an unknown protocol are genuine routing unknowns, so those
 * models are published disabled.
 */
export declare function modelSpec(model: CatalogModel, options: SpecOptions): OpenCodeModelSpec;
export declare function modelSpecs(models: readonly CatalogModel[] | null, options: SpecOptions): OpenCodeModelSpec[];
/**
 * The single provider OpenCode registers. Base URL and transport are set
 * here; the device key travels on each model's Authorization header so an
 * existing user-owned `moris` provider keeps every other setting.
 */
export declare function providerInfo(options: {
    apiBase: string;
    headerTimeoutMs: number;
    chunkTimeoutMs: number;
    requestTimeoutMs: number;
}): OpenCodeProviderInfo;
