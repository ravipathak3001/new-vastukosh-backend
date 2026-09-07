import { builder } from "../../graphql/builder.js";
import type { PromoDoc } from "./cart.model.js";
import {
  deletePromo,
  listPromosForAdmin,
  upsertPromo,
} from "./cart.service.js";

const PromoKindEnum = builder.enumType("PromoKind", {
  values: ["percent", "flat"] as const,
});

const PromoRef = builder.objectRef<PromoDoc>("Promo").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (p) => String(p._id) }),
    code: t.exposeString("code"),
    kind: t.field({ type: PromoKindEnum, resolve: (p) => p.kind as never }),
    amount: t.exposeFloat("amount"),
    active: t.exposeBoolean("active"),
    minSubtotal: t.exposeFloat("minSubtotal"),
    expiresAt: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (p) => p.expiresAt ?? null,
    }),
  }),
});

const PromoInput = builder.inputType("PromoInput", {
  fields: (t) => ({
    code: t.string({ required: true }),
    kind: t.field({ type: PromoKindEnum, required: true }),
    amount: t.float({ required: true }),
    active: t.boolean({ required: false }),
    minSubtotal: t.float({ required: false }),
    expiresAt: t.field({ type: "DateTime", required: false }),
  }),
});

export function registerPromoAdminModule() {
  builder.queryFields((t) => ({
    adminPromos: t.field({
      type: [PromoRef],
      authScopes: { permission: "promos.view" },
      resolve: () => listPromosForAdmin(),
    }),
  }));

  builder.mutationFields((t) => ({
    upsertPromo: t.field({
      type: PromoRef,
      authScopes: { permission: "promos.manage" },
      args: { input: t.arg({ type: PromoInput, required: true }) },
      resolve: (_p, { input }) => upsertPromo(input as never),
    }),

    deletePromo: t.field({
      type: "Boolean",
      authScopes: { permission: "promos.manage" },
      args: { code: t.arg.string({ required: true }) },
      resolve: async (_p, { code }) => {
        await deletePromo(code);
        return true;
      },
    }),
  }));
}
