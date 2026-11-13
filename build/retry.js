import { PROVIDER_ID } from './contracts.js';
export const RETRY_HOOK = 'retry';
/** Provider-scoped so OpenCode never applies this hook to another provider. */
export const RETRY_HOOK_OPTIONS = { providerID: PROVIDER_ID };
/**
 * The gateway owns upstream retries (`maxAttempts` on the server). OpenCode
 * must not replay a gateway request: a replay would duplicate a streamed
 * completion and charge it twice.
 *
 * OpenCode's retry hook carries no `kind`; it fires for the provider's
 * primary, title, compaction and generate requests alike, and every one of
 * them carries the model. The provider scope plus this guard therefore cover
 * all four request kinds while leaving every other provider untouched.
 */
export function vetoRetry(event) {
    if (event.model.providerID !== PROVIDER_ID)
        return false;
    event.decision = { retry: false };
    return true;
}
