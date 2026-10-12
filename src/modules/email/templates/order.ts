import type { OrderDoc } from "../../order/order.model.js";
import {
  type EmailLocale,
  adminUrl,
  asLocale,
  details,
  esc,
  lineItems,
  money,
  note,
  p,
  pick,
  renderEmail,
  siteUrl,
} from "../layout.js";

const METHOD: Record<string, { en: string; hi: string }> = {
  cod: { en: "Cash on delivery", hi: "डिलीवरी पर नकद भुगतान" },
  upi: { en: "UPI", hi: "UPI" },
  card: { en: "Card", hi: "कार्ड" },
  netbanking: { en: "Net banking", hi: "नेट बैंकिंग" },
  online: { en: "Paid online", hi: "ऑनलाइन भुगतान" },
};

const localeOf = (o: OrderDoc): EmailLocale => asLocale((o as { locale?: string }).locale);
const firstName = (o: OrderDoc) => o.shippingAddress?.firstName ?? "";

function address(o: OrderDoc): string {
  const a = o.shippingAddress;
  if (!a) return "";
  return [
    esc(`${a.firstName} ${a.lastName ?? ""}`.trim()),
    esc(a.line1),
    a.line2 ? esc(a.line2) : "",
    esc(`${a.city}, ${a.state} ${a.pincode}`),
    a.phone ? esc(a.phone) : "",
  ]
    .filter(Boolean)
    .join("<br>");
}

function itemsBlock(o: OrderDoc, L: EmailLocale): string {
  const items = o.items.map((i) => ({
    name: (i.name as { en: string; hi: string })[L] || (i.name as { en: string }).en,
    qty: i.qty,
    amount: money(i.lineTotal, L),
  }));
  const totals: [string, string, boolean?][] = [[pick(L, { en: "Subtotal", hi: "उप-योग" }), money(o.subtotal, L)]];
  if (o.discount) totals.push([pick(L, { en: `Discount${o.promoCode ? ` (${o.promoCode})` : ""}`, hi: `छूट${o.promoCode ? ` (${o.promoCode})` : ""}` }), `− ${money(o.discount, L)}`]);
  totals.push([pick(L, { en: "Shipping", hi: "शिपिंग" }), o.shippingFee ? money(o.shippingFee, L) : pick(L, { en: "Free", hi: "मुफ़्त" })]);
  totals.push([pick(L, { en: "Total", hi: "कुल" }), money(o.total, L), true]);
  return lineItems(items, totals);
}

/** Signed-in buyers can follow the order online; guests get everything in the email. */
function orderCta(o: OrderDoc, L: EmailLocale) {
  return o.userId
    ? { label: pick(L, { en: "View my order", hi: "मेरा ऑर्डर देखें" }), url: siteUrl(L, "/account/orders") }
    : undefined;
}

export function orderConfirmedTemplate(o: OrderDoc) {
  const L = localeOf(o);
  const cod = o.payment?.method === "cod";
  return renderEmail({
    locale: L,
    subject: pick(L, { en: `Order confirmed — ${o.orderNo}`, hi: `ऑर्डर पुष्ट — ${o.orderNo}` }),
    preheader: pick(L, { en: `Thank you! We've received your order of ${money(o.total, L)}.`, hi: `धन्यवाद! हमें ${money(o.total, L)} का आपका ऑर्डर मिल गया है।` }),
    heading: pick(L, { en: "Thank you for your order", hi: "आपके ऑर्डर के लिए धन्यवाद" }),
    name: firstName(o),
    body:
      p(pick(L, {
        en: cod
          ? "Your order is confirmed. Please keep the amount ready in cash when it's delivered."
          : "Your payment was successful and your order is confirmed.",
        hi: cod
          ? "आपका ऑर्डर पुष्ट हो गया है। डिलीवरी के समय कृपया राशि नकद तैयार रखें।"
          : "आपका भुगतान सफल रहा और आपका ऑर्डर पुष्ट हो गया है।",
      })) +
      p(pick(L, {
        en: "Each item is now going through its Prana Pratishtha (consecration) before we pack it. We'll email you again with tracking details as soon as it ships.",
        hi: "पैक करने से पहले हर वस्तु की अब प्राण-प्रतिष्ठा की जा रही है। भेजते ही हम आपको ट्रैकिंग विवरण के साथ फिर ईमेल करेंगे।",
      })) +
      details([
        [pick(L, { en: "Order number", hi: "ऑर्डर संख्या" }), `<b>${esc(o.orderNo)}</b>`],
        [pick(L, { en: "Payment", hi: "भुगतान" }), esc(pick(L, METHOD[o.payment?.method ?? "online"] ?? METHOD.online!))],
        [pick(L, { en: "Delivering to", hi: "डिलीवरी पता" }), address(o)],
      ]) +
      itemsBlock(o, L),
    cta: orderCta(o, L),
    after: o.userId
      ? undefined
      : pick(L, { en: `Keep this email for your records. Reply to it with your order number ${o.orderNo} if you need anything.`, hi: `इस ईमेल को सँभालकर रखें। कुछ भी चाहिए तो अपने ऑर्डर नंबर ${o.orderNo} के साथ इसका उत्तर दें।` }),
  });
}

export function orderShippedTemplate(o: OrderDoc) {
  const L = localeOf(o);
  const s = o.shipment;
  const tracking = s?.trackingUrl
    ? `<a href="${esc(s.trackingUrl)}" style="color:#785600">${esc(s.awbCode || pick(L, { en: "Track", hi: "ट्रैक करें" }))}</a>`
    : esc(s?.awbCode ?? "");
  return renderEmail({
    locale: L,
    subject: pick(L, { en: `Your order is on its way — ${o.orderNo}`, hi: `आपका ऑर्डर रास्ते में है — ${o.orderNo}` }),
    preheader: pick(L, { en: "Your consecrated items have been packed and handed to the courier.", hi: "आपकी प्राण-प्रतिष्ठित वस्तुएँ पैक होकर कूरियर को सौंप दी गई हैं।" }),
    heading: pick(L, { en: "Your order has shipped", hi: "आपका ऑर्डर भेज दिया गया है" }),
    name: firstName(o),
    body:
      p(pick(L, { en: "Good news — your order has been packed with care and handed to our courier partner.", hi: "अच्छी खबर — आपका ऑर्डर ध्यान से पैक करके हमारे कूरियर साथी को सौंप दिया गया है।" })) +
      details([
        [pick(L, { en: "Order number", hi: "ऑर्डर संख्या" }), `<b>${esc(o.orderNo)}</b>`],
        [pick(L, { en: "Courier", hi: "कूरियर" }), esc(s?.courierName ?? "")],
        [pick(L, { en: "Tracking number", hi: "ट्रैकिंग नंबर" }), tracking],
        [pick(L, { en: "Delivering to", hi: "डिलीवरी पता" }), address(o)],
      ]) +
      (o.payment?.method === "cod"
        ? note(pick(L, { en: `Please keep ${money(o.total, L)} ready in cash for the delivery person.`, hi: `कृपया डिलीवरी के समय ${money(o.total, L)} नकद तैयार रखें।` }))
        : ""),
    cta: s?.trackingUrl
      ? { label: pick(L, { en: "Track my parcel", hi: "मेरा पार्सल ट्रैक करें" }), url: s.trackingUrl }
      : orderCta(o, L),
  });
}

export function orderDeliveredTemplate(o: OrderDoc) {
  const L = localeOf(o);
  return renderEmail({
    locale: L,
    subject: pick(L, { en: `Delivered — ${o.orderNo}`, hi: `डिलीवर हो गया — ${o.orderNo}` }),
    heading: pick(L, { en: "Your order has been delivered", hi: "आपका ऑर्डर डिलीवर हो गया है" }),
    name: firstName(o),
    body:
      p(pick(L, {
        en: `Your order <b>${esc(o.orderNo)}</b> has been delivered. We hope it brings peace and positive energy to your home.`,
        hi: `आपका ऑर्डर <b>${esc(o.orderNo)}</b> डिलीवर हो गया है। आशा है यह आपके घर में शांति और सकारात्मक ऊर्जा लाए।`,
      })) +
      note(pick(L, {
        en: "If anything isn't right, you can request a return from My Orders within the return window, or simply reply to this email.",
        hi: "अगर कुछ ठीक नहीं है, तो आप रिटर्न अवधि में “मेरे ऑर्डर” से रिटर्न का अनुरोध कर सकते हैं, या इस ईमेल का उत्तर दें।",
      })),
    cta: orderCta(o, L),
  });
}

export function orderCancelledTemplate(o: OrderDoc) {
  const L = localeOf(o);
  const paidOnline = o.payment?.status === "captured" && o.payment?.method !== "cod";
  return renderEmail({
    locale: L,
    subject: pick(L, { en: `Order cancelled — ${o.orderNo}`, hi: `ऑर्डर रद्द — ${o.orderNo}` }),
    heading: pick(L, { en: "Your order has been cancelled", hi: "आपका ऑर्डर रद्द कर दिया गया है" }),
    name: firstName(o),
    body:
      p(pick(L, { en: `Your order <b>${esc(o.orderNo)}</b> has been cancelled.`, hi: `आपका ऑर्डर <b>${esc(o.orderNo)}</b> रद्द कर दिया गया है।` })) +
      p(pick(L, {
        en: paidOnline
          ? "Since you paid online, we'll refund the amount to your original payment method. You'll get another email when the refund is issued."
          : "No payment was taken, so there's nothing to refund.",
        hi: paidOnline
          ? "चूँकि आपने ऑनलाइन भुगतान किया था, राशि आपके मूल भुगतान माध्यम में वापस की जाएगी। रिफ़ंड जारी होने पर आपको एक और ईमेल मिलेगा।"
          : "कोई भुगतान नहीं लिया गया था, इसलिए कुछ भी वापस करने की आवश्यकता नहीं है।",
      })),
    cta: { label: pick(L, { en: "Continue shopping", hi: "खरीदारी जारी रखें" }), url: siteUrl(L, "/shop") },
  });
}

export function orderRefundedTemplate(o: OrderDoc) {
  const L = localeOf(o);
  const amount = o.payment?.refundAmount || o.total;
  const online = Boolean(o.payment?.transactionId);
  return renderEmail({
    locale: L,
    subject: pick(L, { en: `Refund issued — ${o.orderNo}`, hi: `रिफ़ंड जारी — ${o.orderNo}` }),
    heading: pick(L, { en: "Your refund is on its way", hi: "आपका रिफ़ंड भेज दिया गया है" }),
    name: firstName(o),
    body:
      p(pick(L, {
        en: online
          ? `We've refunded <b>${money(amount, L)}</b> for order <b>${esc(o.orderNo)}</b> to your original payment method.`
          : `Order <b>${esc(o.orderNo)}</b> has been marked as refunded.`,
        hi: online
          ? `ऑर्डर <b>${esc(o.orderNo)}</b> के लिए <b>${money(amount, L)}</b> आपके मूल भुगतान माध्यम में वापस भेज दिए गए हैं।`
          : `ऑर्डर <b>${esc(o.orderNo)}</b> को रिफ़ंड के रूप में चिह्नित कर दिया गया है।`,
      })) +
      (online
        ? note(pick(L, {
            en: "UPI and wallet refunds usually arrive within minutes. Card and net-banking refunds can take 5–7 working days, depending on your bank.",
            hi: "UPI और वॉलेट रिफ़ंड आमतौर पर कुछ ही मिनटों में आ जाते हैं। कार्ड और नेट-बैंकिंग रिफ़ंड में बैंक के अनुसार 5–7 कार्य-दिवस लग सकते हैं।",
          }))
        : ""),
    cta: orderCta(o, L),
  });
}

/** To the team: a new order needs attention. */
export function adminNewOrderTemplate(o: OrderDoc) {
  const L: EmailLocale = "en";
  const cod = o.payment?.method === "cod";
  return renderEmail({
    locale: L,
    subject: `New order ${o.orderNo} — ${money(o.total, L)}${cod ? " (COD)" : ""}`,
    heading: "New order received",
    body:
      details([
        ["Order", `<b>${esc(o.orderNo)}</b>`],
        ["Customer", `${esc(`${o.shippingAddress?.firstName ?? ""} ${o.shippingAddress?.lastName ?? ""}`.trim())} · ${esc(o.email)}`],
        ["Payment", cod ? "Cash on delivery — verify the order before packing" : "Paid online"],
        ["Ship to", address(o)],
      ]) + itemsBlock(o, L),
    cta: { label: "Open in admin", url: adminUrl("/orders") },
  });
}
