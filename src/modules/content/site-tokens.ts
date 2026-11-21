import { SiteSettingsModel } from "../seo/site-settings.model.js";
import type { FaqDoc, LegalDocDoc } from "./content.model.js";

/**
 * Site-settings placeholders for CMS text (legal docs, FAQs). The admin writes
 * `Call us on {{phone}}`; customers see the number currently saved in
 * Admin → Site settings. Change a detail once there and every policy follows.
 *
 * Only the public queries fill these in — admin queries return the raw text,
 * so saving a doc in the admin never bakes today's values into it.
 */
export const SITE_TOKENS = [
  { token: "{{phone}}", label: "Phone number" },
  { token: "{{email}}", label: "Email address" },
  { token: "{{address}}", label: "Postal address" },
  { token: "{{whatsapp}}", label: "WhatsApp link (wa.me/…)" },
  { token: "{{name}}", label: "Site name, e.g. Vastukosh" },
  { token: "{{legalName}}", label: "Registered business name" },
  { token: "{{domain}}", label: "Website domain" },
] as const;

export type TokenValues = Record<string, string>;

export async function loadTokenValues(): Promise<TokenValues> {
  const s = await SiteSettingsModel.findOne({ key: "default" }).lean();
  const phone = s?.phone?.trim() ?? "";
  const wa =
    (s?.socials ?? []).map((x) => x.href ?? "").find((h) => /wa\.me\/\d+/.test(h)) ??
    (phone.replace(/\D/g, "").length >= 10 ? `https://wa.me/${phone.replace(/\D/g, "")}` : "");
  return {
    phone,
    email: s?.email?.trim() ?? "",
    address: s?.addressText?.trim() ?? "",
    whatsapp: wa,
    name: s?.name?.trim() ?? "",
    legalName: s?.legalName?.trim() || s?.name?.trim() || "",
    domain: s?.domain?.trim() ?? "",
  };
}

/** Replace `{{token}}`s; unknown or unset ones are left visible so a typo is easy to spot. */
export function fillTokens(text: string | null | undefined, values: TokenValues): string {
  if (!text) return text ?? "";
  return text.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (whole, key: string) => values[key] || whole);
}

type L = { en?: string | null; hi?: string | null } | null | undefined;
const fillL = (v: L, values: TokenValues) => (v ? { en: fillTokens(v.en, values), hi: fillTokens(v.hi, values) } : v);

export function fillLegalDoc(doc: LegalDocDoc, values: TokenValues): LegalDocDoc {
  const o = doc.toObject();
  return {
    ...o,
    title: fillL(o.title, values),
    sections: o.sections.map((s) => ({ heading: fillL(s.heading, values), body: fillL(s.body, values) })),
  } as unknown as LegalDocDoc;
}

export function fillFaq(doc: FaqDoc, values: TokenValues): FaqDoc {
  const o = doc.toObject();
  return { ...o, question: fillL(o.question, values), answer: fillL(o.answer, values) } as unknown as FaqDoc;
}
