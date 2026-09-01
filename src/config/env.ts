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
    .default("http://localhost:3000")
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

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const isDev = env.NODE_ENV === "development";

export type Env = typeof env;
