import type { CatalogResponse } from './contracts.js';
export interface FetchCatalogOptions {
    rootUrl: string;
    apiKey: string;
    timeoutMs: number;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
}
export type FetchCatalogResult = {
    ok: true;
    catalog: CatalogResponse;
} | {
    ok: false;
    error: string;
};
export declare function fetchCatalog(options: FetchCatalogOptions): Promise<FetchCatalogResult>;
