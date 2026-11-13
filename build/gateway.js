import { normalizeCatalog } from './catalog.js';
function messageOf(error) {
    if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError')
            return 'gateway catalog request timed out';
        return error.message;
    }
    return String(error);
}
/** Never echo a response body: it can hold upstream details or credentials. */
function statusError(status) {
    if (status === 401 || status === 403)
        return `gateway rejected the device key (HTTP ${status})`;
    if (status === 404)
        return 'gateway catalog endpoint not found (HTTP 404)';
    return `gateway catalog request failed (HTTP ${status})`;
}
export async function fetchCatalog(options) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });
    try {
        const response = await fetchImpl(`${options.rootUrl}/api/catalog`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${options.apiKey}`,
            },
            signal: controller.signal,
        });
        if (!response.ok)
            return { ok: false, error: statusError(response.status) };
        let body;
        try {
            body = await response.json();
        }
        catch {
            return { ok: false, error: 'gateway catalog response is not valid JSON' };
        }
        const catalog = normalizeCatalog(body);
        if (catalog === null)
            return { ok: false, error: 'gateway catalog response does not match the moris contract' };
        return { ok: true, catalog };
    }
    catch (error) {
        return { ok: false, error: `gateway catalog request failed: ${messageOf(error)}` };
    }
    finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', onAbort);
    }
}
