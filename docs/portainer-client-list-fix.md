# Run the client-list v2 fix in Portainer

The `hotfix/client-list-api-v2` branch uses `POST /openapi/v2/{omadacId}/sites/{siteId}/clients` with JSON pagination. The upstream image will not include this fork's fix until its maintainer releases it.

## Publish and pull from GitHub Container Registry

Enable GitHub Actions on the fork, then run **Publish Docker Images** with branch **hotfix/client-list-api-v2**. Pushes to that branch also trigger publishing. The workflow builds both `linux/amd64` and `linux/arm64`, uses GitHub's automatic `GITHUB_TOKEN` with `packages: write`, and publishes:

```text
ghcr.io/noahkoole/tplink-omada-mcp:clients-v2
```

No personal access token or local Docker login is required for this build. Docker Hub publishing is skipped on forks. The published image's source label points to the fork that built it.

After the publishing job succeeds, set the image in the Portainer stack to:

```yaml
image: ghcr.io/noahkoole/tplink-omada-mcp:clients-v2
```

If the package is private, add `ghcr.io` to Portainer's registries with credentials that have `read:packages`. Public packages can be pulled without authentication. Package visibility is managed separately from repository visibility. Keep the existing environment variables, ports, and networks, then update the stack and reconnect the MCP client.

## Build locally instead

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


## Enable general write access

The `feature/full-openapi-writes` branch publishes `ghcr.io/noahkoole/tplink-omada-mcp:full-access` for AMD64 and ARM64. The package uses the existing registry visibility and authentication settings.

```yaml
image: ghcr.io/noahkoole/tplink-omada-mcp:full-access
environment:
  OMADA_TOOL_CATEGORIES: "all:rw"
```

Merge the image and environment changes into the existing service rather than replacing its other environment values. Update the stack with image pulling enabled, then reconnect the MCP client so it refreshes its tool list. The app created in Omada Platform Integration must have a role and site privileges that permit the intended writes. Give it access to all sites only if all-site management is intended.

`getOmadaApiOperations` searches the bundled write-operation references and exposes input schemas. `callOmadaApi` executes one selected operation using the configured credentials. This covers JSON requests and multipart uploads via a `files` map containing base64 data. Actual support depends on controller version, device support, and the API app's permissions. Authorization-code-only operations remain unavailable to this client-credentials server. Controller settings not exposed by OpenAPI cannot be changed through this tool.

Read-only configurations still omit `callOmadaApi`. No live network writes were used to test this capability.
