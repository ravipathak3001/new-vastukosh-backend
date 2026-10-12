import cron, { type ScheduledTask } from "node-cron";
import { env, isTest } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { getEmailProvider } from "./email.provider.js";
import { EmailOutboxModel, type EmailOutboxDoc } from "./outbox.model.js";
import type { RenderedEmail } from "./layout.js";

/** Minutes to wait before attempt 2, 3, 4, 5; after the last one it's marked failed. */
const BACKOFF_MINUTES = [1, 5, 30, 120];
const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;
/** A claimed email is invisible to other workers for this long. */
const LEASE_MS = 2 * 60_000;

export type QueueEmailInput = RenderedEmail & {
  to: string;
  kind: string;
  ref?: string;
  /** Same key twice = the second call is a no-op. */
  dedupeKey?: string;
};

/**
 * Saves an email and sends it right away in the background. Never throws:
 * an email problem must not undo an order, a payment or a sign-up.
 */
export async function queueEmail(input: QueueEmailInput): Promise<void> {
  const to = input.to?.trim();
  if (!to) return;
  try {
    const doc = await EmailOutboxModel.create({
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      kind: input.kind,
      ref: input.ref ?? "",
      dedupeKey: input.dedupeKey,
    });
    // Tests deliver explicitly (`deliverDueEmails`) so nothing races the DB reset.
    if (!isTest) void deliver(doc._id);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return; // already queued once
    logger.error({ err, kind: input.kind, ref: input.ref }, "Couldn't queue email");
  }
}

/** Sends a copy to each team inbox in ADMIN_NOTIFY_EMAILS. */
export async function queueAdminEmail(input: Omit<QueueEmailInput, "to">): Promise<void> {
  const inboxes = (env.ADMIN_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await Promise.all(
    inboxes.map((to) =>
      queueEmail({ ...input, to, dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${to}` : undefined }),
    ),
  );
}

/** Claims one email (so two workers never send it twice), sends it, records the outcome. */
async function deliver(id: unknown): Promise<void> {
  const now = new Date();
  const doc: EmailOutboxDoc | null = await EmailOutboxModel.findOneAndUpdate(
    { _id: id, status: "queued", nextAttemptAt: { $lte: now } },
    { $set: { nextAttemptAt: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 } },
    { new: true },
  );
  if (!doc) return;
  try {
    await getEmailProvider().send(doc.to, doc.subject, doc.html, doc.text || undefined);
    doc.status = "sent";
    doc.sentAt = new Date();
    doc.lastError = "";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    doc.lastError = message.slice(0, 500);
    if (doc.attempts >= MAX_ATTEMPTS) {
      doc.status = "failed";
      logger.error({ to: doc.to, kind: doc.kind, ref: doc.ref, err: message }, "Email gave up after retries");
    } else {
      const wait = BACKOFF_MINUTES[doc.attempts - 1] ?? 120;
      doc.nextAttemptAt = new Date(Date.now() + wait * 60_000);
      logger.warn({ to: doc.to, kind: doc.kind, attempt: doc.attempts, err: message }, "Email failed — will retry");
    }
  }
  await doc.save();
}

/** Sends everything that's due (new, or waiting for a retry). Returns how many were attempted. */
export async function deliverDueEmails(limit = 50): Promise<number> {
  const due = await EmailOutboxModel.find(
    { status: "queued", nextAttemptAt: { $lte: new Date() } },
    { _id: 1 },
  )
    .sort({ nextAttemptAt: 1 })
    .limit(limit)
    .lean();
  for (const d of due) await deliver(d._id);
  return due.length;
}

let task: ScheduledTask | null = null;
const minuteHooks: (() => Promise<unknown>)[] = [];

/** Other modules add per-minute work (e.g. booking reminders) that should run beside the retries. */
export function onEmailMinute(fn: () => Promise<unknown>): void {
  minuteHooks.push(fn);
}

export function startEmailJobs(): void {
  if (task) return;
  task = cron.schedule("* * * * *", () => {
    deliverDueEmails().catch((err) => logger.error({ err }, "Email retry run crashed"));
    for (const fn of minuteHooks) fn().catch((err) => logger.error({ err }, "Email minute job crashed"));
  });
  logger.info("Email delivery cron started");
}

export function stopEmailJobs(): void {
  task?.stop();
  task = null;
}
