import { checkUpstreamConnector, getUpstreamBaseOrigin } from "../src/mcpServer.js";

export default async function handler(_req, res) {
  const upstreamCheck = await checkUpstreamConnector();

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      name: "supernova-mcp",
      mode: "public_read_only",
      endpoint: "/mcp",
      upstream_base_origin: getUpstreamBaseOrigin(),
      upstream_connector_check: upstreamCheck,
    })
  );
}
