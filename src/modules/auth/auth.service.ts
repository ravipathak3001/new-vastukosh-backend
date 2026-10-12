import crypto from "node:crypto";
import { customAlphabet } from "nanoid";
import { badInput, conflict, unauthenticated } from "../../shared/errors.js";
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
  EmailVerificationTokenModel,
  PasswordResetTokenModel,
  RefreshTokenModel,
  UserModel,
  type UserDoc,
} from "./auth.model.js";
import { CartModel } from "../cart/cart.model.js";
import { computeUserPermissions } from "../roles/role.service.js";
import type { Role } from "../../shared/auth/jwt.js";
import { queueEmail } from "../email/outbox.service.js";
import { asLocale, siteUrl } from "../email/layout.js";
import {
  passwordChangedTemplate,
  passwordResetTemplate,
  verifyEmailTemplate,
  welcomeTemplate,
} from "../email/templates/account.js";
import { verifyGoogleIdToken } from "./google.js";

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
    roles: user.roles as Role[],
    permissions: await computeUserPermissions(user),
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
  input: { email: string; password: string; name: string; phone?: string; referredBy?: string; locale?: string },
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
    localePref: asLocale(input.locale),
  });

  await sendVerificationEmail(user);
  const tokens = await issueTokens(user, crypto.randomUUID(), meta);
  return { user, tokens };
}

// ─── Email verification ───────────────────────────────────────────────────

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** Emails a one-time "confirm your email" link (replacing any earlier unused one). */
export async function sendVerificationEmail(user: UserDoc): Promise<void> {
  if (user.emailVerified) return;
  const token = crypto.randomBytes(32).toString("base64url");
  await EmailVerificationTokenModel.updateMany(
    { userId: user._id, usedAt: null },
    { $set: { usedAt: new Date() } },
  );
  await EmailVerificationTokenModel.create({
    userId: user._id,
    email: user.email,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlToMs(env.EMAIL_VERIFY_TTL)),
  });
  const locale = asLocale(user.localePref);
  await queueEmail({
    to: user.email,
    kind: "account.verify",
    ref: String(user._id),
    ...verifyEmailTemplate(
      { name: user.name, email: user.email, locale },
      siteUrl(locale, `/verify-email?token=${token}`),
    ),
  });
}

/** "Resend" button: at most one email a minute, so it can't be used to spam an inbox. */
export async function resendVerificationEmail(userId: string): Promise<boolean> {
  const user = await UserModel.findById(userId);
  if (!user) throw unauthenticated();
  if (user.emailVerified) return false;
  const recent = await EmailVerificationTokenModel.exists({
    userId: user._id,
    createdAt: { $gt: new Date(Date.now() - 60_000) },
  });
  if (recent) throw badInput("We just sent a link — please wait a minute before asking again");
  await sendVerificationEmail(user);
  return true;
}

/** Consumes a verification link. Safe to open twice: an already-verified account just succeeds. */
export async function verifyEmail(token: string): Promise<UserDoc> {
  const record = await EmailVerificationTokenModel.findOne({ tokenHash: hashToken(token) });
  const user = record ? await UserModel.findById(record.userId) : null;
  if (!record || !user) throw badInput("This verification link is invalid or has expired");
  if (user.emailVerified && user.email === record.email) return user;
  if (record.usedAt || record.expiresAt.getTime() < Date.now() || user.email !== record.email) {
    throw badInput("This verification link is invalid or has expired");
  }
  record.usedAt = new Date();
  await record.save();
  user.emailVerified = true;
  await user.save();
  await queueEmail({
    to: user.email,
    kind: "account.welcome",
    ref: String(user._id),
    dedupeKey: `welcome:${user._id}`,
    ...welcomeTemplate({ name: user.name, email: user.email, locale: asLocale(user.localePref) }),
  });
  return user;
}

export async function login(
  input: { email: string; password: string; anonId?: string },
  meta: SessionMeta,
): Promise<{ user: UserDoc; tokens: IssuedTokens }> {
  const email = input.email.toLowerCase().trim();
  const user = await UserModel.findOne({ email });
  if (user && !user.passwordHash && user.googleId) {
    throw unauthenticated(
      "This account uses Google sign-in. Use “Continue with Google”, or set a password with “Forgot password”.",
    );
  }
  if (!user || !user.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
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
 * "Continue with Google": one call for both sign-in and sign-up. A returning
 * Google user is found by their Google ID; someone who signed up with email
 * and password is found by email and linked (Google has verified they own it);
 * anyone else gets a new account from their Google name and email.
 */
export async function loginWithGoogle(
  input: { idToken: string; anonId?: string; referredBy?: string; locale?: string },
  meta: SessionMeta,
): Promise<{ user: UserDoc; tokens: IssuedTokens; created: boolean }> {
  const google = await verifyGoogleIdToken(input.idToken);

  let created = false;
  let user =
    (await UserModel.findOne({ googleId: google.googleId })) ??
    (await UserModel.findOne({ email: google.email }));

  if (user) {
    if (!user.googleId || !user.emailVerified) {
      user.googleId = google.googleId;
      user.emailVerified = true;
      await user.save();
    }
  } else {
    try {
      user = await UserModel.create({
        email: google.email,
        name: google.name,
        googleId: google.googleId,
        emailVerified: true,
        referralCode: `SEEKER-${referralSuffix()}`,
        referredBy: input.referredBy?.trim() ?? "",
        localePref: asLocale(input.locale),
      });
      created = true;
      await queueEmail({
        to: user.email,
        kind: "account.welcome",
        ref: String(user._id),
        dedupeKey: `welcome:${user._id}`,
        ...welcomeTemplate({ name: user.name, email: user.email, locale: asLocale(user.localePref) }),
      });
    } catch (err) {
      // Two taps at once: the other request created the account first.
      if ((err as { code?: number }).code !== 11000) throw err;
      user = await UserModel.findOne({ email: google.email });
      if (!user) throw err;
    }
  }

  if (input.anonId) await mergeGuestCart(String(user._id), input.anonId);
  const tokens = await issueTokens(user, crypto.randomUUID(), meta);
  return { user, tokens, created };
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

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Always resolves (never reveals whether the email exists) — the caller
 * returns `true` unconditionally so this can't be used to enumerate accounts.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
  if (!user) return;

  const token = crypto.randomBytes(32).toString("base64url");
  await PasswordResetTokenModel.create({
    userId: user._id,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + ttlToMs(env.PASSWORD_RESET_TTL)),
  });

  const locale = asLocale(user.localePref);
  await queueEmail({
    to: user.email,
    kind: "account.password_reset",
    ref: String(user._id),
    ...passwordResetTemplate(
      { name: user.name, email: user.email, locale },
      siteUrl(locale, `/reset-password?token=${token}`),
    ),
  });
}

/** Consumes the token, sets the new password, and revokes every existing session. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw badInput("Password must be at least 8 characters");

  const record = await PasswordResetTokenModel.findOne({ tokenHash: hashResetToken(token) });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw badInput("This reset link is invalid or has expired");
  }
  const user = await UserModel.findById(record.userId);
  if (!user) throw badInput("This reset link is invalid or has expired");

  user.passwordHash = await hashPassword(newPassword);
  // Using the emailed link proves they own the inbox.
  user.emailVerified = true;
  await user.save();
  await queueEmail({
    to: user.email,
    kind: "account.password_changed",
    ref: String(user._id),
    ...passwordChangedTemplate({ name: user.name, email: user.email, locale: asLocale(user.localePref) }),
  });
  record.usedAt = new Date();
  await record.save();

  await RefreshTokenModel.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
