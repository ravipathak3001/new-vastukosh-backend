import { env } from "../../config/env.js";

/**
 * The one look every Vastukosh email shares: logo header, content card,
 * a single call-to-action button and a footer with how to reach us. Built
 * from tables + inline styles because that's what email clients render
 * reliably (Gmail strips <style>, Outlook ignores flex/grid).
 */

export type EmailLocale = "en" | "hi";
export type RenderedEmail = { subject: string; html: string; text: string };
export type Copy = { en: string; hi: string };

export const asLocale = (l: unknown): EmailLocale => (l === "hi" ? "hi" : "en");

/** Pick the string for this reader's language. */
export const pick = (locale: EmailLocale, copy: Copy) => copy[locale] || copy.en;

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function money(amount: number, locale: EmailLocale): string {
  return new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Absolute link into the website, in the reader's language. */
export const siteUrl = (locale: EmailLocale, path = "") => `${env.SITE_URL}/${locale}${path}`;
export const adminUrl = (path = "") => `${env.ADMIN_URL}${path}`;
export const supportEmail = () => env.EMAIL_REPLY_TO || "support@vastukosh.com";

const C = {
  maroon: "#800000",
  brown: "#785600",
  ink: "#2b1d0e",
  muted: "#6f6253",
  line: "#eadfcd",
  ivory: "#fbf9f5",
  card: "#ffffff",
};
const FONT = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

export function p(html: string): string {
  return `<p style="margin:0 0 14px;font:15px/1.6 ${SANS};color:${C.ink}">${html}</p>`;
}

export function note(html: string): string {
  return `<p style="margin:0 0 14px;font:13px/1.55 ${SANS};color:${C.muted}">${html}</p>`;
}

/** Label/value rows, e.g. order number, date, total. */
export function details(rows: [string, string][]): string {
  const tr = rows
    .filter(([, v]) => v !== "")
    .map(
      ([k, v]) => `<tr>
  <td style="padding:8px 12px 8px 0;font:13px ${SANS};color:${C.muted};vertical-align:top;white-space:nowrap">${esc(k)}</td>
  <td style="padding:8px 0;font:14px ${SANS};color:${C.ink};vertical-align:top">${v}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${tr}</table>`;
}

/** Line items with quantity and price, plus optional total rows underneath. */
export function lineItems(
  items: { name: string; qty: number; amount: string }[],
  totals: [string, string, boolean?][] = [],
): string {
  const rows = items
    .map(
      (i) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${C.line};font:14px ${SANS};color:${C.ink}">${esc(i.name)} <span style="color:${C.muted}">× ${i.qty}</span></td>
  <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.line};font:14px ${SANS};color:${C.ink};white-space:nowrap">${esc(i.amount)}</td>
</tr>`,
    )
    .join("");
  const sums = totals
    .map(
      ([k, v, strong]) => `<tr>
  <td style="padding:6px 0;font:${strong ? "bold 15px" : "13px"} ${SANS};color:${strong ? C.ink : C.muted}">${esc(k)}</td>
  <td align="right" style="padding:6px 0;font:${strong ? "bold 15px" : "13px"} ${SANS};color:${strong ? C.maroon : C.muted};white-space:nowrap">${esc(v)}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px">${rows}${sums}</table>`;
}

function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr><td style="border-radius:6px;background:${C.brown}">
  <a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font:bold 14px ${SANS};color:#ffffff;text-decoration:none;letter-spacing:.3px">${esc(label)}</a>
</td></tr></table>`;
}

const FOOTER: Record<EmailLocale, (support: string) => string> = {
  en: (s) =>
    `Questions? Just reply to this email or write to <a href="mailto:${s}" style="color:${C.brown}">${s}</a>.<br>Vastukosh · Astrology, Vastu &amp; sacred goods`,
  hi: (s) =>
    `कोई प्रश्न? इस ईमेल का उत्तर दें या <a href="mailto:${s}" style="color:${C.brown}">${s}</a> पर लिखें।<br>वास्तुकोश · ज्योतिष, वास्तु और पवित्र वस्तुएँ`,
};

export function renderEmail(opts: {
  locale: EmailLocale;
  subject: string;
  /** Inbox preview line. */
  preheader?: string;
  heading: string;
  /** "Namaste {name}," line; omitted when empty. */
  name?: string;
  body: string;
  cta?: { label: string; url: string };
  /** Small print under the button (e.g. "link expires in 48 hours"). */
  after?: string;
}): RenderedEmail {
  const { locale } = opts;
  const greeting = opts.name ? p(`${locale === "hi" ? "नमस्ते" : "Namaste"} ${esc(opts.name)},`) : "";
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.ivory}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader ?? "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ivory}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td align="center" style="padding:6px 0 18px">
      <a href="${esc(siteUrl(locale))}" style="text-decoration:none">
        <img src="${esc(env.SITE_URL)}/logo.png" width="44" height="41" alt="" style="vertical-align:middle;border:0">
        <span style="font:bold 22px ${FONT};color:${C.maroon};vertical-align:middle;padding-left:8px">${locale === "hi" ? "वास्तुकोश" : "Vastukosh"}</span>
      </a>
    </td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.line};border-top:4px solid ${C.maroon};border-radius:10px;padding:30px 28px">
      <h1 style="margin:0 0 18px;font:bold 23px/1.3 ${FONT};color:${C.maroon}">${esc(opts.heading)}</h1>
      ${greeting}
      ${opts.body}
      ${opts.cta ? button(opts.cta.label, opts.cta.url) : ""}
      ${opts.after ? note(opts.after) : ""}
      <p style="margin:18px 0 0;font:14px ${SANS};color:${C.ink}">${locale === "hi" ? "— टीम वास्तुकोश" : "— Team Vastukosh"}</p>
    </td></tr>
    <tr><td align="center" style="padding:18px 8px;font:12px/1.6 ${SANS};color:${C.muted}">${FOOTER[locale](esc(supportEmail()))}</td></tr>
  </table>
</td></tr></table>
</body></html>`;
  return { subject: opts.subject, html, text: htmlToText(html) };
}

/** Plain-text twin of the HTML, for clients that prefer it (and spam filters that check). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(head|style|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<span style="display:none[\s\S]*?<\/span>/i, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      return text && !href.startsWith("mailto:") ? `${text} (${href})` : text || href;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|tr|table)>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}
