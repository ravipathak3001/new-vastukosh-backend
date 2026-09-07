import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";

export const ROLES = ["customer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const addressSchema = new Schema(
  {
    label: { type: String, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: "" },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: false },
);

const birthDetailsSchema = new Schema(
  {
    date: { type: String, required: true }, // ISO yyyy-mm-dd
    time: { type: String, default: "" }, // HH:mm
    place: { type: String, default: "" },
    rashiSlug: { type: String, default: "" },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    roles: { type: [String], enum: ROLES, default: ["customer"] },
    /**
     * Custom admin-panel roles (see `modules/roles`). Empty means "no custom
     * role configured yet" — `computeUserPermissions` treats that as full
     * access for anyone in `roles: ["admin"]` so nobody is locked out before
     * the owner deliberately assigns scoped roles.
     */
    roleIds: { type: [Schema.Types.ObjectId], ref: "Role", default: [] },
    localePref: { type: String, enum: ["en", "hi"], default: "en" },
    birthDetails: { type: birthDetailsSchema, required: false },
    addresses: { type: [addressSchema], default: [] },
    karmaPoints: { type: Number, default: 0, min: 0 },
    referralCode: { type: String, required: true, unique: true, index: true },
    referredBy: { type: String, default: "" },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = defineModel("User", userSchema);

/**
 * Refresh tokens are stored hashed and rotated on every use. `familyId` groups
 * every token descended from one login; detecting reuse of a revoked token in a
 * family revokes the whole family (stolen-token mitigation).
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
  },
  { timestamps: true },
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;
export type RefreshTokenDoc = HydratedDocument<RefreshToken>;
export const RefreshTokenModel = defineModel("RefreshToken", refreshTokenSchema);

/**
 * One-time, short-lived tokens for the "forgot password" flow. Stored hashed,
 * same as refresh tokens — the raw token only ever exists in the reset email
 * and the client's URL.
 */
const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetToken = InferSchemaType<typeof passwordResetTokenSchema>;
export type PasswordResetTokenDoc = HydratedDocument<PasswordResetToken>;
export const PasswordResetTokenModel = defineModel(
  "PasswordResetToken",
  passwordResetTokenSchema,
);
