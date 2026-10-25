import { readdirSync, readFileSync } from 'node:fs';
import type { AxiosRequestConfig } from 'axios';
import { encodeApiPathParameter } from '../utils/config-validations.js';

type JsonObject = Record<string, unknown>;
export interface ApiFile {
    filename: string;
    base64: string;
    contentType: string;
}
interface ApiDocument {
    paths?: Record<string, Record<string, JsonObject>>;
    components?: { schemas?: JsonObject };
}
interface Operation {
    operation: string;
    method: string;
    path: string;
    operationId?: unknown;
    summary?: unknown;
    tags?: unknown;
    definition: JsonObject;
    document: ApiDocument;
}
let cached: Map<string, Operation> | undefined;

function catalog(): Map<string, Operation> {
    if (cached) return cached;
    const operations = new Map<string, Operation>();
    const directory = new URL('../../docs/openapi/', import.meta.url);
    for (const file of readdirSync(directory).sort()) {
        if (!/^\d+-/.test(file) || file === '00-all.json' || !file.endsWith('.json')) continue;
        const document = JSON.parse(readFileSync(new URL(file, directory), 'utf8')) as ApiDocument;
        for (const [path, methods] of Object.entries(document.paths ?? {})) {
            for (const [method, definition] of Object.entries(methods)) {
                if (!['post', 'put', 'patch', 'delete'].includes(method)) continue;
                const operation = `${method.toUpperCase()} ${path}`;
                operations.set(operation, {
                    operation,
                    method: method.toUpperCase(),
                    path,
                    operationId: definition.operationId,
                    summary: definition.summary,
                    tags: definition.tags,
                    definition,
                    document,
                });
            }
        }
    }
    cached = operations;
    return operations;
}

function findOperation(operation: string): Operation {
    const entry = catalog().get(operation);
    if (!entry) throw new Error('Unknown operation. Use getOmadaApiOperations to select a documented operation.');
    return entry;
}

export function getOmadaApiOperations(search = '', page = 1, pageSize = 25, operation?: string): unknown {
    if (operation) {
        const entry = findOperation(operation);
        const parameters = entry.definition.parameters ?? [];
        const requestBody = entry.definition.requestBody;
        const schemas: JsonObject = {};
        const visit = (value: unknown): void => {
            if (!value || typeof value !== 'object') return;
            const ref = (value as JsonObject).$ref;
            if (typeof ref === 'string' && ref.startsWith('#/components/schemas/')) {
                const name = ref.slice('#/components/schemas/'.length);
                if (!(name in schemas)) {
                    schemas[name] = entry.document.components?.schemas?.[name] ?? {};
                    visit(schemas[name]);
                }
            }
            for (const child of Object.values(value)) visit(child);
        };
        visit({ parameters, requestBody });
        return {
            operation: entry.operation,
            operationId: entry.operationId,
            summary: entry.summary,
            description: entry.definition.description,
            parameters,
            requestBody,
            schemas,
        };
    }
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    const entries = [...catalog().values()].filter((entry) =>
        terms.every((term) => `${entry.operation} ${entry.operationId} ${entry.summary} ${JSON.stringify(entry.tags)}`.toLowerCase().includes(term))
    );
    return {
        totalRows: entries.length,
        page,
        pageSize,
        data: entries
            .slice((page - 1) * pageSize, page * pageSize)
            .map(({ operation: name, operationId, summary, tags }) => ({ operation: name, operationId, summary, tags })),
    };
}

export function prepareOmadaApiRequest(
    operation: string,
    pathParams: Record<string, string>,
    query: JsonObject | undefined,
    data: unknown,
    defaults: { omadacId: string; siteId?: string },
    files: Record<string, ApiFile> = {}
): AxiosRequestConfig {
    const entry = findOperation(operation);
    const parameters: Record<string, string> = { ...pathParams, omadacId: defaults.omadacId };
    if (!parameters.siteId && defaults.siteId) parameters.siteId = defaults.siteId;
    const url = entry.path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
        const value = parameters[name];
        if (!value) throw new Error(`Missing path parameter: ${name}`);
        return encodeApiPathParameter(value);
    });
    const body = entry.definition.requestBody as { content?: Record<string, unknown> } | undefined;
    const multipart = body?.content?.['multipart/form-data'];
    if (multipart) {
        const form = new FormData();
        for (const [name, value] of Object.entries((data ?? {}) as JsonObject)) {
            form.append(name, typeof value === 'object' ? JSON.stringify(value) : String(value));
        }
        for (const [name, file] of Object.entries(files)) {
            form.append(name, new Blob([Buffer.from(file.base64, 'base64')], { type: file.contentType }), file.filename);
        }
        return { method: entry.method, url, params: query, data: form, headers: { 'Content-Type': 'multipart/form-data' }, maxRedirects: 0 };
    }
    if (Object.keys(files).length) throw new Error('Files are only supported for documented multipart operations.');
    return { method: entry.method, url, params: query, data, maxRedirects: 0 };
}
