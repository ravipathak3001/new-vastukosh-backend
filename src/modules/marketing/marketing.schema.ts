import { z } from "zod";
import { builder } from "../../graphql/builder.js";
import { subscribeNewsletter, submitContactForm } from "./marketing.service.js";

const OkResultRef = builder
  .objectRef<{ ok: boolean }>("MutationOk")
  .implement({ fields: (t) => ({ ok: t.exposeBoolean("ok") }) });

const ContactInput = builder.inputType("ContactInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    email: t.string({ required: true }),
    phone: t.string({ required: false }),
    subject: t.string({ required: false }),
    message: t.string({ required: true }),
  }),
});

export function registerMarketingModule() {
  builder.mutationFields((t) => ({
    subscribeNewsletter: t.field({
      type: OkResultRef,
      args: {
        email: t.arg.string({ required: true }),
        source: t.arg.string({ required: false }),
      },
      validate: { schema: z.object({ email: z.string().email() }) },
      resolve: (_p, { email, source }, ctx) =>
        subscribeNewsletter(email, ctx.locale, source ?? "footer"),
    }),

    submitContactForm: t.field({
      type: OkResultRef,
      args: { input: t.arg({ type: ContactInput, required: true }) },
      validate: {
        schema: z.object({
          input: z.object({
            name: z.string().min(1),
            email: z.string().email(),
            message: z.string().min(1).max(5000),
          }).passthrough(),
        }),
      },
      resolve: (_p, { input }, ctx) =>
        submitContactForm({
          name: input.name,
          email: input.email,
          phone: input.phone ?? undefined,
          subject: input.subject ?? undefined,
          message: input.message,
          locale: ctx.locale,
        }),
    }),
  }));
}
