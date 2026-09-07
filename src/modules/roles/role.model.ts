import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";
import { ALL_PERMISSION_KEYS } from "./permission-catalog.js";

/**
 * Admin-created role: a name plus a set of permission keys. `isSystem` marks
 * the seeded "Super Admin" role, which always holds every permission and
 * can't be edited or deleted — the safety net that keeps existing admins from
 * ever being locked out (see `role.service.ts#computeUserPermissions`).
 */
const roleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    permissions: { type: [String], enum: ALL_PERMISSION_KEYS, default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type Role = InferSchemaType<typeof roleSchema>;
export type RoleDoc = HydratedDocument<Role>;
export const RoleModel = defineModel("Role", roleSchema);
