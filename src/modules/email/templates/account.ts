import { env } from "../../../config/env.js";
import { type EmailLocale, details, esc, note, p, pick, renderEmail, siteUrl } from "../layout.js";

type Who = { name: string; email: string; locale: EmailLocale };

export function verifyEmailTemplate(u: Who, url: string) {
  const L = u.locale;
  return renderEmail({
    locale: L,
    subject: pick(L, { en: "Please confirm your email — Vastukosh", hi: "कृपया अपना ईमेल पुष्ट करें — वास्तुकोश" }),
    preheader: pick(L, { en: "One click to confirm your email and finish setting up your account.", hi: "अपना ईमेल पुष्ट करने और खाता पूरा करने के लिए एक क्लिक।" }),
    heading: pick(L, { en: "Confirm your email", hi: "अपना ईमेल पुष्ट करें" }),
    name: u.name,
    body:
      p(pick(L, {
        en: `Welcome to Vastukosh! Please confirm that <b>${esc(u.email)}</b> is your email address, so we can send you order updates, booking links and receipts.`,
        hi: `वास्तुकोश में आपका स्वागत है! कृपया पुष्टि करें कि <b>${esc(u.email)}</b> आपका ईमेल पता है, ताकि हम आपको ऑर्डर अपडेट, बुकिंग लिंक और रसीदें भेज सकें।`,
      })),
    cta: { label: pick(L, { en: "Confirm my email", hi: "मेरा ईमेल पुष्ट करें" }), url },
    after: pick(L, {
      en: `This link works for ${env.EMAIL_VERIFY_TTL.replace("h", " hours")}. If you didn't create a Vastukosh account, you can ignore this email.`,
      hi: `यह लिंक ${env.EMAIL_VERIFY_TTL.replace("h", " घंटे")} तक काम करेगा। अगर आपने वास्तुकोश खाता नहीं बनाया है, तो इस ईमेल को अनदेखा करें।`,
    }),
  });
}

export function welcomeTemplate(u: Who) {
  const L = u.locale;
  return renderEmail({
    locale: L,
    subject: pick(L, { en: "Welcome to Vastukosh", hi: "वास्तुकोश में आपका स्वागत है" }),
    preheader: pick(L, { en: "Your account is ready — here's what you can do.", hi: "आपका खाता तैयार है — आप क्या-क्या कर सकते हैं।" }),
    heading: pick(L, { en: "Your account is ready", hi: "आपका खाता तैयार है" }),
    name: u.name,
    body:
      p(pick(L, { en: "Thank you for joining Vastukosh. With your account you can:", hi: "वास्तुकोश से जुड़ने के लिए धन्यवाद। अपने खाते से आप:" })) +
      p(pick(L, {
        en: "• Shop consecrated idols, yantras, crystals and malas<br>• Book Vastu and astrology consultations with our experts<br>• Book an online pooja performed in your name<br>• Track every order and booking in one place",
        hi: "• प्राण-प्रतिष्ठित मूर्तियाँ, यंत्र, क्रिस्टल और मालाएँ खरीद सकते हैं<br>• हमारे विशेषज्ञों से वास्तु और ज्योतिष परामर्श बुक कर सकते हैं<br>• अपने नाम से ऑनलाइन पूजा बुक कर सकते हैं<br>• हर ऑर्डर और बुकिंग एक ही जगह देख सकते हैं",
      })),
    cta: { label: pick(L, { en: "Explore the shop", hi: "दुकान देखें" }), url: siteUrl(L, "/shop") },
  });
}

export function passwordResetTemplate(u: Who, url: string) {
  const L = u.locale;
  return renderEmail({
    locale: L,
    subject: pick(L, { en: "Reset your Vastukosh password", hi: "अपना वास्तुकोश पासवर्ड रीसेट करें" }),
    preheader: pick(L, { en: "Use this link to choose a new password.", hi: "नया पासवर्ड चुनने के लिए यह लिंक इस्तेमाल करें।" }),
    heading: pick(L, { en: "Choose a new password", hi: "नया पासवर्ड चुनें" }),
    name: u.name,
    body: p(pick(L, {
      en: "We received a request to reset the password for your Vastukosh account. Click the button below to choose a new one.",
      hi: "आपके वास्तुकोश खाते का पासवर्ड रीसेट करने का अनुरोध मिला है। नया पासवर्ड चुनने के लिए नीचे दिए बटन पर क्लिक करें।",
    })),
    cta: { label: pick(L, { en: "Reset password", hi: "पासवर्ड रीसेट करें" }), url },
    after: pick(L, {
      en: `This link expires in ${env.PASSWORD_RESET_TTL.replace("h", " hour")} and can be used once. If you didn't ask for this, ignore this email — your password stays the same.`,
      hi: `यह लिंक ${env.PASSWORD_RESET_TTL.replace("h", " घंटे")} में समाप्त हो जाएगा और केवल एक बार काम करेगा। अगर आपने यह अनुरोध नहीं किया, तो इस ईमेल को अनदेखा करें — आपका पासवर्ड वही रहेगा।`,
    }),
  });
}

export function passwordChangedTemplate(u: Who) {
  const L = u.locale;
  const when = new Date().toLocaleString(L === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  return renderEmail({
    locale: L,
    subject: pick(L, { en: "Your Vastukosh password was changed", hi: "आपका वास्तुकोश पासवर्ड बदल दिया गया" }),
    heading: pick(L, { en: "Your password was changed", hi: "आपका पासवर्ड बदल दिया गया" }),
    name: u.name,
    body:
      p(pick(L, {
        en: "The password for your Vastukosh account was just changed, and you've been signed out on all devices.",
        hi: "आपके वास्तुकोश खाते का पासवर्ड अभी बदला गया है, और आपको सभी डिवाइस से साइन आउट कर दिया गया है।",
      })) +
      details([[pick(L, { en: "When", hi: "कब" }), `${esc(when)} IST`]]) +
      note(pick(L, {
        en: "If this was you, there's nothing else to do. If it wasn't, reset your password right away and reply to this email so we can help.",
        hi: "अगर यह आपने किया है, तो कुछ और करने की ज़रूरत नहीं है। अगर नहीं, तो तुरंत पासवर्ड रीसेट करें और इस ईमेल का उत्तर दें ताकि हम मदद कर सकें।",
      })),
    cta: { label: pick(L, { en: "Sign in", hi: "साइन इन करें" }), url: siteUrl(L, "/login") },
  });
}
