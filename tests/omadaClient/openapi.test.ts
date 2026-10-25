import { describe, expect, it } from 'vitest';
import { getOmadaApiOperations, prepareOmadaApiRequest } from '../../src/omadaClient/openapi.js';

const operation = 'PUT /openapi/v1/{omadacId}/users/{userID}';
const defaults = { omadacId: 'controller-id', siteId: 'default-site' };

describe('documented OpenAPI operations', () => {
    it('loads documented writes from per-tag specifications and paginates summaries', () => {
        const first = getOmadaApiOperations('', 1, 1) as { totalRows: number; data: unknown[] };
        const second = getOmadaApiOperations('', 2, 1) as { data: unknown[] };
        expect(first.totalRows).toBeGreaterThan(900);
        expect(first.data).toHaveLength(1);
        expect(second.data).not.toEqual(first.data);
    });
    it('searches operation summaries, IDs and paths', () => {
        const result = getOmadaApiOperations('users modifyUser') as { data: { operation: string }[] };
        expect(result.data.some((entry) => entry.operation === operation)).toBe(true);
        expect(getOmadaApiOperations('no-such-operation')).toMatchObject({ totalRows: 0, data: [] });
    });
    it('returns request schemas and referenced component definitions', () => {
        const detail = getOmadaApiOperations('', 1, 25, operation) as { schemas: Record<string, unknown> };
        expect(detail).toMatchObject({ operation, operationId: 'modifyUser', requestBody: expect.any(Object) });
        expect(Object.keys(detail.schemas).length).toBeGreaterThan(0);
    });
    it('returns a bodyless operation with no referenced schemas', () => {
        expect(getOmadaApiOperations('', 1, 25, 'DELETE /openapi/v1/{omadacId}/users/{userID}')).toMatchObject({ parameters: expect.any(Array) });
    });
    it('injects the configured controller ID and escapes segments', () => {
        expect(
            prepareOmadaApiRequest(operation, { userID: 'user:name', omadacId: 'other-controller' }, { flag: true }, { name: 'Test' }, defaults)
        ).toEqual({
            method: 'PUT',
            url: '/openapi/v1/controller-id/users/user%3Aname',
            params: { flag: true },
            data: { name: 'Test' },
            maxRedirects: 0,
        });
    });
    it('uses a default site or the explicitly selected site', () => {
        const op = 'PATCH /openapi/v1/{omadacId}/sites/{siteId}/clients/{clientMac}/ratelimit';
        expect(prepareOmadaApiRequest(op, { clientMac: 'AA-BB-CC-DD-EE-FF' }, undefined, {}, defaults).url).toContain('/sites/default-site/');
        expect(prepareOmadaApiRequest(op, { siteId: 'explicit', clientMac: 'AA-BB-CC-DD-EE-FF' }, undefined, {}, defaults).url).toContain(
            '/sites/explicit/'
        );
    });
    it('reports missing path parameters', () => {
        expect(() => prepareOmadaApiRequest(operation, {}, undefined, {}, defaults)).toThrow('Missing path parameter: userID');
    });
    it.each(['GET /openapi/v1/{omadacId}/users', 'POST https://example.com', 'DELETE /unknown'])('rejects undocumented operations: %s', (op) => {
        expect(() => prepareOmadaApiRequest(op, {}, undefined, undefined, defaults)).toThrow('Unknown operation');
    });
    it.each(['..', '.', '../users', '%2e%2e', 'a/b', 'a\\b', 'a?b', 'a#b'])('rejects path traversal and encoded separators: %s', (userID) => {
        expect(() => prepareOmadaApiRequest(operation, { userID }, undefined, {}, defaults)).toThrow('Invalid API path parameter');
    });
});

it('supports multipart file uploads and structured form fields', async () => {
    const operation = 'POST /openapi/v1/{omadacId}/sites/{siteId}/profiles/ldap/google';
    const config = prepareOmadaApiRequest(operation, {}, undefined, { config: { name: 'LDAP' }, enabled: true }, defaults, {
        file: { filename: 'certificate.pem', base64: Buffer.from('test certificate').toString('base64'), contentType: 'application/x-pem-file' },
    });
    expect(config.headers).toEqual({ 'Content-Type': 'multipart/form-data' });
    const form = config.data as FormData;
    expect(form.get('config')).toBe('{"name":"LDAP"}');
    expect(form.get('enabled')).toBe('true');
    expect(await (form.get('file') as File).text()).toBe('test certificate');
});
it('allows empty multipart bodies for the controller to validate and rejects files on JSON routes', () => {
    const operation = 'POST /openapi/v1/{omadacId}/sites/{siteId}/portal/pics';
    expect(prepareOmadaApiRequest(operation, {}, undefined, undefined, defaults).data).toBeInstanceOf(FormData);
    expect(() =>
        prepareOmadaApiRequest('PUT /openapi/v1/{omadacId}/users/{userID}', { userID: 'user' }, undefined, {}, defaults, {
            file: { filename: 'file', base64: '', contentType: 'text/plain' },
        })
    ).toThrow('Files are only supported');
});
