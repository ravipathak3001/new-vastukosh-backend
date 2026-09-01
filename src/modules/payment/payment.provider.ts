import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import type { OrderDoc } from "../order/order.model.js";

export type PaymentIntent = {
  /** Opaque reference the client uses to complete payment (order id, gateway order id, …). */
  ref: string;
  /** When true the order is treated as paid immediately (mock / COD). */
  autoConfirm: boolean;
  /** Extra data the client SDK needs (e.g. Razorpay key + order id). */
  clientData: Record<string, unknown>;
};

export type WebhookResult =
  | { ok: true; providerRef: string; event: "captured" | "failed" }
  | { ok: false; reason: string };

/**
 * The contract every payment gateway implements. Swapping providers (mock →
 * Razorpay → Stripe) never touches the GraphQL schema or the order state machine.
 */
export interface PaymentProvider {
  readonly name: string;
  createIntent(order: OrderDoc): Promise<PaymentIntent>;
  verifyWebhook(req: Request): WebhookResult;
}

/** Auto-confirming provider for local dev and tests. */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createIntent(order: OrderDoc): Promise<PaymentIntent> {
    return {
      ref: `mock_${order.orderNo}`,
      autoConfirm: true,
      clientData: { provider: "mock", amount: order.total, currency: order.currency },
    };
  }

  verifyWebhook(): WebhookResult {
    return { ok: false, reason: "mock provider has no webhook" };
  }
}

/**
 * Razorpay adapter — wired but inert until keys are configured. `createIntent`
 * would call the Orders API; `verifyWebhook` validates the HMAC signature.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "razorpay";

  async createIntent(order: OrderDoc): Promise<PaymentIntent> {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay is selected but RAZORPAY_KEY_ID/SECRET are not set");
    }
    // TODO: POST https://api.razorpay.com/v1/orders and return the real id.
    logger.warn("RazorpayPaymentProvider.createIntent is a stub");
    return {
      ref: `rzp_stub_${order.orderNo}`,
      autoConfirm: false,
      clientData: { provider: "razorpay", key: env.RAZORPAY_KEY_ID, amount: order.total * 100 },
    };
  }

  verifyWebhook(req: Request): WebhookResult {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.header("x-razorpay-signature");
    if (!secret || !signature) return { ok: false, reason: "missing webhook secret or signature" };

    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!raw) return { ok: false, reason: "raw body unavailable" };

    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (expected !== signature) return { ok: false, reason: "signature mismatch" };

    const body = req.body as { event?: string; payload?: any };
    const providerRef = body?.payload?.payment?.entity?.order_id ?? "";
    if (body?.event === "payment.captured") return { ok: true, providerRef, event: "captured" };
    if (body?.event === "payment.failed") return { ok: true, providerRef, event: "failed" };
    return { ok: false, reason: `unhandled event ${body?.event}` };
  }
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  provider =
    env.PAYMENT_PROVIDER === "razorpay"
      ? new RazorpayPaymentProvider()
      : new MockPaymentProvider();
  logger.info({ provider: provider.name }, "Payment provider ready");
  return provider;
}
