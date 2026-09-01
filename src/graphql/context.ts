import type { Request, Response } from "express";
import DataLoader from "dataloader";
import { verifyAccessToken, type Role } from "../shared/auth/jwt.js";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../shared/localized.js";
import { ProductModel, type ProductDoc } from "../modules/catalog/product.model.js";
import { RashiModel, type RashiDoc } from "../modules/catalog/rashi.model.js";

export type AuthUser = { id: string; roles: Role[] };

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

  return {
    req,
    res,
    user: payload ? { id: payload.sub, roles: payload.roles } : null,
    locale: requestLocale(req),
    loaders: createLoaders(),
  };
}
