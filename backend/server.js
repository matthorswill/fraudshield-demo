const http = require("http");
const alerts = require("../data/alerts.json");

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  // CORS for debugging
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  if (pathname === "/api/alerts") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(alerts));
  }

  const m = pathname.match(/^\/api\/alerts\/(\d+)\/?$/);
  if (m) {
    const id = Number(m[1]);
    const alert = alerts.find(a => Number(a.id) === id);
    if (!alert) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Not found", id }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(alert));
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found", path: pathname }));
});

// Use Render’s port and bind to 0.0.0.0
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});
