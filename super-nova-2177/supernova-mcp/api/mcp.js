import { handleMcpRequest } from "../src/mcpServer.js";

export default async function handler(req, res) {
  return handleMcpRequest(req, res);
}
