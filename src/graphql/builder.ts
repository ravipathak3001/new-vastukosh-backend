import SchemaBuilder from "@pothos/core";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import RelayPlugin from "@pothos/plugin-relay";
import DataloaderPlugin from "@pothos/plugin-dataloader";
import SimpleObjectsPlugin from "@pothos/plugin-simple-objects";
import ZodPlugin from "@pothos/plugin-zod";
import { DateTimeResolver, JSONResolver } from "graphql-scalars";
import { forbidden, unauthenticated, zodToAppError } from "../shared/errors.js";
import type { Context } from "./context.js";

/**
 * The one Pothos SchemaBuilder every module registers against. Plugin order
 * matters: ScopeAuthPlugin must come first.
 */
export const builder = new SchemaBuilder<{
  Context: Context;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
    JSON: { Input: unknown; Output: unknown };
    ID: { Input: string; Output: string };
  };
  AuthScopes: {
    loggedIn: boolean;
    admin: boolean;
    /** Has an expert profile (any status — the panel works while pending approval). */
    expert: boolean;
    permission: string;
  };
}>({
  plugins: [
    ScopeAuthPlugin,
    RelayPlugin,
    DataloaderPlugin,
    SimpleObjectsPlugin,
    ZodPlugin,
  ],
  zod: {
    // Default would be a plain Error with the raw issue JSON — masked as
    // INTERNAL by `formatError`, so forms could never say what was wrong.
    validationError: (error) => zodToAppError(error),
  },
  scopeAuth: {
    authScopes: async (ctx) => ({
      loggedIn: ctx.user != null,
      admin: ctx.user?.roles.includes("admin") ?? false,
      // Profile lookup (memoised per request), not the token role — see `Context.expertId`.
      expert: (await ctx.expertId()) != null,
      permission: (perm: string) => ctx.user?.permissions.includes(perm) ?? false,
    }),
    // Without this, a failed `authScopes` check surfaces as a plain `Error`
    // with no `extensions.code` — `formatError` then masks it as a generic
    // "Internal server error" (and logs it as an unhandled crash) instead of
    // the client-safe 401/403 it actually is.
    unauthorizedError: (_parent, context) =>
      context.user ? forbidden("You don't have access to this") : unauthenticated(),
  },
  relay: {},
});

builder.addScalarType("DateTime", DateTimeResolver);
builder.addScalarType("JSON", JSONResolver);

// Root types — modules extend these with `builder.queryFields` / `mutationFields`.
builder.queryType({});
builder.mutationType({});

export type Builder = typeof builder;
