import { PROVIDER_ID, } from './contracts.js';
function record(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}
function string(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
function number(value) {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(n) ? n : null;
}
function boolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function protocol(value) {
    return value === 'chat-completions' || value === 'responses' || value === 'messages' ? value : 'unknown';
}
function billingType(value) {
    return value === 'subscription' ? 'subscription' : 'metered';
}
function priceKind(value) {
    return value === 'token' || value === 'request' || value === 'complex' || value === 'unknown' ? value : 'unknown';
}
function normalizePrice(value) {
    const raw = record(value);
    if (raw === null)
        return { kind: 'unknown', currency: 'USD' };
    const price = {
        kind: priceKind(raw.kind),
        currency: raw.currency === 'CNY' ? 'CNY' : 'USD',
    };
    const input = number(raw.input);
    const output = number(raw.output);
    const cacheRead = number(raw.cacheRead);
    const cacheWrite = number(raw.cacheWrite);
    const perRequest = number(raw.perRequest);
    if (input !== null)
        price.input = input;
    if (output !== null)
        price.output = output;
    if (cacheRead !== null)
        price.cacheRead = cacheRead;
    if (cacheWrite !== null)
        price.cacheWrite = cacheWrite;
    if (perRequest !== null)
        price.perRequest = perRequest;
    const expression = string(raw.expression);
    const source = string(raw.source);
    const version = string(raw.version);
    if (expression !== null)
        price.expression = expression;
    if (source !== null)
        price.source = source;
    if (version !== null)
        price.version = version;
    return price;
}
function normalizeCapabilities(value) {
    const raw = record(value);
    const inputRaw = Array.isArray(raw?.input) ? raw.input : [];
    const input = inputRaw.filter((entry) => entry === 'text' || entry === 'image');
    const capabilities = {
        tools: boolean(raw?.tools, false),
        input: input.length > 0 ? Array.from(new Set(input)) : ['text'],
        output: ['text'],
    };
    if (raw?.reasoning === true)
        capabilities.reasoning = true;
    return capabilities;
}
/**
 * Variant names are OpenCode selectors, so `#` and control characters cannot
 * be carried. Every value must be a plain object of request parameters.
 */
function normalizeVariants(value) {
    const raw = record(value);
    const variants = {};
    if (raw === null)
        return variants;
    for (const [name, params] of Object.entries(raw)) {
        const clean = name.trim();
        if (clean.length === 0 || clean.includes('#') || clean.length > 64)
            continue;
        const body = record(params);
        if (body === null)
            continue;
        variants[clean] = body;
        if (Object.keys(variants).length >= 64)
            break;
    }
    return variants;
}
function normalizeLimit(value) {
    const raw = record(value);
    const context = number(raw?.context);
    const output = number(raw?.output);
    const input = number(raw?.input);
    const limit = {
        context: context !== null && context > 0 ? Math.floor(context) : null,
        output: output !== null && output > 0 ? Math.floor(output) : null,
    };
    if (input !== null && input > 0)
        limit.input = Math.floor(input);
    return limit;
}
/** Business model id, without the `moris/` provider prefix OpenCode adds. */
export function businessModelId(value) {
    let id = value.trim();
    if (id.startsWith(`${PROVIDER_ID}/`))
        id = id.slice(PROVIDER_ID.length + 1);
    if (id.length === 0 || id.length > 256)
        return null;
    if (id.includes('#') || /[\u0000-\u001f\u007f]/.test(id) || /\s/.test(id))
        return null;
    return id;
}
function normalizeModel(value) {
    const raw = record(value);
    if (raw === null)
        return null;
    const idRaw = string(raw.id) ?? string(raw.path);
    if (idRaw === null)
        return null;
    const id = businessModelId(idRaw);
    if (id === null)
        return null;
    const pathRaw = string(raw.path) ?? id;
    const path = businessModelId(pathRaw) ?? id;
    const name = string(raw.name) ?? id;
    const namespace = string(raw.namespace) ?? 'moris';
    const family = string(raw.family) ?? namespace;
    const syncedAt = string(raw.syncedAt) ?? '';
    const model = {
        id,
        accountId: string(raw.accountId) ?? '',
        namespace,
        path,
        upstreamModel: string(raw.upstreamModel) ?? id,
        name,
        family,
        protocol: protocol(raw.protocol),
        capabilities: normalizeCapabilities(raw.capabilities),
        limit: normalizeLimit(raw.limit),
        variants: normalizeVariants(raw.variants),
        price: normalizePrice(raw.price),
        billingType: billingType(raw.billingType),
        enabled: boolean(raw.enabled, true),
        syncedAt,
    };
    const group = string(raw.group);
    const disabledReason = string(raw.disabledReason);
    if (group !== null)
        model.group = group;
    if (disabledReason !== null)
        model.disabledReason = disabledReason;
    const sources = record(raw.sources);
    if (sources !== null) {
        const clean = {};
        for (const [key, entry] of Object.entries(sources)) {
            if (typeof entry === 'string')
                clean[key] = entry;
        }
        if (Object.keys(clean).length > 0)
            model.sources = clean;
    }
    return model;
}
/**
 * Read `GET /api/catalog` defensively. Malformed models are dropped; the
 * provider id must match so a misconfigured URL cannot be mistaken for the
 * gateway.
 */
export function normalizeCatalog(value) {
    const raw = record(value);
    if (raw === null || raw.providerID !== PROVIDER_ID)
        return null;
    if (!Array.isArray(raw.models))
        return null;
    const models = [];
    const seen = new Set();
    for (const entry of raw.models) {
        const model = normalizeModel(entry);
        if (model === null || seen.has(model.id))
            continue;
        seen.add(model.id);
        models.push(model);
    }
    const accounts = [];
    if (Array.isArray(raw.accounts)) {
        for (const entry of raw.accounts) {
            const account = record(entry);
            const id = string(account?.id);
            if (account === null || id === null)
                continue;
            const lastSyncedAt = string(account.lastSyncedAt);
            const state = account.state;
            accounts.push({
                id,
                lastSyncedAt,
                state: state === 'ok' || state === 'unknown' || state === 'stale' || state === 'error' || state === 'unsupported'
                    ? state
                    : 'unknown',
                ...(string(account.error) !== null ? { error: string(account.error) } : {}),
            });
        }
    }
    return {
        providerID: PROVIDER_ID,
        fetchedAt: string(raw.fetchedAt) ?? new Date().toISOString(),
        models,
        accounts,
    };
}
export function syncedAtMs(model) {
    const ms = Date.parse(model.syncedAt);
    return Number.isFinite(ms) ? ms : null;
}
/**
 * Supplier freshness, not local cache age. A cache write never extends the
 * supplier's `syncedAt` window.
 */
export function isSupplierFresh(model, now, ttlMs) {
    const syncedAt = syncedAtMs(model);
    return syncedAt !== null && now - syncedAt < ttlMs;
}
