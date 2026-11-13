import { Provider, type Model } from '@opencode/plugin';
import type { Context } from '@opencode/plugin/promise/plugin';
import type { ProviderEditor } from '@opencode/plugin/promise/provider';
import { decodeCache, encodeCache, CACHE_KEY } from './cache.js';
import { isSupplierFresh } from './catalog.js';
import { readConfig, type MorisPluginConfig } from './config.js';
import { PROVIDER_ID, type CatalogResponse } from './contracts.js';
import { fetchCatalog } from './gateway.js';
import { modelSpecs, providerInfo, type OpenCodeModelSpec } from './provider.js';
import { RETRY_HOOK, RETRY_HOOK_OPTIONS, vetoRetry } from './retry.js';

interface PluginState {
  catalog: CatalogResponse | null;
  lastError: string | null;
  running: boolean;
}

function specsFor(state: PluginState, config: MorisPluginConfig): OpenCodeModelSpec[] {
  return modelSpecs(state.catalog?.models ?? null, {
    apiBase: config.apiBase,
    apiKey: config.apiKey,
    catalogTtlMs: config.catalogTtlMs,
    now: Date.now(),
    headerTimeoutMs: config.headerTimeoutMs,
    chunkTimeoutMs: config.chunkTimeoutMs,
    requestTimeoutMs: config.requestTimeoutMs,
  });
}

function readableCount(state: PluginState, config: MorisPluginConfig): string {
  const specs = specsFor(state, config);
  const enabled = specs.filter((spec) => spec.enabled).length;
  return `${enabled}/${specs.length} models selectable`;
}

async function readStoredCache(ctx: Context): Promise<unknown> {
  try {
    return await ctx.storage.get(CACHE_KEY);
  } catch (error) {
    console.warn(`[${PROVIDER_ID}] could not read the local catalog cache: ${String(error)}`);
    return undefined;
  }
}

async function storeCache(ctx: Context, catalog: CatalogResponse): Promise<void> {
  try {
    const value = encodeCache(catalog, new Date().toISOString());
    await ctx.storage.set(CACHE_KEY, value as unknown as Parameters<Context['storage']['set']>[1]);
  } catch (error) {
    console.warn(`[${PROVIDER_ID}] could not write the local catalog cache: ${String(error)}`);
  }
}

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
export async function install(ctx: Context): Promise<() => Promise<void>> {
  const parsed = readConfig(ctx.options, process.env);
  if (!parsed.ok) {
    // No provider is registered without an endpoint: a half-configured
    // provider would only produce confusing model failures.
    console.error(`[${PROVIDER_ID}] ${parsed.error}; the gateway provider is not registered`);
    return async () => {};
  }
  const config = parsed.value;
  if (config.apiKey === null) {
    console.error(
      `[${PROVIDER_ID}] no device key: set the plugin option "apiKey" or MORIS_GATEWAY_KEY. ` +
        'The provider still appears, but requests cannot be authorized.',
    );
  }

  const state: PluginState = { catalog: null, lastError: null, running: false };
  const cached = decodeCache(await readStoredCache(ctx));
  if (cached !== null) state.catalog = cached.catalog;

  const providerID = Provider.ID.make(PROVIDER_ID);
  let timer: ReturnType<typeof setInterval> | null = null;
  let inflight: AbortController | null = null;
  let disposed = false;

  const info = providerInfo(config);
  const transform = await ctx.provider.transform((editor: ProviderEditor) => {
    const specs = specsFor(state, config);
    const existing = editor.get(PROVIDER_ID);
    if (existing === undefined) {
      const base = Provider.Info.empty(providerID);
      editor.add({
        info: {
          ...base,
          name: info.name,
          activation: 'enabled',
          package: info.package,
          settings: info.settings,
        },
        // The spec mirrors Model.Info (verified against @opencode/plugin
        // 2.2.7); branded ids are created by OpenCode's registry.
        models: specs as unknown as Model.Info[],
      });
      return;
    }

    // A `moris` provider is this gateway's namespace: its settings are
    // reconciled with the plugin configuration and its model inventory is
    // replaced by the complete gateway catalog. Models removed upstream
    // therefore disappear; a user who wants extra models uses another
    // provider. Every other provider is untouched.
    editor.update(PROVIDER_ID, (provider) => {
      provider.settings = { ...provider.settings, ...info.settings };
    });
    editor.models.set(PROVIDER_ID, specs as unknown as Model.Info[]);
  });

  // One retry hook, scoped to this provider. OpenCode's retry event has no
  // `kind`; the provider scope covers primary, title, compaction and
  // generate requests, and no other provider can be affected.
  const retryHook = await ctx.session.hook(
    RETRY_HOOK,
    (event) => {
      vetoRetry(event);
    },
    RETRY_HOOK_OPTIONS,
  );

  async function refresh(reload: boolean): Promise<void> {
    if (config.apiKey === null || state.running || disposed) return;
    state.running = true;
    const controller = new AbortController();
    inflight = controller;
    try {
      const result = await fetchCatalog({
        rootUrl: config.rootUrl,
        apiKey: config.apiKey,
        timeoutMs: config.fetchTimeoutMs,
        signal: controller.signal,
      });
      // A plugin unload aborts the request; never write state or the cache
      // after that point.
      if (disposed) return;
      if (result.ok) {
        state.catalog = result.catalog;
        state.lastError = null;
        await storeCache(ctx, result.catalog);
        console.info(`[${PROVIDER_ID}] catalog synced: ${readableCount(state, config)}`);
      } else if (!controller.signal.aborted) {
        state.lastError = result.error;
        // Keep the last successful catalog. Entries whose supplier sync is
        // older than the TTL are still disabled when the transform replays.
        console.warn(`[${PROVIDER_ID}] catalog refresh failed, keeping the last snapshot: ${result.error}`);
      }
    } catch (error) {
      // fetchCatalog reports failures as values; this is a last-resort guard
      // so a background refresh can never reject unhandled.
      if (!disposed) console.warn(`[${PROVIDER_ID}] catalog refresh threw: ${String(error)}`);
    } finally {
      state.running = false;
      inflight = null;
    }
    if (reload && !disposed) {
      try {
        await ctx.provider.reload();
      } catch (error) {
        console.warn(`[${PROVIDER_ID}] could not replay the refreshed catalog: ${String(error)}`);
      }
    }
  }

  // The transform is registered before the first network read, so the
  // initial catalog is always replayed through `provider.reload()` once the
  // data (or the failure) is known. No-cache startup waits for that read;
  // a cached startup replays immediately and refreshes in the background.
  if (config.apiKey !== null) {
    if (cached === null) {
      await refresh(true);
    } else {
      void refresh(true);
    }
    timer = setInterval(() => {
      void refresh(true);
    }, config.refreshMs);
    // Do not hold the OpenCode process open.
    timer.unref?.();
  }

  if (state.catalog !== null) {
    const stale = state.catalog.models.every(
      (model) => !isSupplierFresh(model, Date.now(), config.catalogTtlMs),
    );
    if (stale) {
      console.warn(
        `[${PROVIDER_ID}] every cached model is older than the supplier TTL; ` +
          'they stay visible but cannot be selected until the gateway syncs again',
      );
    }
  }
  if (state.lastError !== null) {
    console.warn(`[${PROVIDER_ID}] initial catalog read failed: ${state.lastError}`);
  }

  return async () => {
    disposed = true;
    if (timer !== null) clearInterval(timer);
    inflight?.abort();
    await retryHook.dispose();
    await transform.dispose();
  };
}
