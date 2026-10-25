import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { OmadaClient } from '../omadaClient/index.js';
import { getOmadaApiOperations } from '../omadaClient/openapi.js';
import { toToolResult } from '../server/common.js';
import { createPaginationSchema } from '../utils/pagination-schema.js';

export function registerGetOmadaApiOperationsTool(server: McpServer, _client: OmadaClient): void {
    server.registerTool(
        'getOmadaApiOperations',
        {
            description:
                'Discover documented Omada POST, PUT, PATCH and DELETE operations. Search by settings or resource name. Supply an exact operation from the results to retrieve its parameters, request body schema and referenced schemas before calling callOmadaApi. Availability depends on controller version and application permissions.',
            inputSchema: {
                search: z.string().optional(),
                ...createPaginationSchema(25),
                operation: z.string().optional(),
            },
            annotations: { readOnlyHint: true },
        },
        async ({ search, page, pageSize, operation }) => toToolResult(getOmadaApiOperations(search, page, pageSize, operation))
    );
}
