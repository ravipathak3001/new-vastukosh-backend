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
  | { ok: true; kind: "payment"; providerRef: string; event: "captured" | "failed"; paymentId?: string }
  | { ok: true; kind: "refund"; refundId: string; event: "processed" | "failed" }
  | { ok: false; reason: string };

export type RefundResult = {
  refundId: string;
  /** Card refunds are commonly `"pending"` until the bank settles them, days later; UPI/wallet refunds are usually `"processed"` immediately. */
  status: "pending" | "processed";
};

/**
 * The contract every payment gateway implements. Swapping providers (mock →
 * Razorpay → Stripe) never touches the GraphQL schema or the order state machine.
 */
export interface PaymentProvider {
  readonly name: string;
  createIntent(order: OrderDoc): Promise<PaymentIntent>;
  verifyWebhook(req: Request): WebhookResult;
  /**
   * Verifies the signature the client SDK's success handler returns, so a
   * paid order can be confirmed instantly instead of waiting on the webhook.
   * Providers that always auto-confirm (mock, COD) never need this.
   */
  verifyCheckoutSignature(orderRef: string, paymentRef: string, signature: string): boolean;
  /** Refunds a captured payment, in full (`amountPaise: null`) or in part. */
  refund(paymentId: string, amountPaise: number | null, notes?: Record<string, string>): Promise<RefundResult>;
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

  verifyCheckoutSignature(): boolean {
    return false;
  }

  async refund(paymentId: string, _amountPaise: number | null): Promise<RefundResult> {
    return { refundId: `mock_refund_${paymentId}_${Date.now()}`, status: "processed" };
  }
}

const RAZORPAY_BASE_URL = "https://api.razorpay.com/v1";

/**
 * Razorpay adapter. `createIntent` opens a Razorpay Order via the Orders API;
 * the client then completes payment against it with Checkout.js.
 * `verifyCheckoutSignature` confirms the client's success callback,
 * `verifyWebhook` confirms the async webhook — both must agree before an
 * order is treated as paid.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "razorpay";

  async createIntent(order: OrderDoc): Promise<PaymentIntent> {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay is selected but RAZORPAY_KEY_ID/SECRET are not set");
    }
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString(
      "base64",
    );
    const res = await fetch(`${RAZORPAY_BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        // Razorpay wants the amount in the smallest currency unit (paise).
        amount: Math.round(order.total * 100),
        currency: order.currency || "INR",
        receipt: order.orderNo,
        notes: { orderNo: order.orderNo },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Razorpay order creation failed: ${res.status} ${JSON.stringify(body)}`);
    }
    const data = body as { id: string; amount: number; currency: string };
    return {
      ref: data.id,
      autoConfirm: false,
      clientData: {
        provider: "razorpay",
        keyId: env.RAZORPAY_KEY_ID,
        razorpayOrderId: data.id,
        amount: data.amount,
        currency: data.currency,
        orderNo: order.orderNo,
      },
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
    if (body?.event === "payment.captured") {
      return {
        ok: true,
        kind: "payment",
        providerRef: body?.payload?.payment?.entity?.order_id ?? "",
        event: "captured",
        paymentId: body?.payload?.payment?.entity?.id ?? undefined,
      };
    }
    if (body?.event === "payment.failed") {
      return {
        ok: true,
        kind: "payment",
        providerRef: body?.payload?.payment?.entity?.order_id ?? "",
        event: "failed",
        paymentId: body?.payload?.payment?.entity?.id ?? undefined,
      };
    }
    // Card refunds in particular can take days to actually settle at the
    // bank — `refund.processed`/`refund.failed` is how we learn the final
    // outcome without polling.
    if (body?.event === "refund.processed") {
      return { ok: true, kind: "refund", refundId: body?.payload?.refund?.entity?.id ?? "", event: "processed" };
    }
    if (body?.event === "refund.failed") {
      return { ok: true, kind: "refund", refundId: body?.payload?.refund?.entity?.id ?? "", event: "failed" };
    }
    return { ok: false, reason: `unhandled event ${body?.event}` };
  }

  /** `orderRef|paymentRef` HMAC'd with the API secret — the scheme Checkout.js's `handler` signature uses (distinct from the webhook's body-HMAC scheme above). */
  verifyCheckoutSignature(orderRef: string, paymentRef: string, signature: string): boolean {
    if (!env.RAZORPAY_KEY_SECRET) return false;
    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${orderRef}|${paymentRef}`)
      .digest("hex");
    return expected === signature;
  }

  async refund(
    paymentId: string,
    amountPaise: number | null,
    notes?: Record<string, string>,
  ): Promise<RefundResult> {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay is selected but RAZORPAY_KEY_ID/SECRET are not set");
    }
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString(
      "base64",
    );
    const res = await fetch(`${RAZORPAY_BASE_URL}/payments/${paymentId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      // Omitting `amount` refunds the payment in full — never send `amount: null`.
      body: JSON.stringify({ ...(amountPaise != null ? { amount: amountPaise } : {}), notes }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Razorpay refund failed: ${res.status} ${JSON.stringify(body)}`);
    }
    const data = body as { id: string; status: string };
    return { refundId: data.id, status: data.status === "processed" ? "processed" : "pending" };
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
