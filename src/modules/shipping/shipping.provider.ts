import type { Request } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import type { OrderDoc } from "../order/order.model.js";

export type ShipmentResult = {
  providerOrderId: string;
  shipmentId: string;
  awbCode: string;
  courierId: string;
  courierName: string;
  trackingUrl: string;
};

export type ReturnShipmentInput = {
  returnNo: string;
  order: OrderDoc;
  items: { productSlug: string; name: string; qty: number }[];
};

export type PickupResult = {
  pickupScheduledDate: Date;
};

export type TrackingResult = {
  rawStatus: string;
  expectedDeliveryDate: Date | null;
};

/** Shared so the webhook parser and the polling fallback agree on what "delivered" means. */
export function isDeliveredStatus(rawStatus: string): boolean {
  return /delivered/i.test(rawStatus) && !/rto/i.test(rawStatus);
}

export type ShipmentWebhookResult =
  | {
      ok: true;
      awbCode: string;
      rawStatus: string;
      /** True when the carrier's status maps to a fully delivered parcel. */
      delivered: boolean;
    }
  | { ok: false; reason: string };

/**
 * The contract every shipping carrier/aggregator implements. Swapping providers
 * (mock -> Shiprocket -> anything else) never touches the GraphQL schema or the
 * order state machine — see `payment.provider.ts` for the identical pattern.
 */
export interface ShippingProvider {
  readonly name: string;
  /** Create the shipment with the carrier and assign an AWB in one step. */
  createShipment(order: OrderDoc): Promise<ShipmentResult>;
  /** Reverse pickup for an approved return — same shape, opposite direction. */
  createReturnShipment(input: ReturnShipmentInput): Promise<ShipmentResult>;
  schedulePickup(shipmentId: string): Promise<PickupResult>;
  generateLabel(shipmentId: string): Promise<{ labelUrl: string }>;
  track(awbCode: string): Promise<TrackingResult>;
  cancelShipment(shipmentId: string): Promise<void>;
  verifyWebhook(req: Request): ShipmentWebhookResult;
}

/** Auto-confirming provider for local dev and tests — no network calls. */
export class MockShippingProvider implements ShippingProvider {
  readonly name = "mock";

  async createShipment(order: OrderDoc): Promise<ShipmentResult> {
    return {
      providerOrderId: `mock_order_${order.orderNo}`,
      shipmentId: `mock_shipment_${order.orderNo}`,
      awbCode: `MOCKAWB${order.orderNo.replace(/[^0-9]/g, "")}`,
      courierId: "mock-courier",
      courierName: "Mock Courier",
      trackingUrl: `https://tracking.example.test/${order.orderNo}`,
    };
  }

  async createReturnShipment(input: ReturnShipmentInput): Promise<ShipmentResult> {
    return {
      providerOrderId: `mock_return_order_${input.returnNo}`,
      shipmentId: `mock_return_shipment_${input.returnNo}`,
      awbCode: `MOCKRETAWB${input.returnNo.replace(/[^0-9]/g, "")}`,
      courierId: "mock-courier",
      courierName: "Mock Courier",
      trackingUrl: `https://tracking.example.test/return/${input.returnNo}`,
    };
  }

  async schedulePickup(): Promise<PickupResult> {
    return { pickupScheduledDate: new Date() };
  }

  async generateLabel(shipmentId: string): Promise<{ labelUrl: string }> {
    return { labelUrl: `https://labels.example.test/${shipmentId}.pdf` };
  }

  async track(): Promise<TrackingResult> {
    return { rawStatus: "IN TRANSIT", expectedDeliveryDate: null };
  }

  async cancelShipment(): Promise<void> {
    // no-op
  }

  verifyWebhook(): ShipmentWebhookResult {
    return { ok: false, reason: "mock provider has no webhook" };
  }
}

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

type CachedToken = { token: string; expiresAt: number };

/**
 * Shiprocket adapter — wired but requires `SHIPROCKET_EMAIL`/`SHIPROCKET_PASSWORD`
 * to actually call the API. The auth token is valid ~10 days; cached in memory
 * and re-minted a day early.
 *
 * NOTE: `createShipment` sends placeholder package weight/dimensions since the
 * product catalog doesn't model physical dimensions yet. Wire real per-product
 * weight/dimensions into `catalog` before relying on Shiprocket's own rate
 * calculation — until then every shipment quotes as a uniform small parcel.
 */
export class ShiprocketProvider implements ShippingProvider {
  readonly name = "shiprocket";
  private cachedToken: CachedToken | null = null;

  private async authenticate(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }
    if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
      throw new Error("Shiprocket is selected but SHIPROCKET_EMAIL/PASSWORD are not set");
    }
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
    });
    if (!res.ok) {
      throw new Error(`Shiprocket auth failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { token: string };
    this.cachedToken = { token: data.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
    return data.token;
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.authenticate();
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Shiprocket ${path} failed: ${res.status} ${JSON.stringify(body)}`);
    }
    return body as T;
  }

  async createShipment(order: OrderDoc): Promise<ShipmentResult> {
    if (!env.SHIPROCKET_PICKUP_LOCATION) {
      throw new Error("SHIPROCKET_PICKUP_LOCATION is not set");
    }
    const addr = order.shippingAddress;
    const orderRes = await this.call<{
      order_id: number;
      shipment_id: number;
    }>("/orders/create/adhoc", {
      method: "POST",
      body: JSON.stringify({
        order_id: order.orderNo,
        order_date: new Date((order as unknown as { createdAt: Date }).createdAt)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        pickup_location: env.SHIPROCKET_PICKUP_LOCATION,
        billing_customer_name: addr.firstName,
        billing_last_name: addr.lastName || "",
        billing_address: addr.line1,
        billing_address_2: addr.line2 || "",
        billing_city: addr.city,
        billing_state: addr.state,
        billing_pincode: addr.pincode,
        billing_country: "India",
        billing_email: order.email,
        billing_phone: addr.phone || "",
        shipping_is_billing: true,
        order_items: order.items.map((item) => ({
          name: item.name?.en ?? "",
          sku: item.productSlug,
          units: item.qty,
          selling_price: item.unitPrice,
        })),
        payment_method: order.payment.method === "cod" ? "COD" : "Prepaid",
        sub_total: order.subtotal,
        // TODO: source real per-product weight/dimensions once the catalog models them.
        length: 15,
        breadth: 10,
        height: 10,
        weight: 0.5,
      }),
    });

    const awbRes = await this.call<{
      response: { data: { awb_code: string; courier_company_id: number; courier_name: string } };
    }>("/courier/assign/awb", {
      method: "POST",
      body: JSON.stringify({ shipment_id: orderRes.shipment_id }),
    });

    const data = awbRes.response.data;
    return {
      providerOrderId: String(orderRes.order_id),
      shipmentId: String(orderRes.shipment_id),
      awbCode: data.awb_code,
      courierId: String(data.courier_company_id),
      courierName: data.courier_name,
      trackingUrl: `https://shiprocket.co/tracking/${data.awb_code}`,
    };
  }

  /**
   * NOTE: Shiprocket's return API needs a full destination (warehouse) address,
   * not just the pickup-location nickname `SHIPROCKET_PICKUP_LOCATION` stores —
   * model a real warehouse address before relying on this against the live API.
   */
  async createReturnShipment(input: ReturnShipmentInput): Promise<ShipmentResult> {
    if (!env.SHIPROCKET_PICKUP_LOCATION) {
      throw new Error("SHIPROCKET_PICKUP_LOCATION is not set");
    }
    const addr = input.order.shippingAddress;
    const orderRes = await this.call<{ order_id: number; shipment_id: number }>(
      "/orders/create/return/adhoc",
      {
        method: "POST",
        body: JSON.stringify({
          order_id: input.returnNo,
          order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
          pickup_customer_name: addr.firstName,
          pickup_last_name: addr.lastName || "",
          pickup_address: addr.line1,
          pickup_address_2: addr.line2 || "",
          pickup_city: addr.city,
          pickup_state: addr.state,
          pickup_pincode: addr.pincode,
          pickup_country: "India",
          pickup_email: input.order.email,
          pickup_phone: addr.phone || "",
          shipping_customer_name: env.SHIPROCKET_PICKUP_LOCATION,
          order_items: input.items.map((item) => ({
            name: item.name,
            sku: item.productSlug,
            units: item.qty,
            qc_enable: false,
          })),
        }),
      },
    );

    const awbRes = await this.call<{
      response: { data: { awb_code: string; courier_company_id: number; courier_name: string } };
    }>("/courier/assign/awb", {
      method: "POST",
      body: JSON.stringify({ shipment_id: orderRes.shipment_id }),
    });
    const data = awbRes.response.data;

    return {
      providerOrderId: String(orderRes.order_id),
      shipmentId: String(orderRes.shipment_id),
      awbCode: data.awb_code,
      courierId: String(data.courier_company_id),
      courierName: data.courier_name,
      trackingUrl: `https://shiprocket.co/tracking/${data.awb_code}`,
    };
  }

  async schedulePickup(shipmentId: string): Promise<PickupResult> {
    await this.call("/courier/generate/pickup", {
      method: "POST",
      body: JSON.stringify({ shipment_id: [Number(shipmentId)] }),
    });
    return { pickupScheduledDate: new Date() };
  }

  async generateLabel(shipmentId: string): Promise<{ labelUrl: string }> {
    const res = await this.call<{ label_url: string }>("/courier/generate/label", {
      method: "POST",
      body: JSON.stringify({ shipment_id: [Number(shipmentId)] }),
    });
    return { labelUrl: res.label_url };
  }

  async track(awbCode: string): Promise<TrackingResult> {
    const res = await this.call<{
      tracking_data: { shipment_track: { current_status: string }[]; etd?: string };
    }>(`/courier/track/awb/${awbCode}`);
    const current = res.tracking_data.shipment_track?.[0]?.current_status ?? "";
    return {
      rawStatus: current,
      expectedDeliveryDate: res.tracking_data.etd ? new Date(res.tracking_data.etd) : null,
    };
  }

  async cancelShipment(shipmentId: string): Promise<void> {
    await this.call("/orders/cancel", {
      method: "POST",
      body: JSON.stringify({ ids: [Number(shipmentId)] }),
    });
  }

  verifyWebhook(req: Request): ShipmentWebhookResult {
    const expected = env.SHIPROCKET_WEBHOOK_TOKEN;
    const provided = req.header("x-api-key");
    if (!expected || !provided || provided !== expected) {
      return { ok: false, reason: "missing or invalid webhook token" };
    }
    const body = req.body as { awb?: string; current_status?: string };
    if (!body?.awb || !body?.current_status) {
      return { ok: false, reason: "missing awb/current_status in payload" };
    }
    return {
      ok: true,
      awbCode: body.awb,
      rawStatus: body.current_status,
      delivered: isDeliveredStatus(body.current_status),
    };
  }
}

let provider: ShippingProvider | null = null;

export function getShippingProvider(): ShippingProvider {
  if (provider) return provider;
  provider =
    env.SHIPPING_PROVIDER === "shiprocket" ? new ShiprocketProvider() : new MockShippingProvider();
  logger.info({ provider: provider.name }, "Shipping provider ready");
  return provider;
}
