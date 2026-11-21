import express, { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { isProd } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { verifyAccessToken } from "../../shared/auth/jwt.js";
import { AppError } from "../../shared/errors.js";
import { AVATAR_MAX_BYTES, setAvatar } from "./avatar.service.js";

export const avatarRouter = Router();

function sendError(res: Response, err: AppError) {
  const status = (err.extensions.http as { status?: number } | undefined)?.status ?? 400;
  res.status(status).json({ error: { code: err.code, message: err.message } });
}

/**
 * `POST /me/avatar` — the signed-in user's own profile picture, raw image as
 * the body (same convention as `/media/upload`). Any logged-in user; it can
 * only ever change the caller's own account. Responds `{ avatarUrl }`.
 */
avatarRouter.post(
  "/me/avatar",
  rateLimit({ windowMs: 60_000, limit: isProd ? 10 : 1000, standardHeaders: true, legacyHeaders: false }),
  (req: Request, res: Response, next: NextFunction) => {
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");
    const payload = scheme?.toLowerCase() === "bearer" && token ? verifyAccessToken(token) : null;
    if (!payload) return sendError(res, new AppError("UNAUTHENTICATED", "Authentication required"));
    res.locals.userId = payload.sub;
    next();
  },
  express.raw({ type: () => true, limit: AVATAR_MAX_BYTES }),
  async (req, res) => {
    try {
      const user = await setAvatar(res.locals.userId as string, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
      res.json({ avatarUrl: user.avatarUrl });
    } catch (err) {
      if ((err as AppError)?.code) return sendError(res, err as AppError);
      logger.error({ err }, "Avatar upload failed");
      sendError(res, new AppError("INTERNAL", "Upload failed — try again"));
    }
  },
);

avatarRouter.use("/me/avatar", (err: { type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === "entity.too.large") return sendError(res, new AppError("BAD_INPUT", "Profile photos must be 5 MB or smaller"));
  next(err);
});
