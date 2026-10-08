import type { Request, Response } from "express";
import DataLoader from "dataloader";
import { verifyAccessToken, type Role } from "../shared/auth/jwt.js";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../shared/localized.js";
import { ProductModel, type ProductDoc } from "../modules/catalog/product.model.js";
import { RashiModel, type RashiDoc } from "../modules/catalog/rashi.model.js";
import { expertIdForUser } from "../modules/expert/expert.service.js";

export type AuthUser = { id: string; roles: Role[]; permissions: string[] };

export type Loaders = {
  productBySlug: DataLoader<string, ProductDoc | null>;
  rashiBySlug: DataLoader<string, RashiDoc | null>;
};

export type Context = {
  req: Request;
  res: Response;
  user: AuthUser | null;
  locale: Locale;
  loaders: Loaders;
  /** The caller's expert profile id (memoised per request), or null if they aren't an expert. */
  expertId: () => Promise<string | null>;
  /** Drop the memoised expert id — call after creating the caller's profile mid-request. */
  resetExpertId: () => void;
};

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value : null;
}

function requestLocale(req: Request): Locale {
  const raw = req.headers["x-locale"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

function createLoaders(): Loaders {
  return {
    productBySlug: new DataLoader(async (slugs) => {
      const docs = await ProductModel.find({ slug: { $in: slugs as string[] } });
      const bySlug = new Map(docs.map((d) => [d.slug, d]));
      return slugs.map((s) => bySlug.get(s) ?? null);
    }),
    rashiBySlug: new DataLoader(async (slugs) => {
      const docs = await RashiModel.find({ slug: { $in: slugs as string[] } });
      const bySlug = new Map(docs.map((d) => [d.slug, d]));
      return slugs.map((s) => bySlug.get(s) ?? null);
    }),
  };
}

export function buildContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Context {
  const token = bearerToken(req);
  const payload = token ? verifyAccessToken(token) : null;

  const user = payload
    ? { id: payload.sub, roles: payload.roles, permissions: payload.permissions }
    : null;
  let expertIdPromise: Promise<string | null> | null = null;

  return {
    req,
    res,
    user,
    locale: requestLocale(req),
    loaders: createLoaders(),
    // Looked up rather than read from the token's roles, so a user who has just
    // applied gets panel access immediately instead of after their next refresh.
    expertId: () => {
      if (!user) return Promise.resolve(null);
      expertIdPromise ??= expertIdForUser(user.id);
      return expertIdPromise;
    },
    resetExpertId: () => {
      expertIdPromise = null;
    },
  };
}
