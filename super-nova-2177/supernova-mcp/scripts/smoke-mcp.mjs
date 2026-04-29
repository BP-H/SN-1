#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const EXPECTED_TOOLS = [
  "search_proposals",
  "get_proposal",
  "get_proposal_comments",
  "get_proposal_vote_summary",
  "get_profile",
  "get_supernova_connector_spec",
];

function usage() {
  return "Usage: node scripts/smoke-mcp.mjs https://YOUR-MCP-DEPLOYMENT.vercel.app";
}

function normalizeDeploymentBase(rawUrl) {
  if (!rawUrl) {
    throw new Error(usage());
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL. ${usage()}`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Deployment URL must use http or https.");
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/mcp\/?$/, "").replace(/\/+$/, "");
  return url.toString().replace(/\/+$/, "");
}

async function readJson(response, label) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned a non-JSON response.`);
  }
}

async function checkHealth(baseUrl) {
  const healthUrl = `${baseUrl}/health`;
  const response = await fetch(healthUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "supernova-mcp-smoke/0.1",
    },
    redirect: "follow",
  });

  const payload = await readJson(response, "GET /health");
  if (!response.ok) {
    throw new Error(`GET /health failed with HTTP ${response.status}.`);
  }

  if (payload?.ok !== true) {
    throw new Error("GET /health did not return ok:true.");
  }

  console.log("PASS health: /health returned ok:true");
}

async function checkTools(baseUrl) {
  const mcpUrl = new URL(`${baseUrl}/mcp`);
  const client = new Client({
    name: "supernova-mcp-smoke",
    version: "0.1.0",
  });

  const transport = new StreamableHTTPClientTransport(mcpUrl, {
    requestInit: {
      headers: {
        "User-Agent": "supernova-mcp-smoke/0.1",
      },
    },
  });

  try {
    await client.connect(transport);
    const response = await client.listTools();
    const toolNames = new Set((response.tools || []).map((tool) => tool.name));
    const missing = EXPECTED_TOOLS.filter((toolName) => !toolNames.has(toolName));

    if (missing.length > 0) {
      throw new Error(`MCP tools/list is missing expected tools: ${missing.join(", ")}`);
    }

    console.log(`PASS tools/list: ${EXPECTED_TOOLS.join(", ")}`);
  } finally {
    await client.close().catch(() => {});
  }
}

async function main() {
  const baseUrl = normalizeDeploymentBase(process.argv[2]);
  await checkHealth(baseUrl);
  await checkTools(baseUrl);
  console.log(`PASS SuperNova MCP smoke: ${baseUrl}/mcp`);
}

main().catch((error) => {
  console.error(`FAIL SuperNova MCP smoke: ${error.message}`);
  process.exitCode = 1;
});
