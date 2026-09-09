import { builder } from "../../graphql/builder.js";
import { resolvePaging, paged, type Paged } from "../../graphql/admin-common.js";
import { ReturnModel, type ReturnDoc } from "./return.model.js";
import { ReturnRef, ReturnStatusEnum } from "./return.schema.js";
import {
  approveReturn,
  listReturnsForAdmin,
  markReturnReceived,
  refundReturn,
  rejectReturn,
  scheduleReturnPickup,
} from "./return.service.js";

const AdminReturnFilter = builder.inputType("AdminReturnFilter", {
  fields: (t) => ({
    status: t.field({ type: ReturnStatusEnum, required: false }),
    search: t.string({ required: false }),
  }),
});

const AdminReturnPage = builder.objectRef<Paged<ReturnDoc>>("AdminReturnPage").implement({
  fields: (t) => ({
    items: t.field({ type: [ReturnRef], resolve: (p) => p.items }),
    total: t.exposeInt("total"),
    page: t.exposeInt("page"),
    pageSize: t.exposeInt("pageSize"),
  }),
});

export function registerReturnAdminModule() {
  builder.queryFields((t) => ({
    adminReturns: t.field({
      type: AdminReturnPage,
      authScopes: { permission: "returns.view" },
      args: {
        filter: t.arg({ type: AdminReturnFilter, required: false }),
        page: t.arg.int({ required: false }),
        pageSize: t.arg.int({ required: false }),
      },
      resolve: async (_p, args) => {
        const { page, pageSize, skip, limit } = resolvePaging(args);
        const { items, total } = await listReturnsForAdmin(
          { status: args.filter?.status ?? null, search: args.filter?.search ?? null },
          skip,
          limit,
        );
        return paged(items, total, { page, pageSize });
      },
    }),

    adminReturn: t.field({
      type: ReturnRef,
      nullable: true,
      authScopes: { permission: "returns.view" },
      args: { returnNo: t.arg.string({ required: true }) },
      resolve: (_p, { returnNo }) => ReturnModel.findOne({ returnNo }).exec(),
    }),
  }));

  builder.mutationFields((t) => ({
    approveReturn: t.field({
      type: ReturnRef,
      authScopes: { permission: "returns.manage" },
      args: { returnNo: t.arg.string({ required: true }), note: t.arg.string({ required: false }) },
      resolve: (_p, { returnNo, note }) => approveReturn(returnNo, note ?? ""),
    }),

    rejectReturn: t.field({
      type: ReturnRef,
      authScopes: { permission: "returns.manage" },
      args: { returnNo: t.arg.string({ required: true }), note: t.arg.string({ required: false }) },
      resolve: (_p, { returnNo, note }) => rejectReturn(returnNo, note ?? ""),
    }),

    scheduleReturnPickup: t.field({
      type: ReturnRef,
      authScopes: { permission: "returns.manage" },
      args: { returnNo: t.arg.string({ required: true }) },
      resolve: (_p, { returnNo }) => scheduleReturnPickup(returnNo),
    }),

    markReturnReceived: t.field({
      type: ReturnRef,
      authScopes: { permission: "returns.manage" },
      args: { returnNo: t.arg.string({ required: true }), note: t.arg.string({ required: false }) },
      resolve: (_p, { returnNo, note }) => markReturnReceived(returnNo, note ?? ""),
    }),

    refundReturn: t.field({
      type: ReturnRef,
      authScopes: { permission: "returns.manage" },
      args: { returnNo: t.arg.string({ required: true }), amount: t.arg.float({ required: true }) },
      resolve: (_p, { returnNo, amount }) => refundReturn(returnNo, amount),
    }),
  }));
}
