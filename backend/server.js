// backend/server.js (Express, robuste, compatible Render & local)
const express = require("express");
const app = express();
const alerts = require("../data/alerts.json");

// CORS simple (utile pour démo et debug)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Health check
app.get("/", (_req, res) => res.send("OK"));

// Liste des alertes
app.get("/api/alerts", (_req, res) => {
  res.json(alerts);
});

// Alerte par id
app.get("/api/alerts/:id", (req, res) => {
  const id = Number(req.params.id);
  const alert = alerts.find(a => Number(a.id) === id);
  if (!alert) return res.status(404).json({ error: "Not found" });
  res.json(alert);
});

// Port: Render fournit process.env.PORT, sinon 4000 en local
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend on http://0.0.0.0:${PORT}`);
});