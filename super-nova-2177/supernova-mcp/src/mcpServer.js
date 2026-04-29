import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const DEFAULT_SUPERNOVA_API_BASE_URL = "https://2177.tech";
const MAX_LIMIT = 100;

export function getApiBaseUrl() {
  const configured = String(process.env.SUPERNOVA_API_BASE_URL || DEFAULT_SUPERNOVA_API_BASE_URL).trim();
  return (configured || DEFAULT_SUPERNOVA_API_BASE_URL).replace(/\/+$/, "");
}

export function clampLimit(value, fallback = 25) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, MAX_LIMIT));
}

export function normalizeOffset(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, parsed);
}

function compactJsonResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data),
      },
    ],
  };
}

function upstreamErrorResult(error) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({
          ok: false,
          error: error.message || "SuperNova upstream request failed",
        }),
      },
    ],
  };
}

async function fetchPublicConnectorJson(path, params = {}) {
  const url = new URL(`${getApiBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "supernova-mcp-public-readonly/0.1",
      },
      redirect: "follow",
    });
  } catch {
    throw new Error("SuperNova upstream is unavailable");
  }

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("SuperNova upstream returned a non-JSON response");
    }
  }

  if (!response.ok) {
    const detail = payload?.detail || payload?.error || `SuperNova upstream returned HTTP ${response.status}`;
    throw new Error(String(detail));
  }

  return payload;
}

export function createSuperNovaMcpServer() {
  const server = new McpServer({
    name: "SuperNova",
    version: "0.1.0",
  });

  server.tool(
    "search_proposals",
    "Search public SuperNova proposals/posts through the read-only connector facade.",
    {
      search: z.string().optional(),
      limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ search, limit, offset }) => {
      try {
        const data = await fetchPublicConnectorJson("/connector/proposals", {
          search,
          limit: clampLimit(limit),
          offset: normalizeOffset(offset),
        });
        return compactJsonResult(data);
      } catch (error) {
        return upstreamErrorResult(error);
      }
    }
  );

  server.tool(
    "get_proposal",
    "Read one public SuperNova proposal/post by id.",
    {
      id: z.number().int().min(1),
    },
    async ({ id }) => {
      try {
        const data = await fetchPublicConnectorJson(`/connector/proposals/${id}`);
        return compactJsonResult(data);
      } catch (error) {
        return upstreamErrorResult(error);
      }
    }
  );

  server.tool(
    "get_proposal_comments",
    "Read public comments for one SuperNova proposal/post.",
    {
      id: z.number().int().min(1),
      limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ id, limit, offset }) => {
      try {
        const data = await fetchPublicConnectorJson(`/connector/proposals/${id}/comments`, {
          limit: clampLimit(limit),
          offset: normalizeOffset(offset),
        });
        return compactJsonResult(data);
      } catch (error) {
        return upstreamErrorResult(error);
      }
    }
  );

  server.tool(
    "get_proposal_vote_summary",
    "Read the public aggregate vote/support summary for one SuperNova proposal/post. This tool is read-only and cannot vote.",
    {
      id: z.number().int().min(1),
    },
    async ({ id }) => {
      try {
        const data = await fetchPublicConnectorJson(`/connector/proposals/${id}/votes`);
        return compactJsonResult(data);
      } catch (error) {
        return upstreamErrorResult(error);
      }
    }
  );

  server.tool(
    "get_profile",
    "Read one public SuperNova profile by username.",
    {
      username: z.string().min(1).max(80),
    },
    async ({ username }) => {
      try {
        const safeUsername = encodeURIComponent(username.trim());
        const data = await fetchPublicConnectorJson(`/connector/profiles/${safeUsername}`);
        return compactJsonResult(data);
      } catch (error) {
        return upstreamErrorResult(error);
      }
    }
  );

  server.tool(
    "get_supernova_connector_spec",
    "Read the public SuperNova connector metadata/spec document.",
    {},
    async () => {
      try {
        const data = await fetchPublicConnectorJson("/connector/supernova/spec");
        return compactJsonResult(data);
      } catch (error) {
        return upstreamErrorResult(error);
      }
    }
  );

  return server;
}

export async function handleMcpRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, MCP-Protocol-Version");
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        ok: false,
        error: "SuperNova MCP endpoint expects POST requests.",
      })
    );
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createSuperNovaMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
