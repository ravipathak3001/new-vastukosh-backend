import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import { unauthenticated } from "../../shared/errors.js";
import { getUserById } from "../auth/auth.service.js";
import type { UserDoc } from "../auth/auth.model.js";
import {
  addAddress,
  removeAddress,
  setBirthDetails,
  updateAddress,
  updateProfile,
} from "./user.service.js";

// Address subdocument
type AddressShape = UserDoc["addresses"][number];
export const AddressRef = builder.objectRef<AddressShape>("Address").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (a) => String((a as any)._id) }),
    label: t.exposeString("label", { nullable: true }),
    firstName: t.exposeString("firstName"),
    lastName: t.exposeString("lastName"),
    line1: t.exposeString("line1"),
    line2: t.exposeString("line2"),
    city: t.exposeString("city"),
    state: t.exposeString("state"),
    pincode: t.exposeString("pincode"),
    phone: t.exposeString("phone"),
    isDefault: t.exposeBoolean("isDefault"),
  }),
});

const BirthDetailsRef = builder
  .objectRef<NonNullable<UserDoc["birthDetails"]>>("BirthDetails")
  .implement({
    fields: (t) => ({
      date: t.exposeString("date"),
      time: t.exposeString("time"),
      place: t.exposeString("place"),
      rashiSlug: t.exposeString("rashiSlug"),
    }),
  });

export const UserRef = builder.objectRef<UserDoc>("User").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (u) => String(u._id) }),
    email: t.exposeString("email"),
    name: t.exposeString("name"),
    phone: t.exposeString("phone"),
    roles: t.exposeStringList("roles"),
    localePref: t.exposeString("localePref"),
    karmaPoints: t.exposeInt("karmaPoints"),
    referralCode: t.exposeString("referralCode"),
    emailVerified: t.exposeBoolean("emailVerified"),
    birthDetails: t.field({
      type: BirthDetailsRef,
      nullable: true,
      resolve: (u) => u.birthDetails ?? null,
    }),
    addresses: t.field({ type: [AddressRef], resolve: (u) => u.addresses as any }),
    createdAt: t.field({ type: "DateTime", resolve: (u) => (u as any).createdAt }),
  }),
});

const AddressInputRef = builder.inputType("AddressInput", {
  fields: (t) => ({
    label: t.string({ required: false }),
    firstName: t.string({ required: true }),
    lastName: t.string({ required: false }),
    line1: t.string({ required: true }),
    line2: t.string({ required: false }),
    city: t.string({ required: true }),
    state: t.string({ required: true }),
    pincode: t.string({ required: true }),
    phone: t.string({ required: false }),
    isDefault: t.boolean({ required: false }),
  }),
});

function requireUser(ctx: { user: { id: string } | null }): string {
  if (!ctx.user) throw unauthenticated();
  return ctx.user.id;
}

export function registerUserModule() {
  builder.mutationFields((t) => ({
    updateProfile: t.field({
      type: UserRef,
      authScopes: { loggedIn: true },
      args: {
        name: t.arg.string({ required: false }),
        phone: t.arg.string({ required: false }),
        localePref: t.arg.string({ required: false }),
      },
      resolve: (_p, args, ctx) =>
        updateProfile(requireUser(ctx), {
          name: args.name ?? undefined,
          phone: args.phone ?? undefined,
          localePref: (args.localePref as "en" | "hi") ?? undefined,
        }),
    }),

    setBirthDetails: t.field({
      type: UserRef,
      authScopes: { loggedIn: true },
      args: {
        date: t.arg.string({ required: true }),
        time: t.arg.string({ required: false }),
        place: t.arg.string({ required: false }),
        rashiSlug: t.arg.string({ required: false }),
      },
      resolve: (_p, args, ctx) =>
        setBirthDetails(requireUser(ctx), {
          date: args.date,
          time: args.time ?? undefined,
          place: args.place ?? undefined,
          rashiSlug: args.rashiSlug ?? undefined,
        }),
    }),

    addAddress: t.field({
      type: UserRef,
      authScopes: { loggedIn: true },
      args: { input: t.arg({ type: AddressInputRef, required: true }) },
      resolve: (_p, { input }, ctx) => addAddress(requireUser(ctx), input),
    }),

    updateAddress: t.field({
      type: UserRef,
      authScopes: { loggedIn: true },
      args: {
        addressId: t.arg.id({ required: true }),
        input: t.arg({ type: AddressInputRef, required: true }),
      },
      resolve: (_p, { addressId, input }, ctx) =>
        updateAddress(requireUser(ctx), String(addressId), input),
    }),

    removeAddress: t.field({
      type: UserRef,
      authScopes: { loggedIn: true },
      args: { addressId: t.arg.id({ required: true }) },
      resolve: (_p, { addressId }, ctx) =>
        removeAddress(requireUser(ctx), String(addressId)),
    }),
  }));
}

export { getUserById, LocalizedStringRef };
