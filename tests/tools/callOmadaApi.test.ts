import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerCallOmadaApiTool } from '../../src/tools/callOmadaApi.js';

describe('callOmadaApi', () => {
    it('registers a write tool and passes the operation through the authenticated client', async () => {
        const registerTool = vi.fn();
        const callDocumentedApi = vi.fn().mockResolvedValue({ updated: true });
        registerCallOmadaApiTool({ registerTool } as unknown as McpServer, { callDocumentedApi } as unknown as OmadaClient);
        const [name, config, handler] = registerTool.mock.calls[0];
        expect(name).toBe('callOmadaApi');
        expect(config.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
        const args = { operation: 'PUT /documented', pathParams: {}, query: { enabled: true }, data: { name: 'Test' } };
        expect(await handler(args, {})).toEqual({ content: [{ type: 'text', text: JSON.stringify({ updated: true }, null, 2) }] });
        expect(callDocumentedApi).toHaveBeenCalledWith(args.operation, {}, args.query, args.data, undefined);
        callDocumentedApi.mockRejectedValueOnce(new Error('Controller denied access'));
        await expect(handler(args, {})).rejects.toThrow('Controller denied access');
    });
});
