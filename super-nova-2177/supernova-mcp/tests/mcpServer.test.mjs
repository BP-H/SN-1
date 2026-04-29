import test from "node:test";
import assert from "node:assert/strict";

import { clampLimit, createSuperNovaMcpServer, getApiBaseUrl, normalizeOffset } from "../src/mcpServer.js";

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
