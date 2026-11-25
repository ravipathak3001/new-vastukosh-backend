import express, { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { env, isProd } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { verifyAccessToken } from "../../shared/auth/jwt.js";
import { AppError } from "../../shared/errors.js";
import { uploadMedia } from "./media.service.js";
import { localMediaDir } from "./media.storage.js";

export const mediaRouter = Router();

/**
 * `POST /media/upload` — one file per request, the raw file as the body.
 *
 *   Authorization: Bearer <access token with media.manage>
 *   Content-Type:  image/jpeg | png | webp | gif | avif, or audio/mpeg | mp4 | ogg | wav
 *                  (only a hint — the real type is sniffed from the bytes)
 *   X-Filename:    encodeURIComponent(original file name)
 *   ?folder=products&alt=…   (both optional)
 *
 * Responds `201 { asset: { id, url, … } }` or `{ error: { code, message } }`.
 * A raw body (rather than multipart) keeps this dependency-free, and the
 * admin uploads files one by one anyway to show per-file progress.
 */
const uploadLimiter = rateLimit({
  windowMs: 60_000,
  limit: isProd ? 60 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

function sendError(res: Response, err: AppError) {
  const status = (err.extensions.http as { status?: number } | undefined)?.status ?? 400;
  res.status(status).json({ error: { code: err.code, message: err.message } });
}

function requireMediaManager(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  const payload = scheme?.toLowerCase() === "bearer" && token ? verifyAccessToken(token) : null;
  if (!payload) return sendError(res, new AppError("UNAUTHENTICATED", "Authentication required"));
  if (!payload.permissions.includes("media.manage")) {
    return sendError(res, new AppError("FORBIDDEN", "You don't have access to upload media"));
  }
  res.locals.userId = payload.sub;
  next();
}

function decodeHeader(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

mediaRouter.post(
  "/media/upload",
  uploadLimiter,
  requireMediaManager,
  // Ceiling = the larger of the image / audio limits; uploadMedia applies the per-type one.
  express.raw({
    type: () => true,
    limit: Math.ceil(Math.max(env.MEDIA_MAX_MB, env.MEDIA_MAX_AUDIO_MB) * 1024 * 1024),
  }),
  async (req, res) => {
    try {
      const asset = await uploadMedia({
        body: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
        filename: decodeHeader(req.get("x-filename")),
        folder: typeof req.query.folder === "string" ? req.query.folder : null,
        alt: typeof req.query.alt === "string" ? req.query.alt : null,
        uploadedBy: res.locals.userId as string,
      });
      res.status(201).json({
        asset: {
          id: String(asset._id),
          url: asset.url,
          filename: asset.filename,
          contentType: asset.contentType,
          size: asset.size,
          width: asset.width,
          height: asset.height,
          folder: asset.folder,
          alt: asset.alt,
        },
      });
    } catch (err) {
      if (err instanceof AppError || (err as AppError)?.code) return sendError(res, err as AppError);
      logger.error({ err }, "Media upload failed");
      sendError(res, new AppError("INTERNAL", "Upload failed — try again"));
    }
  },
);

// Body over the ceiling → express.raw throws 413 before our handler runs.
mediaRouter.use("/media/upload", (err: { type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === "entity.too.large") {
    const mb = Math.max(env.MEDIA_MAX_MB, env.MEDIA_MAX_AUDIO_MB);
    return sendError(res, new AppError("BAD_INPUT", `Files must be ${mb} MB or smaller`));
  }
  next(err);
});

/**
 * Local-storage files. Names are unique per upload, so they can be cached
 * forever. `cross-origin` lets the website (another origin) embed them —
 * helmet's default `same-origin` would block every <img>.
 */
if (env.MEDIA_STORAGE === "local") {
  mediaRouter.use(
    "/uploads",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Content-Security-Policy", "default-src 'none'");
      next();
    },
    express.static(localMediaDir(), {
      immutable: true,
      maxAge: "365d",
      index: false,
      dotfiles: "deny",
    }),
  );
}
