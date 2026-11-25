import { nanoid } from "nanoid";
import { Types, type Model } from "mongoose";
import { env } from "../../config/env.js";
import { badInput, conflict, notFound } from "../../shared/errors.js";
import { paged, resolvePaging, searchRegex, type PageArgs, type Paged } from "../../graphql/admin-common.js";
import { ProductModel } from "../catalog/product.model.js";
import { CollectionModel } from "../catalog/collection.model.js";
import { RashiModel } from "../catalog/rashi.model.js";
import { TestimonialModel } from "../content/content.model.js";
import { DailyCardModel, DailyMantraModel, DailyVastuTipModel } from "../daily/daily.model.js";
import { PoojaServiceModel } from "../consultation/consultation.model.js";
import { ExpertProfileModel } from "../expert/expert.model.js";
import { MEDIA_FOLDERS, MediaAssetModel, type MediaAssetDoc, type MediaFolder } from "./media.model.js";
import { getMediaStorage } from "./media.storage.js";

// ─── File checks ──────────────────────────────────────────────────────────

/**
 * Raster images and common audio formats (mantra recordings). SVG is
 * deliberately excluded: it can carry script, and these files are served from
 * a domain the site trusts.
 */
const IMAGE_FORMATS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
} as const;
const AUDIO_FORMATS = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
} as const;
const FORMATS = { ...IMAGE_FORMATS, ...AUDIO_FORMATS } as const;
type ImageType = keyof typeof IMAGE_FORMATS;
type AudioType = keyof typeof AUDIO_FORMATS;
export type MediaType = ImageType | AudioType;

export const ACCEPTED_IMAGE_TYPES = Object.keys(IMAGE_FORMATS) as ImageType[];
export const ACCEPTED_AUDIO_TYPES = Object.keys(AUDIO_FORMATS) as AudioType[];
export const ACCEPTED_MEDIA_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_AUDIO_TYPES];

export const isAudioType = (type: string): type is AudioType => type.startsWith("audio/");

/** Largest upload allowed for this kind of file, in bytes. */
export function maxBytesFor(type: MediaType): number {
  return (isAudioType(type) ? env.MEDIA_MAX_AUDIO_MB : env.MEDIA_MAX_MB) * 1024 * 1024;
}

/** Identify the format from the file's own bytes — the browser-sent Content-Type is only a hint. */
export function sniffImageType(buf: Buffer): ImageType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (buf.toString("ascii", 4, 8) === "ftyp" && /^avi[fs]$/.test(buf.toString("ascii", 8, 12))) return "image/avif";
  return null;
}

/** Audio format from the file's own bytes, or null. */
export function sniffAudioType(buf: Buffer): AudioType | null {
  if (buf.length < 12) return null;
  if (buf.toString("ascii", 0, 3) === "ID3") return "audio/mpeg";
  // Bare MPEG frame sync; layer bits 00 would be AAC/ADTS, which we don't accept.
  if (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0 && ((buf[1]! >> 1) & 0x03) !== 0) return "audio/mpeg";
  if (buf.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE") return "audio/wav";
  if (buf.toString("ascii", 4, 8) === "ftyp" && /^(M4A |M4B |mp42|isom)$/.test(buf.toString("ascii", 8, 12))) {
    return "audio/mp4";
  }
  return null;
}

export function sniffMediaType(buf: Buffer): MediaType | null {
  return sniffImageType(buf) ?? sniffAudioType(buf);
}

/** Pixel size from the file header (best effort — null when the layout isn't recognised). */
export function imageDimensions(buf: Buffer, type: ImageType): { width: number; height: number } | null {
  try {
    switch (type) {
      case "image/png":
        return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
      case "image/gif":
        return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
      case "image/webp": {
        const chunk = buf.toString("ascii", 12, 16);
        if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
        if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
        if (chunk === "VP8L") {
          const b = buf.readUInt32LE(21);
          return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
        }
        return null;
      }
      case "image/jpeg": {
        // Walk the segments to the first start-of-frame marker.
        let i = 2;
        while (i + 9 < buf.length) {
          if (buf[i] !== 0xff) return null;
          const marker = buf[i + 1]!;
          const len = buf.readUInt16BE(i + 2);
          const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
          if (isSof) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
          i += 2 + len;
        }
        return null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function slugifyName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const slug = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "image";
}

export function isMediaFolder(value: string): value is MediaFolder {
  return (MEDIA_FOLDERS as readonly string[]).includes(value);
}

// ─── Upload ───────────────────────────────────────────────────────────────

export type UploadInput = {
  body: Buffer;
  filename: string;
  folder?: string | null;
  alt?: string | null;
  uploadedBy?: string | null;
};

export async function uploadMedia(input: UploadInput): Promise<MediaAssetDoc> {
  if (!input.body?.length) throw badInput("The file is empty");

  const type = sniffMediaType(input.body);
  if (!type) {
    throw badInput("Only JPG, PNG, WebP, GIF or AVIF images, or MP3, M4A, OGG or WAV audio, can be uploaded");
  }
  if (input.body.length > maxBytesFor(type)) {
    throw badInput(
      isAudioType(type)
        ? `Audio files must be ${env.MEDIA_MAX_AUDIO_MB} MB or smaller`
        : `Images must be ${env.MEDIA_MAX_MB} MB or smaller`,
    );
  }

  const folder = input.folder?.trim() || "general";
  if (!isMediaFolder(folder)) throw badInput(`Unknown folder "${folder}"`);

  const filename = (input.filename || "image").trim().slice(0, 200);
  const ext = FORMATS[type];
  const key = `${folder}/${nanoid(10)}-${slugifyName(filename)}`;

  const storage = getMediaStorage();
  const stored = await storage.put({ key, ext, contentType: type, body: input.body });
  const dims = isAudioType(type) ? null : imageDimensions(input.body, type);

  try {
    return await MediaAssetModel.create({
      storageKey: stored.storageKey,
      storage: storage.name,
      url: stored.url,
      filename,
      contentType: type,
      size: input.body.length,
      width: stored.width ?? dims?.width ?? null,
      height: stored.height ?? dims?.height ?? null,
      folder,
      alt: input.alt?.trim() ?? "",
      uploadedBy: input.uploadedBy ?? null,
    });
  } catch (err) {
    // Don't leave an orphaned file the library can't see.
    await storage.remove(stored.storageKey, type).catch(() => undefined);
    throw err;
  }
}

// ─── Library ──────────────────────────────────────────────────────────────

export type MediaListArgs = PageArgs & {
  search?: string | null;
  folder?: string | null;
  /** Only images or only audio. */
  kind?: "image" | "audio" | null;
};

export async function listMedia(args: MediaListArgs): Promise<Paged<MediaAssetDoc>> {
  const paging = resolvePaging(args);
  const filter: Record<string, unknown> = {};
  if (args.folder) filter.folder = args.folder;
  if (args.kind) filter.contentType = new RegExp(`^${args.kind}/`);
  if (args.search?.trim()) {
    const re = searchRegex(args.search);
    filter.$or = [{ filename: re }, { alt: re }, { url: re }];
  }
  const [items, total] = await Promise.all([
    MediaAssetModel.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit),
    MediaAssetModel.countDocuments(filter),
  ]);
  return paged(items, total, paging);
}

export async function getMedia(id: string): Promise<MediaAssetDoc | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return MediaAssetModel.findById(id);
}

export async function updateMedia(
  id: string,
  patch: { alt?: string | null; folder?: string | null; filename?: string | null },
): Promise<MediaAssetDoc> {
  const asset = await MediaAssetModel.findById(id);
  if (!asset) throw notFound("Image");
  if (patch.alt != null) asset.alt = patch.alt.trim();
  if (patch.filename != null) {
    const name = patch.filename.trim();
    if (!name) throw badInput("The name can't be empty");
    asset.filename = name.slice(0, 200);
  }
  if (patch.folder != null) {
    if (!isMediaFolder(patch.folder)) throw badInput(`Unknown folder "${patch.folder}"`);
    // The file's URL doesn't change — the folder is just a library label.
    asset.folder = patch.folder;
  }
  await asset.save();
  return asset;
}

// ─── Where an image is used ───────────────────────────────────────────────

export type MediaUsage = { kind: string; label: string; ref: string };

type Localized = { en?: string | null } | null | undefined;
type UsageSource = {
  kind: string;
  model: Model<any>;
  fields: string[];
  select: string;
  label: (doc: any) => string;
  ref: (doc: any) => string;
};

const USAGE_SOURCES: UsageSource[] = [
  {
    kind: "Product",
    model: ProductModel,
    fields: ["image", "gallery"],
    select: "slug name",
    label: (d) => (d.name as Localized)?.en || d.slug,
    ref: (d) => d.slug,
  },
  {
    kind: "Collection",
    model: CollectionModel,
    fields: ["heroImage"],
    select: "slug title",
    label: (d) => (d.title as Localized)?.en || d.slug,
    ref: (d) => d.slug,
  },
  {
    kind: "Rashi",
    model: RashiModel,
    fields: ["image"],
    select: "slug name",
    label: (d) => (d.name as Localized)?.en || d.slug,
    ref: (d) => d.slug,
  },
  {
    kind: "Testimonial",
    model: TestimonialModel,
    fields: ["image"],
    select: "name",
    label: (d) => d.name,
    ref: (d) => String(d._id),
  },
  {
    kind: "Daily card",
    model: DailyCardModel,
    fields: ["imageUrl"],
    select: "key title",
    label: (d) => (d.title as Localized)?.en || d.key,
    ref: (d) => String(d._id),
  },
  {
    kind: "Daily mantra",
    model: DailyMantraModel,
    fields: ["audioUrl", "artwork"],
    select: "key title",
    label: (d) => (d.title as Localized)?.en || d.key,
    ref: (d) => String(d._id),
  },
  {
    kind: "Vastu tip",
    model: DailyVastuTipModel,
    fields: ["image"],
    select: "key title",
    label: (d) => (d.title as Localized)?.en || d.key,
    ref: (d) => String(d._id),
  },
  {
    kind: "Pooja",
    model: PoojaServiceModel,
    fields: ["image"],
    select: "slug name",
    label: (d) => (d.name as Localized)?.en || d.slug,
    ref: (d) => d.slug,
  },
  {
    kind: "Expert",
    model: ExpertProfileModel,
    fields: ["photoUrl"],
    select: "displayName",
    label: (d) => d.displayName,
    ref: (d) => String(d._id),
  },
];

/** Every catalog / content record that points at this URL (exact match). */
export async function findMediaUsage(url: string): Promise<MediaUsage[]> {
  const results = await Promise.all(
    USAGE_SOURCES.map(async (src) => {
      const docs = await src.model
        .find({ $or: src.fields.map((f) => ({ [f]: url })) })
        .select(src.select)
        .limit(50)
        .lean();
      return docs.map((d) => ({ kind: src.kind, label: src.label(d), ref: src.ref(d) }));
    }),
  );
  return results.flat();
}

/**
 * Delete the library entry and the stored file. Refuses while something on
 * the site still shows the image, unless `force` — a deleted file is a broken
 * image for customers.
 */
export async function deleteMedia(id: string, force = false): Promise<boolean> {
  const asset = await MediaAssetModel.findById(id);
  if (!asset) throw notFound("Image");

  if (!force) {
    const usage = await findMediaUsage(asset.url);
    if (usage.length > 0) {
      const names = usage.slice(0, 3).map((u) => `${u.kind} "${u.label}"`).join(", ");
      throw conflict(
        `This image is still used by ${names}${usage.length > 3 ? ` and ${usage.length - 3} more` : ""}`,
      );
    }
  }

  // Only the provider that stored it can delete it (e.g. local files after switching to Cloudinary).
  const storage = getMediaStorage();
  if (storage.name === asset.storage) await storage.remove(asset.storageKey, asset.contentType);
  await asset.deleteOne();
  return true;
}
