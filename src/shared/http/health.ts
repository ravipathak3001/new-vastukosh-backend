import { Router } from "express";
import { dbHealthy } from "../../db/connection.js";

export const healthRouter = Router();

healthRouter.get("/healthz", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

healthRouter.get("/readyz", (_req, res) => {
  const db = dbHealthy();
  res.status(db ? 200 : 503).json({ status: db ? "ready" : "degraded", db });
});
