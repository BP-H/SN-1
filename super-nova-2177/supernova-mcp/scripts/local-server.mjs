import http from "node:http";
import healthHandler from "../api/health.js";
import mcpHandler from "../api/mcp.js";

const port = Number.parseInt(process.env.PORT || "3033", 10);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname === "/health") {
      return healthHandler(req, res);
    }
    if (url.pathname === "/mcp") {
      return mcpHandler(req, res);
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: error.message || "Unexpected server error" }));
  }
});

server.listen(port, () => {
  console.log(`SuperNova MCP dev server listening on http://127.0.0.1:${port}`);
  console.log(`MCP endpoint: http://127.0.0.1:${port}/mcp`);
});
