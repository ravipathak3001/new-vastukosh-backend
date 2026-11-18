import crypto from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/errors.js";

export type StoredFile = {
  storageKey: string;
  url: string;
  width?: number | null;
  height?: number | null;
};

export type PutFileInput = {
  /** Provider-neutral key without extension, e.g. `products/x1y2z3-rudraksha`. */
  key: string;
  ext: string;
  contentType: string;
  body: Buffer;
};

/**
 * Where uploaded image bytes live. Swappable like the payment / shipping
 * providers: `local` for development, `cloudinary` for production.
 */
export interface MediaStorage {
  readonly name: "local" | "cloudinary";
  put(input: PutFileInput): Promise<StoredFile>;
  remove(storageKey: string): Promise<void>;
}

// ─── Local disk ───────────────────────────────────────────────────────────

/** Absolute directory local uploads are written to (and served from at `/uploads`). */
export function localMediaDir(): string {
  return path.resolve(env.MEDIA_LOCAL_DIR);
}

function localPublicBase(): string {
  return (env.MEDIA_PUBLIC_URL ?? `http://localhost:${env.PORT}/uploads`).replace(/\/+$/, "");
}

export class LocalMediaStorage implements MediaStorage {
  readonly name = "local" as const;

  constructor(
    private readonly dir = localMediaDir(),
    private readonly publicBase = localPublicBase(),
  ) {}

  async put({ key, ext, body }: PutFileInput): Promise<StoredFile> {
    const storageKey = `${key}.${ext}`;
    const target = this.resolve(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body, { flag: "wx" });
    return { storageKey, url: `${this.publicBase}/${storageKey}` };
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.resolve(storageKey), { force: true });
  }

  /** Keys are generated server-side, but never let one escape the uploads dir. */
  private resolve(storageKey: string): string {
    const target = path.resolve(this.dir, storageKey);
    if (!target.startsWith(this.dir + path.sep)) throw new Error("Invalid media key");
    return target;
  }
}

// ─── Cloudinary (signed REST API — no SDK needed) ─────────────────────────

type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string; folder: string };

/** Cloudinary signature: sorted `k=v` pairs joined by `&`, then the secret, SHA-1 hex. */
export function cloudinarySignature(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export class CloudinaryMediaStorage implements MediaStorage {
  readonly name = "cloudinary" as const;

  constructor(private readonly config: CloudinaryConfig) {}

  private endpoint(action: "upload" | "destroy"): string {
    return `https://api.cloudinary.com/v1_1/${encodeURIComponent(this.config.cloudName)}/image/${action}`;
  }

  private signed(params: Record<string, string>): FormData {
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) form.set(k, v);
    form.set("api_key", this.config.apiKey);
    form.set("signature", cloudinarySignature(params, this.config.apiSecret));
    return form;
  }

  async put({ key, contentType, body }: PutFileInput): Promise<StoredFile> {
    const form = this.signed({
      public_id: `${this.config.folder}/${key}`,
      overwrite: "false",
      timestamp: String(Math.floor(Date.now() / 1000)),
    });
    form.set("file", new Blob([new Uint8Array(body)], { type: contentType }), "upload");

    const res = await fetch(this.endpoint("upload"), { method: "POST", body: form });
    const json = (await res.json().catch(() => ({}))) as {
      public_id?: string;
      secure_url?: string;
      width?: number;
      height?: number;
      error?: { message?: string };
    };
    if (!res.ok || !json.public_id || !json.secure_url) {
      logger.error({ status: res.status, error: json.error }, "Cloudinary upload failed");
      throw new AppError("INTERNAL", `Image storage rejected the upload${json.error?.message ? `: ${json.error.message}` : ""}`);
    }
    return { storageKey: json.public_id, url: json.secure_url, width: json.width, height: json.height };
  }

  async remove(storageKey: string): Promise<void> {
    const form = this.signed({
      invalidate: "true",
      public_id: storageKey,
      timestamp: String(Math.floor(Date.now() / 1000)),
    });
    const res = await fetch(this.endpoint("destroy"), { method: "POST", body: form });
    const json = (await res.json().catch(() => ({}))) as { result?: string };
    // "not found" = already gone, which is the outcome we wanted.
    if (!res.ok || (json.result !== "ok" && json.result !== "not found")) {
      logger.error({ status: res.status, result: json.result, storageKey }, "Cloudinary delete failed");
      throw new AppError("INTERNAL", "Couldn't delete the image from storage — try again");
    }
  }
}

// ─── Selection ────────────────────────────────────────────────────────────

let instance: MediaStorage | null = null;

export function getMediaStorage(): MediaStorage {
  if (instance) return instance;
  instance =
    env.MEDIA_STORAGE === "cloudinary"
      ? new CloudinaryMediaStorage({
          cloudName: env.CLOUDINARY_CLOUD_NAME ?? "",
          apiKey: env.CLOUDINARY_API_KEY ?? "",
          apiSecret: env.CLOUDINARY_API_SECRET ?? "",
          folder: env.CLOUDINARY_FOLDER,
        })
      : new LocalMediaStorage();
  return instance;
}

/** Tests swap in an in-memory provider. */
export function setMediaStorage(storage: MediaStorage | null): void {
  instance = storage;
}
