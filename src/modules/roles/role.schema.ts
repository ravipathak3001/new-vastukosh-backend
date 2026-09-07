import { builder } from "../../graphql/builder.js";
import { UserRef } from "../user/user.schema.js";
import { PERMISSION_CATALOG } from "./permission-catalog.js";
import { RoleModel, type RoleDoc } from "./role.model.js";
import {
  assignUserRoles,
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from "./role.service.js";

const PermissionInfoRef = builder
  .objectRef<(typeof PERMISSION_CATALOG)[number]>("PermissionInfo")
  .implement({
    fields: (t) => ({
      key: t.exposeString("key"),
      category: t.exposeString("category"),
      label: t.exposeString("label"),
    }),
  });

// Named "AdminRole" in the schema — the "Role" GraphQL type name is already
// taken by the coarse customer/admin enum in `modules/admin/admin.schema.ts`.
export const RoleRef = builder.objectRef<RoleDoc>("AdminRole").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (r) => String(r._id) }),
    name: t.exposeString("name"),
    permissions: t.exposeStringList("permissions"),
    isSystem: t.exposeBoolean("isSystem"),
  }),
});

builder.objectField(UserRef, "customRoles", (t) =>
  t.field({
    type: [RoleRef],
    authScopes: { permission: "users.view" },
    resolve: async (u) => RoleModel.find({ _id: { $in: u.roleIds } }),
  }),
);

const RoleInput = builder.inputType("AdminRoleInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    permissions: t.stringList({ required: true }),
  }),
});

export function registerRoleModule() {
  builder.queryFields((t) => ({
    permissionCatalog: t.field({
      type: [PermissionInfoRef],
      authScopes: { permission: "roles.manage" },
      resolve: () => PERMISSION_CATALOG,
    }),

    adminRoles: t.field({
      type: [RoleRef],
      authScopes: { permission: "roles.manage" },
      resolve: () => listRoles(),
    }),
  }));

  builder.mutationFields((t) => ({
    createRole: t.field({
      type: RoleRef,
      authScopes: { permission: "roles.manage" },
      args: { input: t.arg({ type: RoleInput, required: true }) },
      resolve: (_p, { input }) => createRole(input.name, input.permissions),
    }),

    updateRole: t.field({
      type: RoleRef,
      authScopes: { permission: "roles.manage" },
      args: {
        id: t.arg.id({ required: true }),
        name: t.arg.string({ required: false }),
        permissions: t.arg.stringList({ required: false }),
      },
      resolve: (_p, { id, name, permissions }) =>
        updateRole(String(id), {
          name: name ?? undefined,
          permissions: permissions ?? undefined,
        }),
    }),

    deleteRole: t.field({
      type: "Boolean",
      authScopes: { permission: "roles.manage" },
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_p, { id }) => {
        await deleteRole(String(id));
        return true;
      },
    }),

    assignUserRoles: t.field({
      type: UserRef,
      authScopes: { permission: "roles.manage" },
      args: {
        userId: t.arg.id({ required: true }),
        roleIds: t.arg({ type: ["ID"], required: true }),
      },
      resolve: (_p, { userId, roleIds }) =>
        assignUserRoles(String(userId), roleIds.map(String)),
    }),
  }));
}
