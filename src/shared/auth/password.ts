import bcrypt from "bcryptjs";

/**
 * Password hashing is isolated here so the algorithm can be swapped (e.g. to
 * argon2id) without touching call sites. bcrypt is used for zero native-build
 * friction; cost 12 is a sensible 2020s default.
 */
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
