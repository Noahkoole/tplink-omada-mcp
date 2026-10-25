import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { OmadaClient } from '../omadaClient/index.js';
import { toToolResult, wrapToolHandler } from '../server/common.js';

export function registerCallOmadaApiTool(server: McpServer, client: OmadaClient): void {
    server.registerTool(
        'callOmadaApi',
        {
            description:
                'Execute a documented Omada OpenAPI operation, including configuration changes, creation, deletion, device actions and controller administration. First use getOmadaApiOperations to retrieve the exact operation and input schema; do not guess routes or payloads. Omada application roles and controller version determine access. This tool can disrupt connectivity or delete configuration. Read current settings before modifying them. Controller ID is injected automatically; siteId defaults to the configured site.',
            inputSchema: {
                operation: z.string().min(1).describe('Exact METHOD /openapi/... template returned by getOmadaApiOperations.'),
                pathParams: z.record(z.string(), z.string()).default({}),
                query: z.record(z.string(), z.unknown()).optional(),
                data: z.unknown().optional().describe('JSON request body, or form fields for a multipart operation, matching the documented schema.'),
                files: z
                    .record(
                        z.string(),
                        z.object({
                            filename: z.string().min(1),
                            base64: z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
                            contentType: z.string().default('application/octet-stream'),
                        })
                    )
                    .optional()
                    .describe('Multipart file fields, with base64 file contents. Only for documented multipart operations.'),
            },
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
        },
        wrapToolHandler('callOmadaApi', async ({ operation, pathParams, query, data, files }) =>
            toToolResult(await client.callDocumentedApi(operation, pathParams, query, data, files))
        )
    );
}
