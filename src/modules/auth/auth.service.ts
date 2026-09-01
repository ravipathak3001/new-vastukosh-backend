import crypto from "node:crypto";
import { customAlphabet } from "nanoid";
import { conflict, unauthenticated } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "../../shared/auth/password.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  ttlToMs,
} from "../../shared/auth/jwt.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import {
  RefreshTokenModel,
  UserModel,
  type UserDoc,
} from "./auth.model.js";
import { CartModel } from "../cart/cart.model.js";

const referralSuffix = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  /** epoch ms when the refresh token expires — handy for native clients */
  refreshExpiresAt: number;
};

export type SessionMeta = { userAgent?: string; ip?: string };

async function issueTokens(
  user: UserDoc,
  familyId: string,
  meta: SessionMeta,
): Promise<IssuedTokens> {
  const accessToken = signAccessToken({
    sub: String(user._id),
    roles: user.roles as ("customer" | "admin")[],
  });
  const { token, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + ttlToMs(env.REFRESH_TTL));
  await RefreshTokenModel.create({
    userId: user._id,
    tokenHash,
    familyId,
    userAgent: meta.userAgent ?? "",
    ip: meta.ip ?? "",
    expiresAt,
  });
  return { accessToken, refreshToken: token, refreshExpiresAt: expiresAt.getTime() };
}

export async function signup(
  input: { email: string; password: string; name: string; phone?: string; referredBy?: string },
  meta: SessionMeta,
): Promise<{ user: UserDoc; tokens: IssuedTokens }> {
  const email = input.email.toLowerCase().trim();
  if (await UserModel.exists({ email })) {
    throw conflict("An account with this email already exists");
  }
  const passwordHash = await hashPassword(input.password);
  const referralCode = `SEEKER-${referralSuffix()}`;

  const user = await UserModel.create({
    email,
    passwordHash,
    name: input.name.trim(),
    phone: input.phone?.trim() ?? "",
    referralCode,
    referredBy: input.referredBy?.trim() ?? "",
  });

  const tokens = await issueTokens(user, crypto.randomUUID(), meta);
  return { user, tokens };
}

export async function login(
  input: { email: string; password: string; anonId?: string },
  meta: SessionMeta,
): Promise<{ user: UserDoc; tokens: IssuedTokens }> {
  const email = input.email.toLowerCase().trim();
  const user = await UserModel.findOne({ email });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw unauthenticated("Incorrect email or password");
  }

  // Fold any guest cart into the user's cart on sign-in.
  if (input.anonId) {
    await mergeGuestCart(String(user._id), input.anonId);
  }

  const tokens = await issueTokens(user, crypto.randomUUID(), meta);
  return { user, tokens };
}

/**
 * Rotate a refresh token: the presented token is revoked and a fresh pair is
 * issued in the same family. Presenting an already-revoked token means it was
 * captured — revoke the entire family.
 */
export async function rotateRefreshToken(
  presentedToken: string,
  meta: SessionMeta,
): Promise<{ user: UserDoc; tokens: IssuedTokens }> {
  const tokenHash = hashRefreshToken(presentedToken);
  const record = await RefreshTokenModel.findOne({ tokenHash });
  if (!record) throw unauthenticated("Invalid session");

  if (record.revokedAt) {
    await RefreshTokenModel.updateMany(
      { familyId: record.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    logger.warn({ familyId: record.familyId }, "Refresh token reuse detected — family revoked");
    throw unauthenticated("Session expired, please sign in again");
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw unauthenticated("Session expired, please sign in again");
  }

  const user = await UserModel.findById(record.userId);
  if (!user) throw unauthenticated("Invalid session");

  const tokens = await issueTokens(user, record.familyId, meta);
  record.revokedAt = new Date();
  record.replacedByHash = hashRefreshToken(tokens.refreshToken);
  await record.save();

  return { user, tokens };
}

export async function logout(presentedToken: string | undefined, everywhere = false): Promise<void> {
  if (!presentedToken) return;
  const tokenHash = hashRefreshToken(presentedToken);
  const record = await RefreshTokenModel.findOne({ tokenHash });
  if (!record) return;
  if (everywhere) {
    await RefreshTokenModel.updateMany(
      { userId: record.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  } else {
    record.revokedAt = new Date();
    await record.save();
  }
}

export async function getUserById(id: string): Promise<UserDoc | null> {
  return UserModel.findById(id);
}

async function mergeGuestCart(userId: string, anonId: string): Promise<void> {
  const guest = await CartModel.findOne({ anonId });
  if (!guest || guest.items.length === 0) {
    await CartModel.deleteOne({ anonId });
    return;
  }
  const userCart =
    (await CartModel.findOne({ userId })) ??
    (await CartModel.create({ userId, items: [] }));

  for (const item of guest.items) {
    const existing = userCart.items.find((i) => i.productSlug === item.productSlug);
    if (existing) existing.qty = Math.min(99, existing.qty + item.qty);
    else userCart.items.push({ productSlug: item.productSlug, qty: item.qty });
  }
  if (!userCart.promoCode && guest.promoCode) userCart.promoCode = guest.promoCode;
  await userCart.save();
  await CartModel.deleteOne({ anonId });
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.COOKIE_SECURE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge: ttlToMs(env.REFRESH_TTL),
  };
}

export const REFRESH_COOKIE = "vk_rt";
