/** Promos, consultation services, curated collections and singleton site settings. */

export const promoSeeds = [
  { code: "SHANTI20", kind: "percent" as const, amount: 20, minSubtotal: 0 },
  { code: "SEEKER200", kind: "flat" as const, amount: 200, minSubtotal: 1000 },
];

export const consultationServiceSeeds = [
  {
    key: "astro" as const,
    name: { en: "Astro Consultancy", hi: "ज्योतिष परामर्श" },
    meta: { en: "45 Mins • Detailed Reading", hi: "45 मिनट • विस्तृत अध्ययन" },
    durationMins: 45,
    price: 1100,
    icon: "stars",
    order: 1,
  },
  {
    key: "vastu" as const,
    name: { en: "Vastu Shastra", hi: "वास्तु शास्त्र" },
    meta: { en: "60 Mins • Spatial Harmony", hi: "60 मिनट • स्थानिक सामंजस्य" },
    durationMins: 60,
    price: 2100,
    icon: "home_work",
    order: 2,
  },
  {
    key: "gem" as const,
    name: { en: "Gemstone Advice", hi: "रत्न परामर्श" },
    meta: { en: "30 Mins • Energy Alignment", hi: "30 मिनट • ऊर्जा संरेखण" },
    durationMins: 30,
    price: 750,
    icon: "diamond",
    order: 3,
  },
];

/** Online poojas performed on the devotee's behalf (recording shared afterwards). */
export const poojaServiceSeeds = [
  {
    slug: "rudrabhishek",
    name: { en: "Rudrabhishek", hi: "रुद्राभिषेक" },
    description: {
      en: "Sacred abhishek of Lord Shiva with Rudri path, for health, peace and removal of obstacles.",
      hi: "रुद्री पाठ सहित भगवान शिव का पवित्र अभिषेक — स्वास्थ्य, शांति और बाधा निवारण हेतु।",
    },
    durationMins: 90,
    price: 2100,
    icon: "water_drop",
    order: 1,
  },
  {
    slug: "satyanarayan-katha",
    name: { en: "Satyanarayan Katha", hi: "सत्यनारायण कथा" },
    description: {
      en: "Katha and puja of Lord Satyanarayan for prosperity, gratitude and family well-being.",
      hi: "समृद्धि, कृतज्ञता और पारिवारिक कल्याण हेतु भगवान सत्यनारायण की कथा एवं पूजा।",
    },
    durationMins: 120,
    price: 1100,
    icon: "auto_stories",
    order: 2,
  },
  {
    slug: "navgraha-shanti",
    name: { en: "Navgraha Shanti Puja", hi: "नवग्रह शांति पूजा" },
    description: {
      en: "Propitiation of the nine planets to ease malefic influences in your birth chart.",
      hi: "जन्म कुंडली के अशुभ ग्रह प्रभावों को शांत करने हेतु नवग्रहों की पूजा।",
    },
    durationMins: 120,
    price: 3100,
    icon: "public",
    order: 3,
  },
  {
    slug: "lakshmi-puja",
    name: { en: "Lakshmi Puja", hi: "लक्ष्मी पूजा" },
    description: {
      en: "Worship of Maa Lakshmi for wealth, abundance and success in business.",
      hi: "धन, समृद्धि और व्यापार में सफलता हेतु माँ लक्ष्मी की पूजा।",
    },
    durationMins: 60,
    price: 1500,
    icon: "currency_rupee",
    order: 4,
  },
  {
    slug: "maha-mrityunjaya-jaap",
    name: { en: "Maha Mrityunjaya Jaap", hi: "महामृत्युंजय जाप" },
    description: {
      en: "1,25,000 chants of the Maha Mrityunjaya mantra (by a team of pandits) for longevity and protection.",
      hi: "दीर्घायु और रक्षा हेतु महामृत्युंजय मंत्र का सवा लाख जाप (पंडितों द्वारा)।",
    },
    durationMins: 180,
    price: 5100,
    icon: "self_improvement",
    order: 5,
  },
  {
    slug: "ganesh-puja",
    name: { en: "Ganesh Puja", hi: "गणेश पूजा" },
    description: {
      en: "Worship of Lord Ganesha for auspicious beginnings and removal of obstacles.",
      hi: "शुभ आरंभ और विघ्न निवारण हेतु भगवान गणेश की पूजा।",
    },
    durationMins: 60,
    price: 1100,
    icon: "temple_hindu",
    order: 6,
  },
];

export const collectionSeeds = [
  {
    slug: "new-home",
    title: { en: "New Home", hi: "नया घर" },
    description: {
      en: "Sacred tools and Vastu elements to bless your new sanctuary with peace and positive energy.",
      hi: "आपके नए आश्रय को शांति और सकारात्मक ऊर्जा से आशीषित करने हेतु पवित्र उपकरण और वास्तु तत्व।",
    },
    filter: { need: "newhome" },
    order: 1,
  },
  {
    slug: "vehicle-protection",
    title: { en: "Vehicle Protection", hi: "वाहन सुरक्षा" },
    description: {
      en: "Divine yantras and protective amulets to safeguard your journeys and ensure safe travels.",
      hi: "आपकी यात्राओं की रक्षा और सुरक्षित यात्रा सुनिश्चित करने हेतु दिव्य यंत्र और सुरक्षा कवच।",
    },
    filter: { need: "vehicle" },
    order: 2,
  },
  {
    slug: "business-growth",
    title: { en: "Business Growth", hi: "व्यापार वृद्धि" },
    description: {
      en: "Vedic solutions and auspicious symbols to invite prosperity and steady growth to your enterprise.",
      hi: "आपके उद्यम में समृद्धि और स्थिर वृद्धि आमंत्रित करने हेतु वैदिक समाधान और शुभ प्रतीक।",
    },
    filter: { need: "business" },
    order: 3,
  },
  {
    slug: "personal-prosperity",
    title: { en: "Personal Prosperity", hi: "व्यक्तिगत समृद्धि" },
    description: {
      en: "Spiritual aids and gems curated to align your personal vibrations with abundance and well-being.",
      hi: "आपके व्यक्तिगत स्पंदनों को प्रचुरता और कल्याण से संरेखित करने हेतु आध्यात्मिक सहायक और रत्न।",
    },
    filter: { need: "prosperity" },
    order: 4,
  },
];

export const siteSettingsSeed = {
  key: "default",
  name: "Vastukosh",
  legalName: "Vastukosh Spiritual Solutions",
  domain: "vastukosh.com",
  logoUrl: "/icon.svg",
  email: "support@vastukosh.com",
  phone: "+91 98765 43210",
  addressText: "108 Harmony Way, Spiritual District, New Delhi, 110001, India",
  socials: [
    { label: "Instagram", href: "https://instagram.com", icon: "photo_camera" },
    { label: "YouTube", href: "https://youtube.com", icon: "smart_display" },
    { label: "Facebook", href: "https://facebook.com", icon: "thumb_up" },
    { label: "WhatsApp", href: "https://wa.me/919876543210", icon: "chat" },
  ],
  sameAs: ["https://instagram.com", "https://youtube.com", "https://facebook.com"],
};
