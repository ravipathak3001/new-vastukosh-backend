import { type EmailLocale, adminUrl, details, esc, money, note, p, pick, renderEmail, siteUrl } from "../layout.js";

type Who = { name: string; locale: EmailLocale };
const panel = (L: EmailLocale, path = "") => siteUrl(L, `/expert${path}`);

export function expertApplicationReceivedTemplate(u: Who) {
  const L = u.locale;
  return renderEmail({
    locale: L,
    subject: pick(L, { en: "We've received your expert application", hi: "हमें आपका विशेषज्ञ आवेदन मिल गया है" }),
    heading: pick(L, { en: "Thank you for applying", hi: "आवेदन के लिए धन्यवाद" }),
    name: u.name,
    body:
      p(pick(L, {
        en: "Our team will review your profile, usually within 2–3 working days. We'll email you as soon as there's a decision.",
        hi: "हमारी टीम आमतौर पर 2–3 कार्य-दिवसों में आपकी प्रोफ़ाइल की समीक्षा करेगी। निर्णय होते ही हम आपको ईमेल करेंगे।",
      })) +
      p(pick(L, {
        en: "Meanwhile, set up your services and prices, working hours and payout details in your expert panel, so you can start taking bookings the moment you're approved.",
        hi: "तब तक अपने विशेषज्ञ पैनल में अपनी सेवाएँ और शुल्क, कार्य-समय और भुगतान विवरण सेट कर लें, ताकि स्वीकृति मिलते ही आप बुकिंग लेना शुरू कर सकें।",
      })),
    cta: { label: pick(L, { en: "Open my expert panel", hi: "मेरा विशेषज्ञ पैनल खोलें" }), url: panel(L) },
  });
}

export function expertStatusTemplate(u: Who, status: "approved" | "rejected" | "suspended", noteText: string, profileUrl: string) {
  const L = u.locale;
  if (status === "approved") {
    return renderEmail({
      locale: L,
      subject: pick(L, { en: "You're approved — welcome to Vastukosh experts", hi: "आप स्वीकृत हैं — वास्तुकोश विशेषज्ञों में आपका स्वागत है" }),
      heading: pick(L, { en: "Your profile is live", hi: "आपकी प्रोफ़ाइल लाइव है" }),
      name: u.name,
      body:
        p(pick(L, {
          en: "Congratulations! Your expert profile has been approved and customers can now find and book you.",
          hi: "बधाई हो! आपकी विशेषज्ञ प्रोफ़ाइल स्वीकृत हो गई है और अब ग्राहक आपको ढूँढकर बुक कर सकते हैं।",
        })) +
        p(pick(L, {
          en: "When someone books you, we'll email you right away. Confirm each booking from your panel; your earnings become available to cash out once the session is completed.",
          hi: "जब कोई आपको बुक करेगा, हम तुरंत आपको ईमेल करेंगे। हर बुकिंग पैनल से पुष्ट करें; सत्र पूरा होने के बाद आपकी कमाई कैशआउट के लिए उपलब्ध हो जाती है।",
        })) +
        note(pick(L, { en: `Your public profile: <a href="${esc(profileUrl)}" style="color:#785600">${esc(profileUrl)}</a>`, hi: `आपकी सार्वजनिक प्रोफ़ाइल: <a href="${esc(profileUrl)}" style="color:#785600">${esc(profileUrl)}</a>` })),
      cta: { label: pick(L, { en: "Open my expert panel", hi: "मेरा विशेषज्ञ पैनल खोलें" }), url: panel(L) },
    });
  }
  const rejected = status === "rejected";
  return renderEmail({
    locale: L,
    subject: rejected
      ? pick(L, { en: "Update on your expert application", hi: "आपके विशेषज्ञ आवेदन पर अपडेट" })
      : pick(L, { en: "Your expert profile has been paused", hi: "आपकी विशेषज्ञ प्रोफ़ाइल रोक दी गई है" }),
    heading: rejected
      ? pick(L, { en: "We couldn't approve your application yet", hi: "हम अभी आपका आवेदन स्वीकृत नहीं कर सके" })
      : pick(L, { en: "Your profile is paused", hi: "आपकी प्रोफ़ाइल रोकी गई है" }),
    name: u.name,
    body:
      p(rejected
        ? pick(L, { en: "Thank you for your interest. After reviewing your profile, we're not able to approve it at this time.", hi: "आपकी रुचि के लिए धन्यवाद। आपकी प्रोफ़ाइल की समीक्षा के बाद हम अभी इसे स्वीकृत नहीं कर पा रहे हैं।" })
        : pick(L, { en: "Your profile is hidden from customers for now and new bookings are paused.", hi: "आपकी प्रोफ़ाइल फ़िलहाल ग्राहकों से छिपी है और नई बुकिंग रुकी हुई हैं।" })) +
      (noteText ? details([[pick(L, { en: "Reason", hi: "कारण" }), `<i>${esc(noteText)}</i>`]]) : "") +
      note(pick(L, { en: "You can update your profile and reply to this email if you'd like us to take another look.", hi: "आप अपनी प्रोफ़ाइल अपडेट कर सकते हैं और दोबारा समीक्षा के लिए इस ईमेल का उत्तर दे सकते हैं।" })),
    cta: { label: pick(L, { en: "Update my profile", hi: "मेरी प्रोफ़ाइल अपडेट करें" }), url: panel(L, "/profile") },
  });
}

export function expertPayoutPaidTemplate(u: Who, payout: { payoutNo: string; amount: number; reference: string; destination: string }) {
  const L = u.locale;
  return renderEmail({
    locale: L,
    subject: pick(L, { en: `Cashout paid — ${money(payout.amount, L)}`, hi: `कैशआउट भुगतान — ${money(payout.amount, L)}` }),
    heading: pick(L, { en: "Your cashout has been paid", hi: "आपके कैशआउट का भुगतान हो गया है" }),
    name: u.name,
    body:
      p(pick(L, { en: "We've sent your earnings to your payout account.", hi: "हमने आपकी कमाई आपके भुगतान खाते में भेज दी है।" })) +
      details([
        [pick(L, { en: "Amount", hi: "राशि" }), `<b>${money(payout.amount, L)}</b>`],
        [pick(L, { en: "Sent to", hi: "भेजा गया" }), esc(payout.destination)],
        [pick(L, { en: "Transaction reference", hi: "लेन-देन संदर्भ" }), esc(payout.reference)],
        [pick(L, { en: "Cashout", hi: "कैशआउट" }), esc(payout.payoutNo)],
      ]) +
      note(pick(L, { en: "Bank transfers can take a few hours to show in your account.", hi: "बैंक ट्रांसफ़र को आपके खाते में दिखने में कुछ घंटे लग सकते हैं।" })),
    cta: { label: pick(L, { en: "View earnings", hi: "कमाई देखें" }), url: panel(L, "/earnings") },
  });
}

export function expertPayoutRejectedTemplate(u: Who, payout: { payoutNo: string; amount: number; adminNote: string }) {
  const L = u.locale;
  return renderEmail({
    locale: L,
    subject: pick(L, { en: "Your cashout request needs attention", hi: "आपके कैशआउट अनुरोध पर ध्यान दें" }),
    heading: pick(L, { en: "We couldn't process your cashout", hi: "हम आपका कैशआउट प्रोसेस नहीं कर सके" }),
    name: u.name,
    body:
      p(pick(L, {
        en: `Your cashout of <b>${money(payout.amount, L)}</b> wasn't paid, and the amount has been returned to your wallet balance.`,
        hi: `<b>${money(payout.amount, L)}</b> का आपका कैशआउट भुगतान नहीं हुआ, और राशि आपके वॉलेट बैलेंस में वापस कर दी गई है।`,
      })) +
      details([[pick(L, { en: "Reason", hi: "कारण" }), `<i>${esc(payout.adminNote)}</i>`], [pick(L, { en: "Cashout", hi: "कैशआउट" }), esc(payout.payoutNo)]]) +
      note(pick(L, { en: "Fix the details mentioned above and request the cashout again.", hi: "ऊपर बताई गई जानकारी ठीक करें और फिर से कैशआउट का अनुरोध करें।" })),
    cta: { label: pick(L, { en: "Check payout details", hi: "भुगतान विवरण देखें" }), url: panel(L, "/profile#payout") },
  });
}

export function expertNewReviewTemplate(u: Who, review: { rating: number; comment: string; authorName: string }) {
  const L = u.locale;
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  return renderEmail({
    locale: L,
    subject: pick(L, { en: `New ${review.rating}-star review from ${review.authorName}`, hi: `${review.authorName} से नई ${review.rating}-स्टार समीक्षा` }),
    heading: pick(L, { en: "You have a new review", hi: "आपको एक नई समीक्षा मिली है" }),
    name: u.name,
    body:
      p(`<span style="font-size:20px;color:#c99a2e;letter-spacing:2px">${stars}</span>`) +
      (review.comment ? p(`“${esc(review.comment)}”`) : "") +
      note(`— ${esc(review.authorName)}`),
    cta: { label: pick(L, { en: "Open my expert panel", hi: "मेरा विशेषज्ञ पैनल खोलें" }), url: panel(L) },
  });
}

export function adminExpertApplicationTemplate(e: { id: string; displayName: string; email: string; specialities: string[]; city: string; experienceYears: number }) {
  return renderEmail({
    locale: "en",
    subject: `New expert application — ${e.displayName}`,
    heading: "New expert application",
    body: details([
      ["Name", `<b>${esc(e.displayName)}</b>`],
      ["Email", esc(e.email)],
      ["Specialities", esc(e.specialities.join(", "))],
      ["Experience", `${e.experienceYears} years`],
      ["City", esc(e.city)],
    ]) + p("Check their profile and KYC details before approving."),
    cta: { label: "Review in admin", url: adminUrl(`/experts/${e.id}`) },
  });
}

export function adminPayoutRequestedTemplate(x: { payoutNo: string; amount: number; expertName: string; method: string; destination: string }) {
  return renderEmail({
    locale: "en",
    subject: `Cashout requested — ${x.expertName}, ${money(x.amount, "en")}`,
    heading: "An expert requested a cashout",
    body: details([
      ["Expert", `<b>${esc(x.expertName)}</b>`],
      ["Amount", money(x.amount, "en")],
      ["Pay to", `${esc(x.method.toUpperCase())} · ${esc(x.destination)}`],
      ["Cashout", esc(x.payoutNo)],
    ]) + p("Pay it by bank transfer or UPI, then mark it paid with the transaction reference."),
    cta: { label: "Open payouts", url: adminUrl("/payouts") },
  });
}
