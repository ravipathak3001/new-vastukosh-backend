import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

/**
 * The contract every email sender implements. Swapping providers (mock -> SMTP
 * -> anything else) never touches the callers — see `payment.provider.ts` /
 * `shipping.provider.ts` for the identical pattern.
 */
export interface EmailProvider {
  readonly name: string;
  send(to: string, subject: string, html: string): Promise<void>;
}

/** Logs instead of sending — the default until SMTP is configured. */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";

  async send(to: string, subject: string, html: string): Promise<void> {
    logger.info({ to, subject, html }, "Email (mock) — not actually sent");
  }
}

/**
 * Plain SMTP adapter — works with any provider that speaks SMTP (Gmail,
 * SES, SendGrid, Mailgun, ...) so this isn't locked to one vendor's API.
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      throw new Error("SMTP is selected but SMTP_HOST/SMTP_USER/SMTP_PASS are not set");
    }
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    return this.transporter;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    await this.getTransporter().sendMail({ from: env.EMAIL_FROM, to, subject, html });
  }
}

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  provider = env.EMAIL_PROVIDER === "smtp" ? new SmtpEmailProvider() : new MockEmailProvider();
  logger.info({ provider: provider.name }, "Email provider ready");
  return provider;
}
