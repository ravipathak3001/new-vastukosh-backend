import { nanoid } from "nanoid";
import { logger } from "../../config/logger.js";
import { badInput, notFound } from "../../shared/errors.js";
import { UserModel, type UserDoc } from "../auth/auth.model.js";
import { getMediaStorage } from "../media/media.storage.js";
import { sniffImageType } from "../media/media.service.js";

/** The website shrinks photos to 512 px before uploading, so real uploads are ~50–150 KB. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" } as const;

/** Best effort: a leftover file is harmless, a failed profile update is not. */
async function deleteStoredAvatar(user: Pick<UserDoc, "avatarKey" | "avatarStorage">): Promise<void> {
  if (!user.avatarKey) return;
  const storage = getMediaStorage();
  if (storage.name !== user.avatarStorage) return;
  await storage.remove(user.avatarKey).catch((err) => logger.warn({ err, key: user.avatarKey }, "Old avatar not deleted"));
}

/**
 * Store a new profile picture for `userId` and point their account at it.
 * Customer uploads don't go into the admin's media library — they live under
 * `avatars/` with the user id in the name, and the previous one is deleted.
 */
export async function setAvatar(userId: string, body: Buffer): Promise<UserDoc> {
  if (!body?.length) throw badInput("The file is empty");
  if (body.length > AVATAR_MAX_BYTES) throw badInput("Profile photos must be 5 MB or smaller");
  const type = sniffImageType(body);
  if (!type) throw badInput("Only JPG, PNG, WebP, GIF or AVIF images can be used");

  const user = await UserModel.findById(userId);
  if (!user) throw notFound("User");

  const storage = getMediaStorage();
  const stored = await storage.put({ key: `avatars/${userId}-${nanoid(8)}`, ext: EXT[type], contentType: type, body });
  const previous = { avatarKey: user.avatarKey, avatarStorage: user.avatarStorage };

  user.avatarUrl = stored.url;
  user.avatarKey = stored.storageKey;
  user.avatarStorage = storage.name;
  try {
    await user.save();
  } catch (err) {
    await storage.remove(stored.storageKey).catch(() => undefined);
    throw err;
  }
  await deleteStoredAvatar(previous);
  return user;
}

export async function removeAvatar(userId: string): Promise<UserDoc> {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound("User");
  const previous = { avatarKey: user.avatarKey, avatarStorage: user.avatarStorage };
  user.avatarUrl = "";
  user.avatarKey = "";
  user.avatarStorage = "";
  await user.save();
  await deleteStoredAvatar(previous);
  return user;
}
