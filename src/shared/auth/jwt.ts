import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";

export type Role = "customer" | "admin";

export type AccessTokenPayload = {
  sub: string;
  roles: Role[];
  /**
   * Flattened permission keys from the user's assigned custom roles (see
   * `modules/roles`), computed once at issue time. Baked into the token
   * rather than looked up per-request — same latency/propagation tradeoff
   * the codebase already accepts for `roles`, so a permission change takes
   * effect on the user's next token refresh (within `ACCESS_TTL`).
   */
  permissions: string[];
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TTL as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === "string") return null;
    const { sub, roles, permissions } = decoded as jwt.JwtPayload;
    if (typeof sub !== "string" || !Array.isArray(roles)) return null;
    return {
      sub,
      roles: roles as Role[],
      permissions: Array.isArray(permissions) ? (permissions as string[]) : [],
    };
  } catch {
    return null;
  }
}

/**
 * Refresh tokens are opaque random strings (not JWTs) so they can be revoked by
 * deleting/flagging the stored hash. We keep only the SHA-256 hash server-side.
 */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(48).toString("base64url");
  return { token, tokenHash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Parse strings like `15m`, `30d`, `12h`, `3600` into milliseconds. */
export function ttlToMs(ttl: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(ttl.trim());
  if (!match) throw new Error(`Invalid TTL: ${ttl}`);
  const value = Number(match[1]);
  const unit = match[2] ?? "ms";
  const factor: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * factor[unit]!;
}
