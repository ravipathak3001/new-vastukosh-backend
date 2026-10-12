import { env } from "../../config/env.js";
import { queueAdminEmail, queueEmail } from "../email/outbox.service.js";
import {
  type EmailLocale,
  adminUrl,
  asLocale,
  details,
  esc,
  money,
  note,
  p,
  pick,
  renderEmail,
  siteUrl,
} from "../email/layout.js";
import type { ConsultationBookingDoc } from "./consultation.model.js";

/**
 * Transactional emails for the booking lifecycle, in the customer's language.
 * They go through the email outbox: retried if the mail server is down, and
 * never able to roll back a payment, confirmation or refund.
 */

/** Deep link to the booking page; carries the access token so guests can act on it. */
export function bookingManageUrl(b: ConsultationBookingDoc): string {
  return siteUrl(asLocale(b.locale), `/bookings/${b.bookingNo}?t=${b.accessToken}`);
}

function serviceLabel(b: ConsultationBookingDoc, L: EmailLocale): string {
  const name = b.serviceName?.[L] || b.serviceName?.en || b.serviceKey;
  return b.kind === "pooja" ? pick(L, { en: `${name} (online pooja)`, hi: `${name} (ऑनलाइन पूजा)` }) : name;
}

function when(date: string, slot: string, L: EmailLocale): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00Z`).toLocaleDateString(L === "hi" ? "hi-IN" : "en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${d}, ${slot} IST`;
}

function summary(b: ConsultationBookingDoc, L: EmailLocale, extra: [string, string][] = []): string {
  return details([
    [pick(L, { en: "Booking", hi: "बुकिंग" }), `<b>${esc(serviceLabel(b, L))}</b>`],
    [pick(L, { en: "When", hi: "कब" }), esc(when(b.date, b.slot, L))],
    ...extra,
    [pick(L, { en: "Reference", hi: "संदर्भ" }), esc(b.bookingNo ?? "")],
  ]);
}

const viewCta = (b: ConsultationBookingDoc, L: EmailLocale) => ({
  label: pick(L, { en: "View my booking", hi: "मेरी बुकिंग देखें" }),
  url: bookingManageUrl(b),
});

async function send(b: ConsultationBookingDoc, kind: string, key: string, email: ReturnType<typeof renderEmail>) {
  await queueEmail({ to: b.email, kind: `booking.${kind}`, ref: b.bookingNo ?? "", dedupeKey: `booking:${b.bookingNo}:${key}`, ...email });
}

export function sendBookingReceived(b: ConsultationBookingDoc) {
  const L = asLocale(b.locale);
  const consult = b.kind === "consultation";
  return send(
    b,
    "received",
    "received",
    renderEmail({
      locale: L,
      subject: pick(L, { en: `Booking received — ${serviceLabel(b, "en")}`, hi: `बुकिंग मिली — ${serviceLabel(b, "hi")}` }),
      preheader: pick(L, { en: "We'll confirm your slot shortly.", hi: "हम जल्द ही आपका स्लॉट पुष्ट करेंगे।" }),
      heading: pick(L, { en: "We've received your booking", hi: "हमें आपकी बुकिंग मिल गई है" }),
      name: b.name,
      body:
        p(pick(L, {
          en: b.amount > 0 ? `Thank you — your payment of <b>${money(b.amount, L)}</b> was successful.` : "Thank you for your booking.",
          hi: b.amount > 0 ? `धन्यवाद — आपका <b>${money(b.amount, L)}</b> का भुगतान सफल रहा।` : "आपकी बुकिंग के लिए धन्यवाद।",
        })) +
        summary(b, L, b.amount > 0 ? [[pick(L, { en: "Paid", hi: "भुगतान" }), money(b.amount, L)]] : []) +
        p(pick(L, {
          en: consult
            ? "We'll confirm your slot shortly. Once it's confirmed, you'll get another email with the video meeting link."
            : "We'll confirm the pooja shortly. It will be performed in your name with your sankalp, and we'll share the recording with you afterwards.",
          hi: consult
            ? "हम जल्द ही आपका स्लॉट पुष्ट करेंगे। पुष्ट होते ही आपको वीडियो मीटिंग लिंक के साथ एक और ईमेल मिलेगा।"
            : "हम जल्द ही पूजा पुष्ट करेंगे। यह आपके संकल्प के साथ आपके नाम से की जाएगी, और बाद में हम आपको रिकॉर्डिंग भेजेंगे।",
        })),
      cta: viewCta(b, L),
    }),
  );
}

export function sendBookingConfirmed(b: ConsultationBookingDoc) {
  const L = asLocale(b.locale);
  const link = b.kind === "consultation" ? b.meeting?.url : "";
  return send(
    b,
    "confirmed",
    `confirmed:${b.date}T${b.slot}`,
    renderEmail({
      locale: L,
      subject: pick(L, { en: `Confirmed — ${serviceLabel(b, "en")} on ${b.date}`, hi: `पुष्ट — ${serviceLabel(b, "hi")}, ${b.date}` }),
      preheader: pick(L, { en: `See you on ${when(b.date, b.slot, "en")}.`, hi: `${when(b.date, b.slot, "hi")} को मिलते हैं।` }),
      heading: pick(L, { en: "Your booking is confirmed", hi: "आपकी बुकिंग पुष्ट हो गई है" }),
      name: b.name,
      body: link
        ? summary(b, L, [[pick(L, { en: "Video link", hi: "वीडियो लिंक" }), `<a href="${esc(link)}" style="color:#785600">${esc(link)}</a>`]]) +
          p(pick(L, {
            en: "Join with the button below at the scheduled time. Please keep your birth date, time and place handy, and use a quiet spot with a good connection.",
            hi: "तय समय पर नीचे दिए बटन से जुड़ें। कृपया अपनी जन्म तिथि, समय और स्थान पास रखें, और अच्छे इंटरनेट वाली शांत जगह चुनें।",
          })) +
          note(pick(L, { en: "We'll also send you a reminder an hour before.", hi: "हम एक घंटा पहले आपको याद भी दिलाएँगे।" }))
        : summary(b, L) +
          p(pick(L, {
            en: "The pandit will perform the pooja with your sankalp at the scheduled time. We'll email you the recording once it's complete.",
            hi: "पंडित जी तय समय पर आपके संकल्प के साथ पूजा करेंगे। पूरी होते ही हम आपको रिकॉर्डिंग ईमेल करेंगे।",
          })),
      cta: link ? { label: pick(L, { en: "Join the video call", hi: "वीडियो कॉल से जुड़ें" }), url: link } : viewCta(b, L),
    }),
  );
}

export function sendRescheduleProposed(b: ConsultationBookingDoc) {
  const L = asLocale(b.locale);
  return send(
    b,
    "reschedule_proposed",
    `reschedule:${b.proposedDate}T${b.proposedSlot}`,
    renderEmail({
      locale: L,
      subject: pick(L, { en: `New time proposed — ${serviceLabel(b, "en")}`, hi: `नया समय प्रस्तावित — ${serviceLabel(b, "hi")}` }),
      heading: pick(L, { en: "Could we move your booking?", hi: "क्या हम आपकी बुकिंग का समय बदल सकते हैं?" }),
      name: b.name,
      body:
        p(pick(L, {
          en: `We're sorry — we can't keep your slot on ${esc(when(b.date, b.slot, L))}. We'd like to offer <b>${esc(when(b.proposedDate, b.proposedSlot, L))}</b> instead.`,
          hi: `क्षमा करें — हम ${esc(when(b.date, b.slot, L))} का आपका स्लॉट नहीं रख पा रहे हैं। इसके बजाय हम <b>${esc(when(b.proposedDate, b.proposedSlot, L))}</b> का समय देना चाहते हैं।`,
        })) +
        (b.adminNote ? p(`<i>${esc(b.adminNote)}</i>`) : "") +
        p(pick(L, {
          en: "Please open your booking to accept the new time. If it doesn't suit you, decline it and we'll refund you in full.",
          hi: "नया समय स्वीकार करने के लिए अपनी बुकिंग खोलें। अगर यह आपके लिए ठीक नहीं है, तो अस्वीकार करें और हम पूरी राशि वापस कर देंगे।",
        })),
      cta: { label: pick(L, { en: "Accept or decline", hi: "स्वीकार या अस्वीकार करें" }), url: bookingManageUrl(b) },
    }),
  );
}

export function sendBookingRefunded(b: ConsultationBookingDoc) {
  const L = asLocale(b.locale);
  return send(
    b,
    "refunded",
    "refunded",
    renderEmail({
      locale: L,
      subject: pick(L, { en: `Refund issued — ${serviceLabel(b, "en")}`, hi: `रिफ़ंड जारी — ${serviceLabel(b, "hi")}` }),
      heading: pick(L, { en: "Your refund is on its way", hi: "आपका रिफ़ंड भेज दिया गया है" }),
      name: b.name,
      body:
        p(pick(L, {
          en: `We've refunded <b>${money(b.payment.refundAmount || b.amount, L)}</b> for your booking to your original payment method.`,
          hi: `हमने आपकी बुकिंग के लिए <b>${money(b.payment.refundAmount || b.amount, L)}</b> आपके मूल भुगतान माध्यम में वापस भेज दिए हैं।`,
        })) +
        summary(b, L) +
        note(pick(L, {
          en: "UPI and wallet refunds usually arrive within minutes; card refunds can take 5–7 working days.",
          hi: "UPI और वॉलेट रिफ़ंड आमतौर पर कुछ मिनटों में आ जाते हैं; कार्ड रिफ़ंड में 5–7 कार्य-दिवस लग सकते हैं।",
        })),
      cta: { label: pick(L, { en: "Book another time", hi: "दूसरा समय बुक करें" }), url: siteUrl(L, b.kind === "pooja" ? "/pooja" : "/consultancy") },
    }),
  );
}

export function sendBookingCancelled(b: ConsultationBookingDoc) {
  const L = asLocale(b.locale);
  return send(
    b,
    "cancelled",
    "cancelled",
    renderEmail({
      locale: L,
      subject: pick(L, { en: `Booking cancelled — ${serviceLabel(b, "en")}`, hi: `बुकिंग रद्द — ${serviceLabel(b, "hi")}` }),
      heading: pick(L, { en: "Your booking was cancelled", hi: "आपकी बुकिंग रद्द कर दी गई" }),
      name: b.name,
      body:
        summary(b, L) +
        p(pick(L, {
          en: "No payment was taken for this booking, so there's nothing to refund. You're welcome to book another time.",
          hi: "इस बुकिंग के लिए कोई भुगतान नहीं लिया गया था, इसलिए कुछ भी वापस नहीं करना है। आप कभी भी दूसरा समय बुक कर सकते हैं।",
        })),
      cta: { label: pick(L, { en: "Book again", hi: "फिर से बुक करें" }), url: siteUrl(L, b.kind === "pooja" ? "/pooja" : "/consultancy") },
    }),
  );
}

export function sendRecordingReady(b: ConsultationBookingDoc) {
  const L = asLocale(b.locale);
  return send(
    b,
    "recording",
    `recording:${b.recordingUrl}`,
    renderEmail({
      locale: L,
      subject: pick(L, { en: `Your pooja recording — ${serviceLabel(b, "en")}`, hi: `आपकी पूजा की रिकॉर्डिंग — ${serviceLabel(b, "hi")}` }),
      heading: pick(L, { en: "Your pooja has been performed", hi: "आपकी पूजा संपन्न हो गई है" }),
      name: b.name,
      body:
        p(pick(L, {
          en: `The <b>${esc(serviceLabel(b, L))}</b> has been performed with your sankalp. May it bring blessings to you and your family.`,
          hi: `<b>${esc(serviceLabel(b, L))}</b> आपके संकल्प के साथ संपन्न हो गई है। यह आपको और आपके परिवार को आशीर्वाद दे।`,
        })) + summary(b, L),
      cta: { label: pick(L, { en: "Watch the recording", hi: "रिकॉर्डिंग देखें" }), url: b.recordingUrl },
      after: pick(L, { en: "We'd love to hear how it went — you can leave a review on your booking page.", hi: "हमें बताएँ कि अनुभव कैसा रहा — आप अपनी बुकिंग के पेज पर समीक्षा दे सकते हैं।" }),
    }),
  );
}

/** After a session without a recording: thank them and ask for a review. */
export function sendBookingCompleted(b: ConsultationBookingDoc) {
  const L = asLocale(b.locale);
  return send(
    b,
    "completed",
    "completed",
    renderEmail({
      locale: L,
      subject: pick(L, { en: `Thank you — ${serviceLabel(b, "en")}`, hi: `धन्यवाद — ${serviceLabel(b, "hi")}` }),
      heading: pick(L, { en: "Thank you for your session", hi: "आपके सत्र के लिए धन्यवाद" }),
      name: b.name,
      body:
        p(pick(L, {
          en: "We hope your session brought clarity and peace. If you have follow-up questions, you can book another session anytime.",
          hi: "आशा है आपके सत्र से स्पष्टता और शांति मिली। कोई और प्रश्न हों तो आप कभी भी दूसरा सत्र बुक कर सकते हैं।",
        })) +
        (b.expertId
          ? p(pick(L, {
              en: "A short review helps other seekers choose the right expert — it takes less than a minute.",
              hi: "एक छोटी समीक्षा दूसरे साधकों को सही विशेषज्ञ चुनने में मदद करती है — इसमें एक मिनट से भी कम लगता है।",
            }))
          : ""),
      cta: { label: pick(L, { en: b.expertId ? "Leave a review" : "View my booking", hi: b.expertId ? "समीक्षा दें" : "मेरी बुकिंग देखें" }), url: bookingManageUrl(b) },
    }),
  );
}

/** An hour before a confirmed session. */
export function sendBookingReminder(b: ConsultationBookingDoc) {
  const L = asLocale(b.locale);
  const link = b.kind === "consultation" ? b.meeting?.url : "";
  return send(
    b,
    "reminder",
    `reminder:${b.date}T${b.slot}`,
    renderEmail({
      locale: L,
      subject: pick(L, { en: `Starting soon — ${serviceLabel(b, "en")} at ${b.slot}`, hi: `जल्द शुरू — ${serviceLabel(b, "hi")}, ${b.slot}` }),
      preheader: pick(L, { en: "Your session starts in about an hour.", hi: "आपका सत्र लगभग एक घंटे में शुरू होगा।" }),
      heading: pick(L, { en: "Your session starts in about an hour", hi: "आपका सत्र लगभग एक घंटे में शुरू होगा" }),
      name: b.name,
      body:
        summary(b, L) +
        p(pick(L, {
          en: link
            ? "Use the button below to join on time. Keep your birth details handy."
            : "The pooja will be performed in your name at this time. You may sit quietly and pray along wherever you are.",
          hi: link
            ? "समय पर जुड़ने के लिए नीचे दिया बटन इस्तेमाल करें। अपना जन्म विवरण पास रखें।"
            : "इस समय आपके नाम से पूजा की जाएगी। आप जहाँ भी हों, शांत बैठकर साथ में प्रार्थना कर सकते हैं।",
        })),
      cta: link ? { label: pick(L, { en: "Join the video call", hi: "वीडियो कॉल से जुड़ें" }), url: link } : viewCta(b, L),
    }),
  );
}

/** To the expert: a customer has booked (and paid for) a session with them. */
export async function sendExpertNewBooking(b: ConsultationBookingDoc, expertEmail: string) {
  const extra: [string, string][] =
    b.kind === "pooja"
      ? [["Sankalp", `${esc(b.name)}${b.sankalp?.gotra ? `, gotra ${esc(b.sankalp.gotra)}` : ""}`]]
      : b.notes
        ? [["Their question", `<i>${esc(b.notes)}</i>`]]
        : [];
  await queueEmail({
    to: expertEmail,
    kind: "expert.new_booking",
    ref: b.bookingNo ?? "",
    dedupeKey: `expert:booking:${b.bookingNo}`,
    ...renderEmail({
      locale: "en",
      subject: `New booking — ${serviceLabel(b, "en")} on ${b.date} ${b.slot}`,
      heading: "You have a new booking",
      body:
        p(`<b>${esc(b.name)}</b> has booked and paid for a session with you.`) +
        summary(b, "en", [["Earning", b.expertEarning ? money(b.expertEarning, "en") : ""], ...extra]) +
        p("Please confirm it (or propose another time) from your expert panel."),
      cta: { label: "Open expert panel", url: `${env.SITE_URL}/en/expert/bookings` },
    }),
  });
}

/** To the team: a paid booking is waiting for confirmation. */
export async function sendAdminNewBooking(b: ConsultationBookingDoc) {
  await queueAdminEmail({
    kind: "admin.new_booking",
    ref: b.bookingNo ?? "",
    dedupeKey: `admin:booking:${b.bookingNo}`,
    ...renderEmail({
      locale: "en",
      subject: `New ${b.kind} booking ${b.bookingNo} — ${b.date} ${b.slot}`,
      heading: b.expertId ? "New expert booking" : "New booking to confirm",
      body:
        summary(b, "en", [
          ["Customer", `${esc(b.name)} · ${esc(b.email)}${b.phone ? ` · ${esc(b.phone)}` : ""}`],
          ["Paid", money(b.amount, "en")],
        ]) +
        p(b.expertId ? "The expert has been notified and will confirm it from their panel." : "Confirm it in the admin panel to send the customer their meeting link."),
      cta: { label: "Open bookings", url: adminUrl("/bookings") },
    }),
  });
}
