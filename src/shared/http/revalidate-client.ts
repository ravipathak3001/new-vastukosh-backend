import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

/**
 * Tell the Next.js frontend to drop cached pages after a content change. Fire and
 * forget — a revalidation failure must never break the write that triggered it.
 */
export async function notifyFrontendRevalidate(tags: string[]): Promise<void> {
  if (!env.FRONTEND_REVALIDATE_URL || !env.REVALIDATE_SECRET) return;
  try {
    const res = await fetch(env.FRONTEND_REVALIDATE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": env.REVALIDATE_SECRET,
      },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status, tags }, "Frontend revalidation returned non-2xx");
    }
  } catch (err) {
    logger.warn({ err, tags }, "Frontend revalidation request failed");
  }
}
