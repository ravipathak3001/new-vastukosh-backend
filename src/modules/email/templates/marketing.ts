import { type EmailLocale, adminUrl, details, esc, note, p, pick, renderEmail, siteUrl } from "../layout.js";

export function contactReceivedTemplate(c: { name: string; subject: string; message: string; locale: EmailLocale }) {
  const L = c.locale;
  return renderEmail({
    locale: L,
    subject: pick(L, { en: "We've received your message — Vastukosh", hi: "हमें आपका संदेश मिल गया है — वास्तुकोश" }),
    heading: pick(L, { en: "Thank you for writing to us", hi: "हमें लिखने के लिए धन्यवाद" }),
    name: c.name,
    body:
      p(pick(L, {
        en: "We've received your message and our team will get back to you within one working day. If it's urgent, just reply to this email.",
        hi: "हमें आपका संदेश मिल गया है और हमारी टीम एक कार्य-दिवस में आपसे संपर्क करेगी। अगर जल्दी है, तो इस ईमेल का उत्तर दें।",
      })) +
      details([
        [pick(L, { en: "Subject", hi: "विषय" }), esc(c.subject)],
        [pick(L, { en: "Your message", hi: "आपका संदेश" }), esc(c.message).replace(/\n/g, "<br>")],
      ]),
  });
}

export function adminContactTemplate(c: { name: string; email: string; phone: string; subject: string; message: string }) {
  return renderEmail({
    locale: "en",
    subject: `Contact form: ${c.subject || "New message"} — ${c.name}`,
    heading: "New contact form message",
    body: details([
      ["From", `<b>${esc(c.name)}</b> · <a href="mailto:${esc(c.email)}" style="color:#785600">${esc(c.email)}</a>`],
      ["Phone", esc(c.phone)],
      ["Subject", esc(c.subject)],
      ["Message", esc(c.message).replace(/\n/g, "<br>")],
    ]) + note("Reply straight to the customer's email address above."),
    cta: { label: "Open messages", url: adminUrl("/contact") },
  });
}

export function newsletterWelcomeTemplate(locale: EmailLocale, unsubscribeUrl: string) {
  const L = locale;
  return renderEmail({
    locale: L,
    subject: pick(L, { en: "You're subscribed to Vastukosh", hi: "आपने वास्तुकोश की सदस्यता ले ली है" }),
    heading: pick(L, { en: "Welcome to our newsletter", hi: "हमारे न्यूज़लेटर में आपका स्वागत है" }),
    body:
      p(pick(L, {
        en: "Thank you for subscribing. You'll hear from us about auspicious days, new consecrated arrivals, Vastu tips and members-only offers — never more than a few times a month.",
        hi: "सदस्यता लेने के लिए धन्यवाद। आपको शुभ दिनों, नई प्राण-प्रतिष्ठित वस्तुओं, वास्तु सुझावों और विशेष ऑफ़र की जानकारी मिलेगी — महीने में कुछ ही बार।",
      })),
    cta: { label: pick(L, { en: "Visit the shop", hi: "दुकान देखें" }), url: siteUrl(L, "/shop") },
    after: pick(L, {
      en: `Changed your mind? <a href="${esc(unsubscribeUrl)}" style="color:#6f6253">Unsubscribe</a> with one click.`,
      hi: `मन बदल गया? एक क्लिक में <a href="${esc(unsubscribeUrl)}" style="color:#6f6253">सदस्यता छोड़ें</a>।`,
    }),
  });
}
