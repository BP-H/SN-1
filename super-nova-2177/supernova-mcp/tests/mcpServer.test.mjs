import test from "node:test";
import assert from "node:assert/strict";

import {
  checkUpstreamConnector,
  clampLimit,
  createSuperNovaMcpServer,
  getApiBaseUrl,
  getUpstreamBaseOrigin,
  normalizeOffset,
} from "../src/mcpServer.js";

test("default API base URL is the public SuperNova origin", () => {
  const previous = process.env.SUPERNOVA_API_BASE_URL;
  delete process.env.SUPERNOVA_API_BASE_URL;
  try {
    assert.equal(getApiBaseUrl(), "https://2177.tech");
  } finally {
    if (previous === undefined) delete process.env.SUPERNOVA_API_BASE_URL;
    else process.env.SUPERNOVA_API_BASE_URL = previous;
  }
});

test("API base URL override is trimmed and normalized", () => {
  const previous = process.env.SUPERNOVA_API_BASE_URL;
  process.env.SUPERNOVA_API_BASE_URL = " https://example.test/// ";
  try {
    assert.equal(getApiBaseUrl(), "https://example.test");
  } finally {
    if (previous === undefined) delete process.env.SUPERNOVA_API_BASE_URL;
    else process.env.SUPERNOVA_API_BASE_URL = previous;
  }
});

test("upstream origin helper exposes only the public origin", () => {
  const previous = process.env.SUPERNOVA_API_BASE_URL;
  process.env.SUPERNOVA_API_BASE_URL = " https://backend.example.test/api/// ";
  try {
    assert.equal(getUpstreamBaseOrigin(), "https://backend.example.test");
  } finally {
    if (previous === undefined) delete process.env.SUPERNOVA_API_BASE_URL;
    else process.env.SUPERNOVA_API_BASE_URL = previous;
  }
});

test("upstream connector check handles invalid origin without throwing", async () => {
  const previous = process.env.SUPERNOVA_API_BASE_URL;
  process.env.SUPERNOVA_API_BASE_URL = "not a url";
  try {
    const result = await checkUpstreamConnector();
    assert.equal(result.path, "/connector/supernova");
    assert.equal(result.json, false);
    assert.equal(result.reachable, false);
    assert.equal(result.error, "invalid_upstream_origin");
  } finally {
    if (previous === undefined) delete process.env.SUPERNOVA_API_BASE_URL;
    else process.env.SUPERNOVA_API_BASE_URL = previous;
  }
});

test("limit and offset helpers stay bounded", () => {
  assert.equal(clampLimit(undefined), 25);
  assert.equal(clampLimit(0), 1);
  assert.equal(clampLimit(500), 100);
  assert.equal(clampLimit("8"), 8);
  assert.equal(normalizeOffset(undefined), 0);
  assert.equal(normalizeOffset(-5), 0);
  assert.equal(normalizeOffset("12"), 12);
});

test("MCP server can be constructed with read-only tools", () => {
  const server = createSuperNovaMcpServer();
  assert.ok(server);
});
