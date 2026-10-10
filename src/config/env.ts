import "dotenv/config";
import { z } from "zod";

/**
 * Single source of truth for runtime configuration. Every `process.env` read
 * goes through here so a missing/invalid value fails fast at boot instead of
 * surfacing as a mysterious runtime error later.
 */
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017/vastukosh"),

  JWT_ACCESS_SECRET: z.string().min(8).default("dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().min(8).default("dev-refresh-secret-change-me"),
  ACCESS_TTL: z.string().default("15m"),
  REFRESH_TTL: z.string().default("30d"),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  PAYMENT_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  SHIPPING_PROVIDER: z.enum(["mock", "shiprocket"]).default("mock"),
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPROCKET_PICKUP_LOCATION: z.string().optional(),
  SHIPROCKET_WEBHOOK_TOKEN: z.string().optional(),

  EMAIL_PROVIDER: z.enum(["mock", "smtp"]).default("mock"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("Vastukosh <no-reply@vastukosh.com>"),
  PASSWORD_RESET_TTL: z.string().default("1h"),

  // Consultation / pooja bookings. Slots are wall-clock times in this zone.
  BOOKING_TIMEZONE: z.string().min(1).default("Asia/Kolkata"),
  // How long an unpaid booking holds its slot while the customer pays.
  BOOKING_HOLD_MINUTES: z.coerce.number().int().positive().default(15),

  // Video meetings created when an admin confirms a consultation. `mock`
  // issues a working Jitsi room link so the flow is testable without Google.
  MEETING_PROVIDER: z.enum(["mock", "google"]).default("mock"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().min(1).default("primary"),

  // "Continue with Google": OAuth client IDs (web, Android, iOS), comma-separated.
  // Unset = the Google button is refused. Not secret.
  GOOGLE_SIGNIN_CLIENT_IDS: z.string().optional(),
  // Tests only — ignored in production, which always uses Google's keys.
  GOOGLE_JWKS_URL: z.string().url().optional(),

  // Shared secret the website's server sends (header `x-ssr-key`) so its
  // server-side rendering isn't throttled by the per-IP GraphQL rate limit —
  // every visitor's page is fetched from the same few hosting IPs.
  SSR_API_KEY: z.string().optional(),

  SITE_URL: z.string().url().default("http://localhost:3000"),
  FRONTEND_REVALIDATE_URL: z.string().url().optional(),
  REVALIDATE_SECRET: z.string().optional(),

  // Fallback location for the `panchang` query when the client sends no coords.
  PANCHANG_DEFAULT_LAT: z.coerce.number().min(-90).max(90).default(28.6139),
  PANCHANG_DEFAULT_LNG: z.coerce.number().min(-180).max(180).default(77.209),
  PANCHANG_DEFAULT_TZ: z.string().min(1).default("Asia/Kolkata"),
  PANCHANG_DEFAULT_PLACE: z.string().min(1).default("New Delhi, India"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ Invalid environment configuration:\n",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;

/**
 * Production must not run on development defaults. Each of these has a safe
 * dev fallback that becomes dangerous live (forgeable admin tokens, orders
 * marked paid without charging, emails linking to localhost), so refuse to
 * boot instead of silently falling back.
 */
if (env.NODE_ENV === "production") {
  const problems: string[] = [];
  const warnings: string[] = [];
  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    if (env[key].startsWith("dev-") || env[key].length < 32) {
      problems.push(`${key} must be set to a random value of at least 32 characters`);
    }
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ");
  }
  if (!env.COOKIE_SECURE) problems.push("COOKIE_SECURE must be true (HTTPS only)");
  if (env.PAYMENT_PROVIDER === "mock" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
    problems.push("PAYMENT_PROVIDER=mock marks every order paid without charging — use razorpay");
  }
  if (env.PAYMENT_PROVIDER === "razorpay" && (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET)) {
    problems.push("RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET are all required");
  }
  if (/localhost|127\.0\.0\.1/.test(env.SITE_URL) && process.env.ALLOW_LOCAL_SITE_URL !== "true") {
    problems.push("SITE_URL points at localhost — emails and links would be broken");
  }
  if (env.EMAIL_PROVIDER === "mock") warnings.push("EMAIL_PROVIDER=mock — no emails will be sent");
  if (env.MEETING_PROVIDER === "mock") warnings.push("MEETING_PROVIDER=mock — consultations get Jitsi links, not Google Meet");
  if (!env.SSR_API_KEY) warnings.push("SSR_API_KEY unset — the website's server rendering shares the per-IP rate limit");
  if (!env.REVALIDATE_SECRET || !env.FRONTEND_REVALIDATE_URL) {
    warnings.push("FRONTEND_REVALIDATE_URL / REVALIDATE_SECRET unset — admin edits take up to an hour to show on the site");
  }
  for (const w of warnings) {
    // eslint-disable-next-line no-console
    console.warn(`⚠️  ${w}`);
  }
  if (problems.length) {
    // eslint-disable-next-line no-console
    console.error("❌ Unsafe production configuration:\n - " + problems.join("\n - "));
    process.exit(1);
  }
}

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const isDev = env.NODE_ENV === "development";

export type Env = typeof env;
