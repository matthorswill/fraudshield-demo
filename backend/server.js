const express = require("express");
const alerts = require("../data/alerts.json");

const app = express();

// CORS for debugging
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/", (req, res) => {
  res.send("OK");
});

// Return all alerts (support trailing slash)
app.get(["/api/alerts", "/api/alerts/"], (req, res) => {
  res.json(alerts);
});

// Return a single alert by ID
app.get("/api/alerts/:id", (req, res) => {
  const id = Number(req.params.id);
  const alert = alerts.find((a) => Number(a.id) === id);
  if (!alert) {
    return res.status(404).json({ error: "Not found", id });
  }
  res.json(alert);
});

// Fallback for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// Use Render's port and bind to 0.0.0.0
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});

