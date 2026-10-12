import type { OrderDoc } from "../../order/order.model.js";
import type { ReturnDoc, ReturnStatus } from "../../returns/return.model.js";
import { type EmailLocale, adminUrl, asLocale, details, esc, money, note, p, pick, renderEmail, siteUrl } from "../layout.js";

type Ctx = { ret: ReturnDoc; order: OrderDoc; note: string };

function itemList(ret: ReturnDoc, L: EmailLocale): string {
  return ret.items
    .map((i) => `${esc((i.name as { en: string; hi: string } | undefined)?.[L] || i.name?.en || i.productSlug)} × ${i.qty}`)
    .join("<br>");
}

const COPY: Partial<Record<ReturnStatus, { subject: { en: string; hi: string }; heading: { en: string; hi: string }; body: (c: Ctx, L: EmailLocale) => string }>> = {
  requested: {
    subject: { en: "Return request received", hi: "रिटर्न अनुरोध मिला" },
    heading: { en: "We've received your return request", hi: "हमें आपका रिटर्न अनुरोध मिल गया है" },
    body: (_c, L) =>
      p(pick(L, {
        en: "Our team will review it within 1–2 working days. If it's approved, we'll arrange a pickup from your address and email you the details.",
        hi: "हमारी टीम 1–2 कार्य-दिवसों में इसकी समीक्षा करेगी। स्वीकृत होने पर हम आपके पते से पिकअप की व्यवस्था करेंगे और विवरण ईमेल करेंगे।",
      })),
  },
  approved: {
    subject: { en: "Return approved", hi: "रिटर्न स्वीकृत" },
    heading: { en: "Your return has been approved", hi: "आपका रिटर्न स्वीकृत हो गया है" },
    body: (_c, L) =>
      p(pick(L, {
        en: "We'll schedule a courier pickup from your delivery address shortly and email you when it's booked. Please keep the items packed in their original packaging.",
        hi: "हम जल्द ही आपके डिलीवरी पते से कूरियर पिकअप तय करेंगे और बुक होने पर ईमेल करेंगे। कृपया वस्तुओं को उनकी मूल पैकिंग में तैयार रखें।",
      })),
  },
  rejected: {
    subject: { en: "Update on your return request", hi: "आपके रिटर्न अनुरोध पर अपडेट" },
    heading: { en: "We couldn't accept this return", hi: "हम यह रिटर्न स्वीकार नहीं कर सके" },
    body: (c, L) =>
      p(pick(L, { en: "We're sorry — after reviewing your request, we're unable to accept this return.", hi: "क्षमा करें — आपके अनुरोध की समीक्षा के बाद हम यह रिटर्न स्वीकार नहीं कर पा रहे हैं।" })) +
      (c.note && c.note !== "Rejected by admin" ? p(`<i>${esc(c.note)}</i>`) : "") +
      note(pick(L, { en: "If you think this is a mistake, just reply to this email and we'll take another look.", hi: "अगर आपको लगता है कि यह गलती है, तो इस ईमेल का उत्तर दें, हम फिर से देखेंगे।" })),
  },
  pickup_scheduled: {
    subject: { en: "Return pickup scheduled", hi: "रिटर्न पिकअप तय" },
    heading: { en: "Your pickup is booked", hi: "आपका पिकअप बुक हो गया है" },
    body: (c, L) => {
      const s = c.ret.shipment as { courierName?: string; awbCode?: string; pickupScheduledDate?: Date | null } | null;
      const date = s?.pickupScheduledDate
        ? new Date(s.pickupScheduledDate).toLocaleDateString(L === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })
        : "";
      return (
        p(pick(L, { en: "A courier will collect the items from your delivery address. Please hand over the packed parcel when they arrive.", hi: "कूरियर आपके डिलीवरी पते से वस्तुएँ ले जाएगा। आने पर कृपया पैक किया हुआ पार्सल सौंप दें।" })) +
        details([
          [pick(L, { en: "Pickup date", hi: "पिकअप तिथि" }), esc(date)],
          [pick(L, { en: "Courier", hi: "कूरियर" }), esc(s?.courierName ?? "")],
          [pick(L, { en: "Tracking number", hi: "ट्रैकिंग नंबर" }), esc(s?.awbCode ?? "")],
        ])
      );
    },
  },
  received: {
    subject: { en: "We've received your returned items", hi: "हमें आपकी लौटाई गई वस्तुएँ मिल गईं" },
    heading: { en: "Your return has arrived", hi: "आपका रिटर्न पहुँच गया है" },
    body: (_c, L) =>
      p(pick(L, { en: "The items have reached us. We're checking them now and will issue your refund shortly.", hi: "वस्तुएँ हम तक पहुँच गई हैं। हम उनकी जाँच कर रहे हैं और जल्द ही आपका रिफ़ंड जारी करेंगे।" })),
  },
  refunded: {
    subject: { en: "Refund issued for your return", hi: "आपके रिटर्न का रिफ़ंड जारी" },
    heading: { en: "Your refund is on its way", hi: "आपका रिफ़ंड भेज दिया गया है" },
    body: (c, L) =>
      p(pick(L, {
        en: `We've refunded <b>${money(c.ret.refundAmount, L)}</b> to your original payment method.`,
        hi: `हमने <b>${money(c.ret.refundAmount, L)}</b> आपके मूल भुगतान माध्यम में वापस भेज दिए हैं।`,
      })) +
      note(pick(L, {
        en: "UPI and wallet refunds usually arrive within minutes. Card and net-banking refunds can take 5–7 working days, depending on your bank. Cash-on-delivery orders are refunded by bank transfer — reply with your UPI ID if we haven't asked yet.",
        hi: "UPI और वॉलेट रिफ़ंड आमतौर पर कुछ मिनटों में आ जाते हैं। कार्ड और नेट-बैंकिंग में बैंक के अनुसार 5–7 कार्य-दिवस लग सकते हैं। कैश-ऑन-डिलीवरी ऑर्डर का रिफ़ंड बैंक ट्रांसफ़र से होता है — अगर हमने अभी तक नहीं पूछा है तो अपनी UPI ID के साथ उत्तर दें।",
      })),
  },
};

export function returnStatusTemplate(status: ReturnStatus, c: Ctx) {
  const copy = COPY[status];
  if (!copy) return null;
  const L = asLocale((c.order as { locale?: string }).locale);
  return renderEmail({
    locale: L,
    subject: `${pick(L, copy.subject)} — ${c.ret.returnNo}`,
    heading: pick(L, copy.heading),
    name: c.order.shippingAddress?.firstName ?? "",
    body:
      copy.body(c, L) +
      details([
        [pick(L, { en: "Return number", hi: "रिटर्न संख्या" }), `<b>${esc(c.ret.returnNo)}</b>`],
        [pick(L, { en: "Order number", hi: "ऑर्डर संख्या" }), esc(c.ret.orderNo)],
        [pick(L, { en: "Items", hi: "वस्तुएँ" }), itemList(c.ret, L)],
      ]),
    cta: c.order.userId ? { label: pick(L, { en: "View my orders", hi: "मेरे ऑर्डर देखें" }), url: siteUrl(L, "/account/orders") } : undefined,
  });
}

export function adminReturnRequestedTemplate(c: Ctx) {
  return renderEmail({
    locale: "en",
    subject: `Return requested ${c.ret.returnNo} (order ${c.ret.orderNo})`,
    heading: "New return request",
    body: details([
      ["Return", `<b>${esc(c.ret.returnNo)}</b>`],
      ["Order", esc(c.ret.orderNo)],
      ["Customer", esc(c.order.email)],
      ["Items", c.ret.items.map((i) => `${esc(i.name?.en ?? i.productSlug)} × ${i.qty} — <i>${esc(i.reason)}</i>`).join("<br>")],
    ]),
    cta: { label: "Review in admin", url: adminUrl("/returns") },
  });
}
