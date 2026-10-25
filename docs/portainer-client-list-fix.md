# Run the client-list v2 fix in Portainer

The `hotfix/client-list-api-v2` branch uses `POST /openapi/v2/{omadacId}/sites/{siteId}/clients` with JSON pagination. The upstream image will not include this fork's fix until its maintainer releases it.

Build the image on the Docker host managed by your Portainer endpoint (or on every eligible node if you use Swarm):

```sh
git clone --single-branch --branch hotfix/client-list-api-v2 https://github.com/Noahkoole/tplink-omada-mcp.git omada-mcp-fixed
cd omada-mcp-fixed
docker build --tag tplink-omada-mcp:clients-v2 .
```

In your existing Portainer stack, change the Omada MCP service's image to:

```yaml
image: tplink-omada-mcp:clients-v2
```

Keep the existing environment variables, ports, and networks. When updating the stack, leave **Re-pull image** disabled because the image was built locally. Then reconnect the MCP client and ask it to list clients.

The HTTP endpoint remains `/mcp`; the health endpoint remains `/healthz`. No new environment variables are required. Client listing requires the controller's OpenAPI v2 client-list endpoint. Other operations keep their existing API versions.

For a controller that only supports v1 client listing, use the upstream image instead. This patch does not automatically fall back to v1.

The fix was validated with synthetic HTTP responses, pagination, authentication retry, and the full repository test suite. A user-supplied successful v2 response established the controller request format; credentials and real network-client data are not included in the repository or tests.
