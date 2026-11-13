import { isSupplierFresh } from './catalog.js';
/** OpenAI-compatible chat, OpenAI-compatible Responses, Anthropic Messages. */
export const PACKAGE_BY_PROTOCOL = {
    'chat-completions': '@opencode/ai/providers/openai-compatible',
    responses: '@opencode/ai/providers/openai-compatible/responses',
    messages: '@opencode/ai/providers/anthropic-compatible',
};
const ZERO_COST = { input: 0, output: 0, cache: { read: 0, write: 0 } };
function finite(value) {
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
export function costForModel(model) {
    if (model.billingType === 'subscription')
        return { mode: 'zero', cost: [ZERO_COST] };
    const price = model.price;
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
function variantsFor(model) {
    return Object.entries(model.variants).map(([id, body]) => ({ id, body }));
}
function releasedAt(model) {
    const raw = model.sources?.released ?? model.sources?.releaseDate;
    if (raw !== undefined) {
        const ms = Date.parse(raw);
        if (Number.isFinite(ms))
            return ms;
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
export function modelSpec(model, options) {
    const pkg = PACKAGE_BY_PROTOCOL[model.protocol] ?? null;
    const price = costForModel(model);
    const fresh = isSupplierFresh(model, options.now, options.catalogTtlMs);
    const limitsKnown = model.limit.context !== null && model.limit.output !== null;
    const enabled = fresh && model.enabled && pkg !== null && limitsKnown;
    const headers = {};
    if (options.apiKey !== null)
        headers.Authorization = `Bearer ${options.apiKey}`;
    const priceHint = '（价格见网关）';
    const name = price.mode === 'unexpressed' && !model.name.endsWith(priceHint) ? `${model.name}${priceHint}` : model.name;
    const spec = {
        id: model.id,
        modelID: model.id,
        providerID: 'moris',
        name,
        family: model.family,
        package: pkg ?? PACKAGE_BY_PROTOCOL['chat-completions'],
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
export function modelSpecs(models, options) {
    if (models === null)
        return [];
    return models.map((model) => modelSpec(model, options));
}
/**
 * The single provider OpenCode registers. Base URL and transport are set
 * here; the device key travels on each model's Authorization header so an
 * existing user-owned `moris` provider keeps every other setting.
 */
export function providerInfo(options) {
    return {
        id: 'moris',
        name: 'Moris LLM Gateway',
        activation: 'enabled',
        package: PACKAGE_BY_PROTOCOL['chat-completions'],
        settings: {
            baseURL: options.apiBase,
            // The gateway streams over HTTP only; this is the documented V2 switch.
            transport: 'http',
            headerTimeout: options.headerTimeoutMs,
            chunkTimeout: options.chunkTimeoutMs,
            timeout: options.requestTimeoutMs,
        },
    };
}
