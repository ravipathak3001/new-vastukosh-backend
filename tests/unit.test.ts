import { describe, expect, it } from "vitest";
import { canTransition } from "../src/modules/order/order.service.js";
import { resolveSeo } from "../src/modules/seo/seo.service.js";
import { ttlToMs } from "../src/shared/auth/jwt.js";
import { z } from "zod";
import { zodToAppError } from "../src/shared/errors.js";

describe("order state machine", () => {
  it("allows valid forward transitions", () => {
    expect(canTransition("pending_payment", "paid")).toBe(true);
    expect(canTransition("paid", "consecration")).toBe(true);
    expect(canTransition("in_transit", "delivered")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("pending_payment", "delivered")).toBe(false);
    expect(canTransition("delivered", "packed")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
  });
});

describe("resolveSeo", () => {
  const fallback = {
    path: "/shop/x",
    title: { en: "Widget", hi: "विजेट" },
    description: { en: "A widget.", hi: "एक विजेट।" },
    ogImage: "/x.jpg",
  };

  it("fills every field from fallbacks and appends the brand", () => {
    const seo = resolveSeo(undefined, fallback);
    expect(seo.title.en).toBe("Widget · Vastukosh");
    expect(seo.title.hi).toContain("वास्तुकोश");
    expect(seo.canonicalPath).toBe("/shop/x");
    expect(seo.ogImage).toBe("/x.jpg");
    expect(seo.noindex).toBe(false);
  });

  it("prefers explicit meta over fallbacks", () => {
    const seo = resolveSeo(
      { metaTitle: { en: "Custom", hi: "कस्टम" }, noindex: true, keywords: ["a"] },
      fallback,
    );
    expect(seo.title.en).toBe("Custom");
    expect(seo.noindex).toBe(true);
    expect(seo.keywords).toEqual(["a"]);
  });
});

describe("ttlToMs", () => {
  it("parses common formats", () => {
    expect(ttlToMs("15m")).toBe(900_000);
    expect(ttlToMs("30d")).toBe(2_592_000_000);
    expect(ttlToMs("500")).toBe(500);
  });
});

describe("zodToAppError", () => {
  it("turns validation failures into a readable BAD_INPUT with every field", () => {
    const schema = z.object({ input: z.object({ email: z.string().email(), password: z.string().min(8) }) });
    const result = schema.safeParse({ input: { email: "nope", password: "123" } });
    if (result.success) throw new Error("expected failure");
    const err = zodToAppError(result.error);
    expect(err.extensions.code).toBe("BAD_INPUT");
    expect(err.message).toBe("Enter a valid email address");
    expect(err.extensions.details).toEqual({
      fields: [
        { field: "email", code: "invalid_email", message: "Enter a valid email address" },
        { field: "password", code: "too_small", message: "Password must be at least 8 characters", minimum: 8 },
      ],
    });
  });
});
