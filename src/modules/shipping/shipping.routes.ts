import express, { Router } from "express";
import { logger } from "../../config/logger.js";
import { getShippingProvider } from "./shipping.provider.js";
import { syncShipmentStatus } from "./shipping.service.js";

export const shippingRouter = Router();

/**
 * Shiprocket order-status webhook. Unlike Razorpay's HMAC signature, Shiprocket
 * authenticates webhooks with a static token you set on the webhook itself
 * (checked against `x-api-key` in `ShiprocketProvider.verifyWebhook`) — plain
 * JSON body parsing is fine here.
 */
shippingRouter.post("/webhooks/shiprocket", express.json(), async (req, res) => {
  const result = getShippingProvider().verifyWebhook(req);
  if (!result.ok) {
    logger.warn({ reason: result.reason }, "Rejected shipping webhook");
    return res.status(400).json({ error: result.reason });
  }

  await syncShipmentStatus(result.awbCode, result.rawStatus, result.delivered);
  res.json({ received: true });
});
