import { isSupplierFresh } from './catalog.js';
import type { CatalogModel, Price } from './contracts.js';

/** OpenAI-compatible chat, OpenAI-compatible Responses, Anthropic Messages. */
export const PACKAGE_BY_PROTOCOL: Record<string, string> = {
  'chat-completions': '@opencode/ai/providers/openai-compatible',
  responses: '@opencode/ai/providers/openai-compatible/responses',
  messages: '@opencode/ai/providers/anthropic-compatible',
};

export interface OpenCodeCost {
  input: number;
  output: number;
  cache: { read: number; write: number };
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
  time: { released: number };
  /** `[]` is the SDK's own "no price expressed" value (`Model.Info.default`). */
  cost: OpenCodeCost[];
  status: 'active' | 'deprecated';
  enabled: boolean;
  limit: { context: number; output: number; input?: number };
}

export interface OpenCodeProviderSettings {
  baseURL: string;
  /**
   * `false` states that this provider has no credential to resolve and
   * authenticates through each model's static headers. `AuthOptions.apiKey`
   * maps it to `Auth.none`; leaving it out leaves the route on
   * `AuthOptions.bearer(undefined)`, which fails every request with
   * "Missing auth credential: apiKey".
   *
   * OpenCode only drops that requirement on its own for packages in its
   * no-auth allowlist. `openai-compatible` (chat) and `anthropic-compatible`
   * are listed; `openai-compatible/responses` is not, so the subscription
   * models would fail without this flag.
   */
  apiKey?: false;
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

const ZERO_COST: OpenCodeCost = { input: 0, output: 0, cache: { read: 0, write: 0 } };

function finite(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
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
export function costForModel(model: CatalogModel): CostVerdict {
  if (model.billingType === 'subscription') return { mode: 'zero', cost: [ZERO_COST] };
  const price: Price = model.price;
  if (price.kind !== 'token') {
    return {
      mode: 'unexpressed',
      reason: `${price.kind} pricing cannot be expressed in OpenCode cost (USD per million tokens)`,
      cost: [],
    };
  }
  if (price.currency !== 'USD') {
    return {
      mode: 'unexpressed',
      reason: `${price.currency} token pricing cannot be expressed in OpenCode cost (USD only)`,
      cost: [],
    };
  }
  const input = finite(price.input);
  const output = finite(price.output);
  const cacheRead = finite(price.cacheRead);
  const cacheWrite = finite(price.cacheWrite);
  if (input === null || output === null || cacheRead === null || cacheWrite === null) {
    return {
      mode: 'unexpressed',
      reason: 'token price is missing an input, output or cache amount',
      cost: [],
    };
  }
  return { mode: 'priced', cost: [{ input, output, cache: { read: cacheRead, write: cacheWrite } }] };
}

function variantsFor(model: CatalogModel): OpenCodeVariant[] {
  return Object.entries(model.variants).map(([id, body]) => ({ id, body }));
}

function releasedAt(model: CatalogModel): number {
  const raw = model.sources?.released ?? model.sources?.releaseDate;
  if (raw !== undefined) {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

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
export function modelSpec(model: CatalogModel, options: SpecOptions): OpenCodeModelSpec {
  const pkg = PACKAGE_BY_PROTOCOL[model.protocol] ?? null;
  const price = costForModel(model);
  const fresh = isSupplierFresh(model, options.now, options.catalogTtlMs);
  const limitsKnown = model.limit.context !== null && model.limit.output !== null;
  const enabled = fresh && model.enabled && pkg !== null && limitsKnown;
  const headers: Record<string, string> = {};
  if (options.apiKey !== null) headers.Authorization = `Bearer ${options.apiKey}`;
  const priceHint = '（价格见网关）';
  const name = price.mode === 'unexpressed' && !model.name.endsWith(priceHint) ? `${model.name}${priceHint}` : model.name;
  const spec: OpenCodeModelSpec = {
    id: model.id,
    modelID: model.id,
    providerID: 'moris',
    name,
    family: model.family,
    package: pkg ?? PACKAGE_BY_PROTOCOL['chat-completions'] as string,
    headers,
    capabilities: {
      tools: model.capabilities.tools,
      input: [...model.capabilities.input],
      output: ['text'],
    },
    variants: variantsFor(model),
    time: { released: releasedAt(model) },
    cost: price.cost,
    status: enabled ? 'active' : 'deprecated',
    enabled,
    limit: {
      context: model.limit.context ?? 1,
      output: model.limit.output ?? 1,
      ...(model.limit.input !== undefined ? { input: model.limit.input } : {}),
    },
  };
  return spec;
}

export function modelSpecs(models: readonly CatalogModel[] | null, options: SpecOptions): OpenCodeModelSpec[] {
  if (models === null) return [];
  return models.map((model) => modelSpec(model, options));
}

/**
 * The single provider OpenCode registers. Base URL and transport are set
 * here; the device key travels on each model's Authorization header so an
 * existing user-owned `moris` provider keeps every other setting.
 * `settings.apiKey: false` completes that contract: the provider carries no
 * resolvable credential, so OpenCode must keep the static headers as its
 * authentication instead of failing on a missing one.
 */
export function providerInfo(options: {
  apiBase: string;
  headerTimeoutMs: number;
  chunkTimeoutMs: number;
  requestTimeoutMs: number;
}): OpenCodeProviderInfo {
  return {
    id: 'moris',
    name: 'Moris LLM Gateway',
    activation: 'enabled',
    package: PACKAGE_BY_PROTOCOL['chat-completions'] as string,
    settings: {
      baseURL: options.apiBase,
      // The gateway streams over HTTP only; this is the documented V2 switch.
      transport: 'http',
      apiKey: false,
      headerTimeout: options.headerTimeoutMs,
      chunkTimeout: options.chunkTimeoutMs,
      timeout: options.requestTimeoutMs,
    },
  };
}
