import express, { Router } from "express";
import { logger } from "../../config/logger.js";
import { getPaymentProvider } from "./payment.provider.js";
import { markOrderPaid } from "../order/order.service.js";

export const paymentRouter = Router();

/**
 * Gateway webhook. Uses a raw body parser so the HMAC signature can be verified
 * against the exact bytes the gateway sent.
 */
paymentRouter.post(
  "/webhooks/razorpay",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = req.body as Buffer;
    try {
      req.body = JSON.parse((req.body as Buffer).toString("utf8"));
    } catch {
      return res.status(400).json({ error: "invalid json" });
    }

    const result = getPaymentProvider().verifyWebhook(req);
    if (!result.ok) {
      logger.warn({ reason: result.reason }, "Rejected payment webhook");
      return res.status(400).json({ error: result.reason });
    }

    if (result.event === "captured") {
      await markOrderPaid(result.providerRef);
    }
    res.json({ received: true });
  },
);
