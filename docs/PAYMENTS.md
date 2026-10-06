# Vastukosh — Payments (Razorpay) Guide

How online payments — and refunds — work end to end: the provider
abstraction, the two independent paths that confirm a payment, why that
confirmation (and refunds) has to be atomic, and how to set up and test it.
Read this before touching anything in `modules/payment/`, `modules/order/`'s
or `modules/returns/`'s payment-adjacent code.

---

## 1. Architecture

Payments sit behind a small provider interface so the gateway can be swapped
without touching the GraphQL schema or the order state machine:

```ts
// src/modules/payment/payment.provider.ts
interface PaymentProvider {
  readonly name: string;
  createIntent(request: PaymentRequest): Promise<PaymentIntent>; // { amount, currency, receipt, notes }
  verifyWebhook(req: Request): WebhookResult;
  verifyCheckoutSignature(orderRef: string, paymentRef: string, signature: string): boolean;
  refund(paymentId: string, amountPaise: number | null, notes?: Record<string, string>): Promise<RefundResult>;
}
```

| Provider | Selected by | Behaviour |
| -------- | ----------- | --------- |
| `MockPaymentProvider` | `PAYMENT_PROVIDER=mock` (default; forced in tests) | `createIntent` auto-confirms, `refund` auto-succeeds — used for local dev and the whole test suite, no network calls |
| `RazorpayPaymentProvider` | `PAYMENT_PROVIDER=razorpay` | Real Razorpay Orders + Refunds API + signature verification (this doc) |

The same provider and webhook also take payment for **consultation and online
pooja bookings**. The webhook resolves the gateway order id against bookings
first, then orders. See [BOOKINGS.md](BOOKINGS.md).

`getPaymentProvider()` caches one instance per process based on `env.PAYMENT_PROVIDER`.

**File map:**

| File | Responsibility |
| ---- | --------------- |
| [`src/modules/payment/payment.provider.ts`](../src/modules/payment/payment.provider.ts) | `createIntent` (Orders API), `refund` (Refunds API), `verifyWebhook` (webhook HMAC, payment + refund events), `verifyCheckoutSignature` (client-callback HMAC) |
| [`src/modules/payment/payment.routes.ts`](../src/modules/payment/payment.routes.ts) | `POST /webhooks/razorpay` — raw-body capture, signature check, dispatch to payment or refund handlers |
| [`src/modules/order/order.model.ts`](../src/modules/order/order.model.ts) | `Order.payment` sub-document (incl. `refundId`/`refundStatus`/`refundAmount`), `PAYMENT_METHODS`, `PAYMENT_STATUSES` |
| [`src/modules/order/order.service.ts`](../src/modules/order/order.service.ts) | `placeOrder`, `confirmOrderPaid` (atomic core), `markOrderPaid`, `markOrderFailed`, `verifyRazorpayPayment`, `cancelOrder`, `refundOrder`, `syncOrderRefundStatus` |
| [`src/modules/order/order.schema.ts`](../src/modules/order/order.schema.ts) | GraphQL: `placeOrder`, `verifyRazorpayPayment`, `cancelOrder`; also where `advanceOrderStatus`/`allowedTransitions` block `refunded` from the generic stepper |
| [`src/modules/order/order.admin.schema.ts`](../src/modules/order/order.admin.schema.ts) | GraphQL: `refundOrder(orderNo, note, amount)` — the only mutation that actually calls the gateway for a direct order refund |
| [`src/modules/returns/return.model.ts`](../src/modules/returns/return.model.ts) | `Return.refundId`/`refundStatus`/`refundAmount` |
| [`src/modules/returns/return.service.ts`](../src/modules/returns/return.service.ts) | `refundReturn`, `syncReturnRefundStatus` |
| [`tests/payment.test.ts`](../tests/payment.test.ts) | Payment-confirmation race coverage + `RazorpayPaymentProvider` unit tests (signature verification, refund HTTP shape) |
| [`tests/refunds.test.ts`](../tests/refunds.test.ts) | Refund flow coverage: full/partial, COD short-circuit, double-restock guard, concurrent double-click, webhook sync |
| [`../frontend/lib/payments/razorpay.ts`](../../frontend/lib/payments/razorpay.ts) | Loads Checkout.js, opens the modal, resolves success/dismiss |
| [`../frontend/components/checkout/checkout-flow.tsx`](../../frontend/components/checkout/checkout-flow.tsx) | Orchestrates `placeOrder` → Checkout → `verifyRazorpayPayment` → `cancelOrder` |
| [`../admin/app/(dash)/orders/[orderNo]/page.tsx`](../../admin/app/(dash)/orders/[orderNo]/page.tsx) | Admin "Refund" button + dialog for a direct order refund |
| [`../admin/app/(dash)/returns/[returnNo]/page.tsx`](../../admin/app/(dash)/returns/[returnNo]/page.tsx) | Admin refund dialog for a return (only enabled once `received`) |

---

## 2. Data model

```ts
Order.payment = {
  provider: "mock" | "razorpay",
  providerRef: string,     // Razorpay *order* id, e.g. "order_Nx..."
  transactionId: string,   // Razorpay *payment* id, e.g. "pay_Nx...", set once captured
  method: "upi" | "card" | "netbanking" | "cod" | "online",
  status: "created" | "authorized" | "captured" | "failed",
  refundId: string,        // Razorpay *refund* id, e.g. "rfnd_Nx...", set once a refund is requested
  refundStatus: "" | "pending" | "processed" | "failed",
  refundAmount: number,    // rupees, not paise
}

Return.refundAmount: number
Return.refundId: string
Return.refundStatus: "" | "pending" | "processed" | "failed"
```

Three different ids, don't confuse them: `providerRef` (the Razorpay
*order*), `transactionId` (the Razorpay *payment*, needed to refund it), and
`refundId` (the Razorpay *refund* itself, once one has been requested).

Order status transitions relevant here (full map in `order.service.ts`):

```
pending_payment → paid → consecration → packed → in_transit → delivered
       ↓                     ↓             ↓          ↓            ↓
   cancelled ───────────────────────────────────────────────────→ refunded
                             ↓             ↓          ↓            ↑
                         refunded ───→ refunded ──→ refunded ──────┘
```

A captured payment never rests at `paid` — it's written straight through to
`consecration` in one atomic step (see §4). `refunded` is reachable from
**every** post-payment status, including `cancelled` (a paid order can still
be cancelled before it ships, and that capture still needs a way back) — see
§5. It's reachable only through `refundOrder`/`refundReturn`, never the
generic `advanceOrderStatus` stepper, since those are the only paths that
actually call the gateway.

---

## 3. The end-to-end payment flow

1. Shopper places the order (`placeOrder` mutation). Backend creates the
   `Order` doc (`status: pending_payment`) and calls `provider.createIntent`
   — **skipped entirely for Cash on Delivery**, which never touches the
   gateway. For online payment, `createIntent` opens a real Order via
   `POST /v1/orders` and returns:
   ```ts
   { keyId, razorpayOrderId, amount, currency, orderNo } // → GraphQL `clientData` (JSON scalar)
   ```
2. Frontend opens Razorpay's hosted Checkout (`checkout.razorpay.com/v1/checkout.js`)
   against that `razorpayOrderId`. **We never collect card/UPI details
   ourselves** — Razorpay's modal does, which keeps this app out of PCI-DSS
   scope entirely.
3. The shopper pays. Two independent things now happen, in no guaranteed order:
   - **Client callback**: Checkout's `handler` fires in-browser with
     `{razorpay_order_id, razorpay_payment_id, razorpay_signature}`. The
     frontend immediately calls `verifyRazorpayPayment`, which re-derives
     `HMAC_SHA256(razorpay_order_id|razorpay_payment_id, KEY_SECRET)` and
     compares it to the signature Razorpay handed back.
   - **Webhook**: Razorpay's servers `POST /webhooks/razorpay` with
     `payment.captured` (or `payment.failed`). The route verifies
     `HMAC_SHA256(raw_body, WEBHOOK_SECRET)` against the `X-Razorpay-Signature`
     header, then calls `markOrderPaid` / `markOrderFailed`.
4. Whichever of the two arrives first flips the order to `consecration`; the
   other is a safe no-op (§4).
5. If the shopper closes Checkout's modal **without** a successful payment,
   the frontend calls `cancelOrder`, which restocks the reserved inventory
   immediately instead of leaving it locked against an abandoned order.

Both confirmation paths are optional in isolation — the client callback works
even with no public webhook URL (useful in local dev), and the webhook works
even if the shopper's browser crashes right after paying. Neither should be
removed.

---

## 4. Why payment confirmation is a single atomic write

`confirmOrderPaid` (private helper in `order.service.ts`) is the only place
that ever moves an order from `pending_payment` to `consecration`:

```ts
OrderModel.findOneAndUpdate(
  { ...filter, status: "pending_payment" },   // atomic guard
  { $set: { status: "consecration", "payment.status": "captured", ... },
    $push: { timeline: { $each: [paidEntry, consecrationEntry] } } },
  { new: true },
);
```

This has to be one atomic, filtered update — **not** a `findOne` followed by
mutating the document and `.save()`ing it. The client-verify path and the
webhook path both call into this same function, independently, and can arrive
within milliseconds of each other in live traffic. A load-then-save here
would let the loser of that race either throw or silently clobber the
winner's write. With the filtered `findOneAndUpdate`, the loser's update
matches zero documents (the status is no longer `pending_payment`) and
returns `null` — treated as "already confirmed, nothing to do."

Razorpay also lets a shopper retry a different instrument after a decline,
*within the same order_id, without closing the modal*. That means
`payment.failed` is **not** a terminal event — `markOrderFailed` only flags
`payment.status: "failed"` for visibility and deliberately leaves
`status: "pending_payment"` so a follow-up `payment.captured` for the same
`providerRef` can still succeed.

`tests/payment.test.ts` covers both: concurrent duplicate webhook delivery,
and a decline followed by a successful retry.

---

## 5. Refunds

Both refund entry points move real money and both follow the same shape:

- **`refundOrder(orderNo, note?, amount?)`** — a direct admin refund of an
  order. Valid from any post-payment status (`paid` through `delivered`,
  and `cancelled` too). Defaults to a full refund of `order.total`; pass
  `amount` for a partial one.
- **`refundReturn(returnNo, amount)`** — refunds a return against its
  order's captured payment. Only valid once the return is `received`
  (physical item back at the warehouse) — that's enforced by the return's
  own state machine, unchanged by this feature.

Both:

1. Look up the order's `payment.transactionId`. **If it's empty** (Cash on
   Delivery, or a payment that never actually completed), there's no money
   to send back — the function just closes out the status and restocks.
   No gateway call happens.
2. Otherwise, **atomically claim the refund** — a `findOneAndUpdate` filtered
   on `refundStatus` being empty or `"failed"`, setting it to `"pending"` —
   before calling `provider.refund(...)`. This is the same pattern as
   `confirmOrderPaid` (§4) applied to money going *out*: it's what makes a
   double-click on the admin "Refund" button, or a retried request, safe.
   If the claim matches zero documents, the function throws
   `"A refund … is already in progress or complete"` instead of calling the
   gateway a second time.
3. Call `POST /v1/payments/{payment_id}/refund` (omit `amount` for a full
   refund — Razorpay does the currency-unit conversion to paise on our
   side, `Math.round(amount * 100)`).
4. Record `refundId`/`refundStatus`/`refundAmount`, move the order/return to
   `refunded`, and restock the returned items — **except** when the order
   was already `cancelled` (already restocked once at cancel time;
   `advanceStatus` in `order.service.ts` guards against restocking twice).
5. On a gateway error, `refundStatus` is set to `"failed"` (releasing the
   claim so a retry is possible) and the error propagates to the caller.

**Card refunds in particular can take days to settle** at the bank —
Razorpay's synchronous response is often `"pending"`, not `"processed"`.
`refund.processed` / `refund.failed` webhook events (handled in
`payment.routes.ts`, dispatched to `syncOrderRefundStatus` /
`syncReturnRefundStatus`) update the final status once the gateway knows it,
without polling.

**Why the generic admin stepper can't do this**: `Order.allowedTransitions`
and the `advanceOrderStatus` mutation both explicitly exclude `refunded` (see
`order.schema.ts`) — otherwise an admin could "mark" an order refunded via
the generic status button with zero money actually moving. `refundOrder` is
the only door in.

`tests/refunds.test.ts` covers: full and partial refunds, the COD
short-circuit, the double-restock guard, a concurrent double-click, and
webhook-driven status sync.

---

## 6. Environment variables

Already declared in `src/config/env.ts` / `.env.example` — refunds use the
same credentials as payments, nothing new to configure:

```
PAYMENT_PROVIDER=razorpay        # mock | razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxx # only needed once you wire up a webhook
```

`RAZORPAY_KEY_ID` is also sent to the browser as part of `clientData` (it's
public by design — it identifies the account, it isn't a secret). Never send
`RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` to the client.

---

## 7. Local development setup

1. **Sign up**: [dashboard.razorpay.com/signup](https://dashboard.razorpay.com/signup) — test mode works immediately, no KYC.
2. **Test keys**: Dashboard → Settings → API Keys → "Generate Test Key".
3. Set the three env vars above in `backend/.env` (`PAYMENT_PROVIDER=razorpay`).
4. **Webhook (optional locally, required before going live)**: your backend
   isn't publicly reachable on `localhost`, so run `ngrok http 4000` and add a
   webhook in Dashboard → Settings → Webhooks pointing at
   `https://<your-id>.ngrok-free.app/webhooks/razorpay`. Select
   `payment.captured`, `payment.failed`, `refund.processed` and
   `refund.failed`. Copy the secret you set there into
   `RAZORPAY_WEBHOOK_SECRET`.
5. Restart the backend. Test instruments (test mode only):
   - Card: `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`.
   - UPI: `success@razorpay` (always succeeds) / `failure@razorpay` (always declines).
   - To exercise the decline-then-retry path from §4: use `failure@razorpay`
     first, then pay again with `success@razorpay` **in the same modal**
     without closing it.
   - Test-mode refunds process instantly against Razorpay's simulator — no
     separate refund test instrument needed, just refund a captured test
     payment from the admin panel.

---

## 8. Going live

1. Complete KYC in the Razorpay dashboard to activate the account.
2. Generate **Live** keys and swap `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in production.
3. Add a **production** webhook pointing at your real backend URL with a
   fresh secret, subscribed to all four events from §7; update
   `RAZORPAY_WEBHOOK_SECRET`.
4. Do one real, small-value end-to-end transaction — and one real refund of
   it — before opening it up.
5. If an order ever ends up `cancelled` after a payment that Razorpay's
   dashboard shows as genuinely captured (shouldn't happen after §4's fix,
   but if some other bug reintroduces the race): `refundOrder` still works
   from `cancelled` (§5), so refund it properly rather than hand-editing the
   database.

---

## 9. Known limitations / follow-ups

- **Mobile app isn't wired up for payments at all.** `mobile-app/src/screens/shop/CheckoutScreen.tsx`
  still shows a placeholder alert for online payments; a real integration
  would use `react-native-razorpay` and call the same `verifyRazorpayPayment`
  mutation. Nothing to do for refunds there since nothing gets charged yet.
- **One refund record per order/return, not a running ledger.** Razorpay
  itself supports multiple partial refunds stacking up against one payment,
  but `Order.payment.refundId/refundStatus/refundAmount` and
  `Return.refundId/refundStatus/refundAmount` each hold a single refund's
  result — a refund always closes the order/return out to `refunded`. If you
  need to issue a second, separate partial refund against an order that's
  already `refunded`, that's a gap today (the state machine has no
  transition out of `refunded`).
- **No cleanup job for abandoned orders.** If a shopper leaves an open
  Checkout tab without ever dismissing the modal or completing payment, the
  order stays `pending_payment` with stock reserved indefinitely. `cancelOrder`
  only fires on an explicit dismiss/fail signal from the frontend.

---

## 10. Troubleshooting

**"I paid successfully but the site says the payment failed."**
This was a real incident, fixed 2026-09-23 — see §4. If it recurs, it means
something is once again treating `payment.failed` as terminal, or the
confirmation write has regressed from an atomic `findOneAndUpdate` back to a
load-then-save. Check `openRazorpayCheckout` (frontend) and `confirmOrderPaid`
(backend) first, and re-run `tests/payment.test.ts`.

**Webhook returns 400.** Almost always a signature mismatch — check
`RAZORPAY_WEBHOOK_SECRET` matches what's configured in the Dashboard for that
specific webhook endpoint (each webhook URL has its own secret).

**`createIntent` throws "RAZORPAY_KEY_ID/SECRET are not set".**
`PAYMENT_PROVIDER=razorpay` but the keys aren't in `.env` — see §6.

**"A refund for this order/return is already in progress or complete."**
The atomic claim in §5 rejected a second attempt — check
`payment.refundId`/`refundStatus` (or the return's) before retrying. If
`refundStatus` is stuck at `"pending"` for an unexpectedly long time, check
the Razorpay dashboard directly; a card refund can genuinely take several
days, or the `refund.processed`/`refund.failed` webhook may not be reaching
this backend (see §7 step 4 and the webhook troubleshooting entry above).

**Refund succeeded in Razorpay but the order still shows the old status.**
Re-check `payment.refundId` matches what Razorpay shows, then confirm the
webhook is actually configured for `refund.processed`/`refund.failed` — the
synchronous refund call already sets an initial status, but the *final* one
for card refunds only ever arrives via that webhook.
