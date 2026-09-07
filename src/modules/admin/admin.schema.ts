import { builder } from "../../graphql/builder.js";
import { resolvePaging, paged, type Paged } from "../../graphql/admin-common.js";
import { UserRef } from "../user/user.schema.js";
import { ROLES, type UserDoc } from "../auth/auth.model.js";
import {
  getDashboardStats,
  getUserForAdmin,
  getUserStats,
  listUsersForAdmin,
  setUserRoles,
  type AdminUserFilter,
} from "./admin.service.js";

const RoleEnum = builder.enumType("Role", { values: ROLES });

// Per-user aggregates — only computed when a query actually selects them
// (the list screen doesn't; the detail screen does).
builder.objectField(UserRef, "orderCount", (t) =>
  t.int({
    authScopes: { permission: "users.view" },
    resolve: async (u) => (await getUserStats(String(u._id))).orderCount,
  }),
);
builder.objectField(UserRef, "totalSpent", (t) =>
  t.float({
    authScopes: { permission: "users.view" },
    resolve: async (u) => (await getUserStats(String(u._id))).totalSpent,
  }),
);
builder.objectField(UserRef, "bookingCount", (t) =>
  t.int({
    authScopes: { permission: "users.view" },
    resolve: async (u) => (await getUserStats(String(u._id))).bookingCount,
  }),
);

const AdminUserFilterInput = builder.inputType("AdminUserFilterInput", {
  fields: (t) => ({
    search: t.string({ required: false }),
    role: t.field({ type: RoleEnum, required: false }),
  }),
});

const AdminUserPage = builder.objectRef<Paged<UserDoc>>("AdminUserPage").implement({
  fields: (t) => ({
    items: t.field({ type: [UserRef], resolve: (p) => p.items }),
    total: t.exposeInt("total"),
    page: t.exposeInt("page"),
    pageSize: t.exposeInt("pageSize"),
  }),
});

const OrderStatusCountRef = builder
  .objectRef<{ status: string; count: number }>("OrderStatusCount")
  .implement({
    fields: (t) => ({
      status: t.exposeString("status"),
      count: t.exposeInt("count"),
    }),
  });

const AdminDashboardStatsRef = builder
  .objectRef<Awaited<ReturnType<typeof getDashboardStats>>>("AdminDashboardStats")
  .implement({
    fields: (t) => ({
      revenueTotal: t.exposeFloat("revenueTotal"),
      revenue30d: t.exposeFloat("revenue30d"),
      ordersTotal: t.exposeInt("ordersTotal"),
      ordersByStatus: t.field({
        type: [OrderStatusCountRef],
        resolve: (s) => s.ordersByStatus,
      }),
      bookingsPending: t.exposeInt("bookingsPending"),
      contactSubmissionsNew: t.exposeInt("contactSubmissionsNew"),
      newsletterCount: t.exposeInt("newsletterCount"),
    }),
  });

export function registerAdminModule() {
  builder.queryFields((t) => ({
    adminUsers: t.field({
      type: AdminUserPage,
      authScopes: { permission: "users.view" },
      args: {
        filter: t.arg({ type: AdminUserFilterInput, required: false }),
        page: t.arg.int({ required: false }),
        pageSize: t.arg.int({ required: false }),
      },
      resolve: async (_p, args) => {
        const { page, pageSize, skip, limit } = resolvePaging(args);
        const filter: AdminUserFilter = {
          search: args.filter?.search ?? null,
          role: args.filter?.role ?? null,
        };
        const { items, total } = await listUsersForAdmin(filter, skip, limit);
        return paged(items, total, { page, pageSize });
      },
    }),

    adminUser: t.field({
      type: UserRef,
      nullable: true,
      authScopes: { permission: "users.view" },
      args: { id: t.arg.id({ required: true }) },
      resolve: (_p, { id }) => getUserForAdmin(String(id)).catch(() => null),
    }),

    adminDashboard: t.field({
      type: AdminDashboardStatsRef,
      authScopes: { permission: "dashboard.view" },
      resolve: () => getDashboardStats(),
    }),
  }));

  builder.mutationFields((t) => ({
    setUserRoles: t.field({
      type: UserRef,
      authScopes: { permission: "users.manage" },
      args: {
        userId: t.arg.id({ required: true }),
        roles: t.arg({ type: [RoleEnum], required: true }),
      },
      resolve: (_p, { userId, roles }, ctx) =>
        setUserRoles(ctx.user!.id, String(userId), roles as never[]),
    }),
  }));
}
