import { builder } from "../../graphql/builder.js";
import { resolvePaging, paged, type Paged } from "../../graphql/admin-common.js";
import { OrderModel, type OrderDoc } from "./order.model.js";
import { OrderRef, OrderStatusEnum } from "./order.schema.js";
import {
  listOrdersForAdmin,
  refundOrder,
  type AdminOrderSort,
} from "./order.service.js";

const AdminOrderSortEnum = builder.enumType("AdminOrderSort", {
  values: ["newest", "oldest", "total_desc", "total_asc"] as const,
});

const AdminOrderFilter = builder.inputType("AdminOrderFilter", {
  fields: (t) => ({
    status: t.field({ type: OrderStatusEnum, required: false }),
    search: t.string({ required: false }),
    dateFrom: t.string({ required: false }),
    dateTo: t.string({ required: false }),
    verified: t.boolean({ required: false }),
  }),
});

const AdminOrderPage = builder
  .objectRef<Paged<OrderDoc>>("AdminOrderPage")
  .implement({
    fields: (t) => ({
      items: t.field({ type: [OrderRef], resolve: (p) => p.items }),
      total: t.exposeInt("total"),
      page: t.exposeInt("page"),
      pageSize: t.exposeInt("pageSize"),
    }),
  });

export function registerOrderAdminModule() {
  builder.queryFields((t) => ({
    adminOrders: t.field({
      type: AdminOrderPage,
      authScopes: { permission: "orders.view" },
      args: {
        filter: t.arg({ type: AdminOrderFilter, required: false }),
        sort: t.arg({ type: AdminOrderSortEnum, required: false }),
        page: t.arg.int({ required: false }),
        pageSize: t.arg.int({ required: false }),
      },
      resolve: async (_p, args) => {
        const { page, pageSize, skip, limit } = resolvePaging(args);
        const { items, total } = await listOrdersForAdmin(
          {
            status: args.filter?.status ?? null,
            search: args.filter?.search ?? null,
            dateFrom: args.filter?.dateFrom ?? null,
            dateTo: args.filter?.dateTo ?? null,
            verified: args.filter?.verified ?? null,
          },
          skip,
          limit,
          (args.sort ?? "newest") as AdminOrderSort,
        );
        return paged(items, total, { page, pageSize });
      },
    }),

    adminOrder: t.field({
      type: OrderRef,
      nullable: true,
      authScopes: { permission: "orders.view" },
      args: { orderNo: t.arg.string({ required: true }) },
      resolve: (_p, { orderNo }) => OrderModel.findOne({ orderNo }),
    }),
  }));

  builder.mutationFields((t) => ({
    // Status moves reuse the existing admin `advanceOrderStatus` mutation.
    refundOrder: t.field({
      type: OrderRef,
      authScopes: { permission: "orders.manage" },
      args: {
        orderNo: t.arg.string({ required: true }),
        note: t.arg.string({ required: false }),
      },
      resolve: (_p, { orderNo, note }) => refundOrder(orderNo, note ?? ""),
    }),
  }));
}
