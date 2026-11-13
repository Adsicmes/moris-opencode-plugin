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
export const PROVIDER_ID = 'moris';
