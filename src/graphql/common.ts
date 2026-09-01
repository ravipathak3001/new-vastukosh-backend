import { builder } from "./builder.js";
import type { LocalizedString } from "../shared/localized.js";

/**
 * A string available in every supported locale. Clients select the sub-field
 * they need; the frontend picks `.en` / `.hi` by the active locale. This keeps
 * the schema flat (no per-field `locale:` arguments).
 */
export const LocalizedStringRef = builder
  .objectRef<LocalizedString>("LocalizedString")
  .implement({
    fields: (t) => ({
      en: t.exposeString("en"),
      hi: t.exposeString("hi"),
    }),
  });

export type { LocalizedString };
