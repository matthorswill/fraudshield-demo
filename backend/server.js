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

server.listen(4000, () => console.log("Backend on http://localhost:4000"));
