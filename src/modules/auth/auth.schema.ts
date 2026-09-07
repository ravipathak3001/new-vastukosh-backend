import { z } from "zod";
import { builder } from "../../graphql/builder.js";
import { unauthenticated } from "../../shared/errors.js";
import type { Context } from "../../graphql/context.js";
import { UserRef } from "../user/user.schema.js";
import type { IssuedTokens } from "./auth.service.js";
import {
  REFRESH_COOKIE,
  getUserById,
  login,
  logout,
  refreshCookieOptions,
  requestPasswordReset,
  resetPassword,
  rotateRefreshToken,
  signup,
} from "./auth.service.js";
import type { UserDoc } from "./auth.model.js";

type AuthResult = { user: UserDoc; tokens: IssuedTokens };

const AuthPayloadRef = builder.objectRef<AuthResult>("AuthPayload").implement({
  description:
    "Returned by signup/login/refreshToken. Web clients also receive the refresh " +
    "token in an httpOnly cookie; native clients must persist `refreshToken` themselves.",
  fields: (t) => ({
    user: t.field({ type: UserRef, resolve: (r) => r.user }),
    accessToken: t.string({ resolve: (r) => r.tokens.accessToken }),
    refreshToken: t.string({ resolve: (r) => r.tokens.refreshToken }),
    accessTokenExpiresIn: t.int({ resolve: () => 15 * 60 }),
    refreshTokenExpiresAt: t.field({
      type: "DateTime",
      resolve: (r) => new Date(r.tokens.refreshExpiresAt),
    }),
  }),
});

function sessionMeta(ctx: Context) {
  return {
    userAgent: ctx.req.headers["user-agent"] ?? "",
    ip: ctx.req.ip ?? "",
  };
}

function setRefreshCookie(ctx: Context, token: string) {
  ctx.res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

const SignupInput = builder.inputType("SignupInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    email: t.string({ required: true }),
    password: t.string({ required: true }),
    phone: t.string({ required: false }),
    referredBy: t.string({ required: false }),
    /** guest cart id to merge on account creation */
    anonId: t.string({ required: false }),
  }),
});

const LoginInput = builder.inputType("LoginInput", {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true }),
    anonId: t.string({ required: false }),
  }),
});

const signupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export function registerAuthModule() {
  builder.queryFields((t) => ({
    me: t.field({
      type: UserRef,
      nullable: true,
      resolve: (_p, _a, ctx) => (ctx.user ? getUserById(ctx.user.id) : null),
    }),
  }));

  builder.mutationFields((t) => ({
    signup: t.field({
      type: AuthPayloadRef,
      args: { input: t.arg({ type: SignupInput, required: true }) },
      validate: { schema: z.object({ input: signupSchema.passthrough() }) },
      resolve: async (_p, { input }, ctx) => {
        const result = await signup(
          {
            email: input.email,
            password: input.password,
            name: input.name,
            phone: input.phone ?? undefined,
            referredBy: input.referredBy ?? undefined,
          },
          sessionMeta(ctx),
        );
        setRefreshCookie(ctx, result.tokens.refreshToken);
        return result;
      },
    }),

    login: t.field({
      type: AuthPayloadRef,
      args: { input: t.arg({ type: LoginInput, required: true }) },
      resolve: async (_p, { input }, ctx) => {
        const result = await login(
          { email: input.email, password: input.password, anonId: input.anonId ?? undefined },
          sessionMeta(ctx),
        );
        setRefreshCookie(ctx, result.tokens.refreshToken);
        return result;
      },
    }),

    /** Pass `refreshToken` explicitly (native) or omit it to use the cookie (web). */
    refreshToken: t.field({
      type: AuthPayloadRef,
      args: { refreshToken: t.arg.string({ required: false }) },
      resolve: async (_p, args, ctx) => {
        const presented =
          args.refreshToken ?? (ctx.req.cookies?.[REFRESH_COOKIE] as string | undefined);
        if (!presented) throw unauthenticated("No refresh token provided");
        const result = await rotateRefreshToken(presented, sessionMeta(ctx));
        setRefreshCookie(ctx, result.tokens.refreshToken);
        return result;
      },
    }),

    logout: t.boolean({
      args: {
        refreshToken: t.arg.string({ required: false }),
        everywhere: t.arg.boolean({ required: false }),
      },
      resolve: async (_p, args, ctx) => {
        const presented =
          args.refreshToken ?? (ctx.req.cookies?.[REFRESH_COOKIE] as string | undefined);
        await logout(presented, args.everywhere ?? false);
        ctx.res.clearCookie(REFRESH_COOKIE, { path: "/" });
        return true;
      },
    }),

    /** Always returns true, whether or not the email is registered — avoids leaking account existence. */
    requestPasswordReset: t.boolean({
      args: { email: t.arg.string({ required: true }) },
      resolve: async (_p, { email }) => {
        await requestPasswordReset(email);
        return true;
      },
    }),

    resetPassword: t.boolean({
      args: {
        token: t.arg.string({ required: true }),
        newPassword: t.arg.string({ required: true }),
      },
      resolve: async (_p, { token, newPassword }) => {
        await resetPassword(token, newPassword);
        return true;
      },
    }),
  }));
}
