import SchemaBuilder from "@pothos/core";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import RelayPlugin from "@pothos/plugin-relay";
import DataloaderPlugin from "@pothos/plugin-dataloader";
import SimpleObjectsPlugin from "@pothos/plugin-simple-objects";
import ZodPlugin from "@pothos/plugin-zod";
import { DateTimeResolver, JSONResolver } from "graphql-scalars";
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
  };
}>({
  plugins: [
    ScopeAuthPlugin,
    RelayPlugin,
    DataloaderPlugin,
    SimpleObjectsPlugin,
    ZodPlugin,
  ],
  scopeAuth: {
    authScopes: (ctx) => ({
      loggedIn: ctx.user != null,
      admin: ctx.user?.roles.includes("admin") ?? false,
    }),
  },
  relay: {},
});

builder.addScalarType("DateTime", DateTimeResolver);
builder.addScalarType("JSON", JSONResolver);

// Root types — modules extend these with `builder.queryFields` / `mutationFields`.
builder.queryType({});
builder.mutationType({});

export type Builder = typeof builder;
