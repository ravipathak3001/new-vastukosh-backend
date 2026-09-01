import { notFound } from "../../shared/errors.js";
import { UserModel, type UserDoc } from "../auth/auth.model.js";

export type ProfileInput = {
  name?: string;
  phone?: string;
  localePref?: "en" | "hi";
};

export async function updateProfile(userId: string, input: ProfileInput): Promise<UserDoc> {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound("User");
  if (input.name !== undefined) user.name = input.name.trim();
  if (input.phone !== undefined) user.phone = input.phone.trim();
  if (input.localePref !== undefined) user.localePref = input.localePref;
  await user.save();
  return user;
}

export type BirthDetailsInput = {
  date: string;
  time?: string;
  place?: string;
  rashiSlug?: string;
};

export async function setBirthDetails(
  userId: string,
  input: BirthDetailsInput,
): Promise<UserDoc> {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound("User");
  user.birthDetails = {
    date: input.date,
    time: input.time ?? "",
    place: input.place ?? "",
    rashiSlug: input.rashiSlug ?? "",
  };
  await user.save();
  return user;
}

export type AddressInput = {
  label?: string | null;
  firstName: string;
  lastName?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  phone?: string | null;
  isDefault?: boolean | null;
};

export async function addAddress(userId: string, input: AddressInput): Promise<UserDoc> {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound("User");
  if (input.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
  user.addresses.push({
    label: input.label ?? "",
    firstName: input.firstName,
    lastName: input.lastName ?? "",
    line1: input.line1,
    line2: input.line2 ?? "",
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    phone: input.phone ?? "",
    isDefault: input.isDefault ?? user.addresses.length === 0,
  });
  await user.save();
  return user;
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: Partial<AddressInput>,
): Promise<UserDoc> {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound("User");
  const address = user.addresses.id(addressId);
  if (!address) throw notFound("Address");
  if (input.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null) {
      (address as unknown as Record<string, unknown>)[key] = value;
    }
  }
  await user.save();
  return user;
}

export async function removeAddress(userId: string, addressId: string): Promise<UserDoc> {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound("User");
  const address = user.addresses.id(addressId);
  if (!address) throw notFound("Address");
  address.deleteOne();
  await user.save();
  return user;
}
