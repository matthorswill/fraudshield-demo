const http = require("http");
const alerts = require("../data/alerts.json");

const server = http.createServer((req, res) => {
  if (req.url === "/api/alerts") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(alerts));
  }

  const match = req.url.match(/^\/api\/alerts\/(\d+)$/);
  if (match) {
    const id = Number(match[1]);
    const alert = alerts.find(a => Number(a.id) === id);
    if (!alert) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Not found" }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(alert));
  }

  // health
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});

// ✅ Use Render's PORT if provided, otherwise 4000 locally
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
// ✅ Bind to 0.0.0.0 for Render
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});
