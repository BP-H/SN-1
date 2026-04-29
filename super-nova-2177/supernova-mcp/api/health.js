export default function handler(_req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      name: "supernova-mcp",
      mode: "public_read_only",
      endpoint: "/mcp",
    })
  );
}
