import express, { Router } from "express";
import { logger } from "../../config/logger.js";
import { getPaymentProvider } from "./payment.provider.js";
import { markOrderFailed, markOrderPaid, syncOrderRefundStatus } from "../order/order.service.js";
import { syncReturnRefundStatus } from "../returns/return.service.js";
import {
  markBookingFailed,
  markBookingPaid,
  syncBookingRefundStatus,
} from "../consultation/consultation.service.js";

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

    if (result.kind === "payment") {
      // The gateway order id belongs to either a consultation/pooja booking
      // or a shop order — bookings are checked first, then orders.
      if (result.event === "captured") {
        const isBooking = await markBookingPaid(result.providerRef, result.paymentId);
        if (!isBooking) await markOrderPaid(result.providerRef, result.paymentId);
      } else {
        const isBooking = await markBookingFailed(result.providerRef);
        if (!isBooking) await markOrderFailed(result.providerRef);
      }
    } else {
      // A refund can belong to a direct order refund, a return's refund or a
      // booking refund — try each in turn.
      const matched =
        (await syncOrderRefundStatus(result.refundId, result.event)) ||
        (await syncReturnRefundStatus(result.refundId, result.event)) ||
        (await syncBookingRefundStatus(result.refundId, result.event));
      if (!matched) logger.warn({ refundId: result.refundId }, "Refund webhook matched nothing");
    }
    res.json({ received: true });
  },
);
