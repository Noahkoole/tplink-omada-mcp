import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerGetOmadaApiOperationsTool } from '../../src/tools/getOmadaApiOperations.js';

describe('getOmadaApiOperations', () => {
    it('discovers documented operations without accessing the live controller', async () => {
        const registerTool = vi.fn();
        registerGetOmadaApiOperationsTool({ registerTool } as unknown as McpServer, {} as OmadaClient);
        const [name, config, handler] = registerTool.mock.calls[0];
        expect(name).toBe('getOmadaApiOperations');
        expect(config.annotations.readOnlyHint).toBe(true);
        const result = await handler({ search: 'users', page: 1, pageSize: 2 });
        expect(JSON.parse(result.content[0].text).data).toHaveLength(2);
    });
});
