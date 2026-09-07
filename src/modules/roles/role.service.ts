import { badInput, conflict, notFound } from "../../shared/errors.js";
import { UserModel, type UserDoc } from "../auth/auth.model.js";
import { ALL_PERMISSION_KEYS, isPermissionKey, type PermissionKey } from "./permission-catalog.js";
import { RoleModel, type RoleDoc } from "./role.model.js";

/**
 * A user in `roles: ["admin"]` with no custom roles assigned gets every
 * permission — the fallback that keeps the currently-seeded admin (and
 * anyone promoted the old way, via `setUserRoles`) fully working the moment
 * this ships, with zero migration step required.
 */
export async function computeUserPermissions(user: UserDoc): Promise<PermissionKey[]> {
  if (!user.roles.includes("admin")) return [];
  if (user.roleIds.length === 0) return ALL_PERMISSION_KEYS;

  const roles = await RoleModel.find({ _id: { $in: user.roleIds } });
  const perms = new Set<PermissionKey>();
  for (const role of roles) {
    for (const p of role.permissions) if (isPermissionKey(p)) perms.add(p);
  }
  return [...perms];
}

export async function listRoles(): Promise<RoleDoc[]> {
  return RoleModel.find().sort({ isSystem: -1, name: 1 });
}

function assertValidPermissions(permissions: string[]): PermissionKey[] {
  const invalid = permissions.filter((p) => !isPermissionKey(p));
  if (invalid.length > 0) throw badInput(`Unknown permission(s): ${invalid.join(", ")}`);
  return permissions as PermissionKey[];
}

export async function createRole(name: string, permissions: string[]): Promise<RoleDoc> {
  const trimmed = name.trim();
  if (!trimmed) throw badInput("Role name is required");
  if (await RoleModel.exists({ name: trimmed })) {
    throw conflict(`A role named "${trimmed}" already exists`);
  }
  return RoleModel.create({ name: trimmed, permissions: assertValidPermissions(permissions) });
}

export async function updateRole(
  id: string,
  patch: { name?: string; permissions?: string[] },
): Promise<RoleDoc> {
  const role = await RoleModel.findById(id);
  if (!role) throw notFound("Role");
  if (role.isSystem) throw badInput("The Super Admin role can't be edited");

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw badInput("Role name is required");
    role.name = trimmed;
  }
  if (patch.permissions !== undefined) {
    role.permissions = assertValidPermissions(patch.permissions);
  }
  await role.save();
  return role;
}

export async function deleteRole(id: string): Promise<void> {
  const role = await RoleModel.findById(id);
  if (!role) throw notFound("Role");
  if (role.isSystem) throw badInput("The Super Admin role can't be deleted");

  const inUse = await UserModel.countDocuments({ roleIds: role._id });
  if (inUse > 0) {
    throw badInput(`${inUse} user(s) still have this role — reassign them first`);
  }
  await role.deleteOne();
}

/** Ensures the seeded system role exists; called once at boot and from the seed script. */
export async function ensureSuperAdminRole(): Promise<RoleDoc> {
  return RoleModel.findOneAndUpdate(
    { isSystem: true },
    { $setOnInsert: { name: "Super Admin", permissions: ALL_PERMISSION_KEYS, isSystem: true } },
    { new: true, upsert: true },
  );
}

export async function assignUserRoles(userId: string, roleIds: string[]): Promise<UserDoc> {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound("User");
  if (!user.roles.includes("admin")) {
    throw badInput("Only admin-panel users can be assigned custom roles");
  }

  if (roleIds.length > 0) {
    const found = await RoleModel.countDocuments({ _id: { $in: roleIds } });
    if (found !== new Set(roleIds).size) throw badInput("One or more roles don't exist");
  }

  user.roleIds = roleIds as never;
  await user.save();
  return user;
}
