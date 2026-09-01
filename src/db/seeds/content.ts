/** Ported from `frontend/data/{testimonials,faqs,legal}.ts`. */
const G = "https://lh3.googleusercontent.com/aida-public/";

export const testimonialSeeds = [
  {
    key: "arjun",
    name: "Arjun Patel",
    meta: { en: "Leo • London, UK", hi: "सिंह • लंदन, यूके" },
    rating: 5,
    quote: {
      en: "The Vastu consultation completely transformed the energy in our new home. The profound wisdom and clear guidance helped us align our space perfectly.",
      hi: "वास्तु परामर्श ने हमारे नए घर की ऊर्जा को पूरी तरह बदल दिया। गहन ज्ञान और स्पष्ट मार्गदर्शन ने हमें अपने स्थान को पूर्णतः संरेखित करने में मदद की।",
    },
    image: G + "AB6AXuDElOXYSCOZEEzhRkHuZi7BZvnAm3oo0hmpJk9Y-9wyq3Dw2HZcmxUsO0an25jpoS4jxrxjXsxShc5OoVfqKzYaPNPWMrbgA01BdC_TP4KOWM8BP9DQnkGixUMUrxX35Dy4uHUavxkTJ8bx_FNMDW1KR3s0y4xV3XRUoDM3--r351nPP87wxgRDev75ThZbGkjOde0sDjT6kB-vT6nBIGQAwKaSt7vcS90PnaGubMqFZRcmdLhJZf67JA",
    order: 1,
  },
  {
    key: "meera",
    name: "Meera Desai",
    meta: { en: "Cancer • Mumbai, IN", hi: "कर्क • मुंबई, भारत" },
    rating: 5,
    quote: {
      en: "Understanding my birth chart gave me incredible clarity during a major career transition. Truly sacred and practical guidance.",
      hi: "अपनी जन्म कुंडली को समझने से मुझे एक बड़े करियर बदलाव के दौरान अद्भुत स्पष्टता मिली। वास्तव में पवित्र और व्यावहारिक मार्गदर्शन।",
    },
    image: G + "AB6AXuD97YgXDZCmgZ7XLSSUCg7UezHUUyMO6RBVOZFHa6LVJdYm095A6eqdzF3WqQWKvS90quFBVhl8l11QL-hl7_s3E24gxRmrrPeKKYlioxcEHrlKAFD0H7C1rtfSMOhFKSLA6BClrQ9HBAFy3aBJfHzAhPPI8juFU4Ts9_MZfFCAvZbhUM_hGHSKMe5ehg_1jC9fHWwdoMVFdtyO7_UjHerwtL0eRDxDYUwqDjLYU4r3TZvfU0kryeC7XA",
    order: 2,
  },
  {
    key: "david",
    name: "David Chen",
    meta: { en: "Taurus • Toronto, CA", hi: "वृषभ • टोरंटो, कनाडा" },
    rating: 5,
    quote: {
      en: "I was skeptical initially, but the depth of knowledge and the peace it brought to my daily life is undeniable. Highly recommend their spiritual services.",
      hi: "शुरू में मैं संशय में था, लेकिन ज्ञान की गहराई और मेरे दैनिक जीवन में इससे आई शांति निर्विवाद है। इनकी आध्यात्मिक सेवाओं की पुरज़ोर अनुशंसा करता हूँ।",
    },
    image: G + "AB6AXuBWzYmpv2tVizNXpKeaa6Z1zgcokthq5ZYR5P-u5LfXict4rUHmjG1CcUN151WYIgH-GqbhjVvkx3jtfHlUwpWvvEHlcllWSF4dtFSKY0txbEH4cshd3IfjedqakM1gsVzXkU_r9luSJI8cnynjNBx-uuU7MnLPH9WnAL_ML801JnWHoup_JrKdmPzi42L7wKVXlZR-cv1DG-pB8zY7iEXMCh99_X99cdABUhRm3R7Xcyy88XzuqDBtdg",
    order: 3,
  },
  {
    key: "priya",
    name: "Priya Sharma",
    meta: { en: "Virgo • New York, US", hi: "कन्या • न्यूयॉर्क, यूएस" },
    rating: 5,
    quote: {
      en: "The daily horoscope insights are remarkably accurate and serve as a beautiful anchor for my morning routine. A truly enlightened platform.",
      hi: "दैनिक राशिफल की अंतर्दृष्टि उल्लेखनीय रूप से सटीक है और मेरी सुबह की दिनचर्या के लिए एक सुंदर आधार बनती है। वास्तव में एक प्रबुद्ध मंच।",
    },
    image: G + "AB6AXuCPFTBoDOX4T-FjGzHZEFJQr3mVq-zSxnRJ07BAiT5bMAU4eIDNW2oi56rOEiOqF8zy6d940F4kkfcw5VtmqsIulbIzbQWSMhH1NwNzN4yxSbn9cTJ26nzjmOdKdFAlnCQZLPc5FFKWDz6q6wjJpiwDzSLeRfzcxf-6GijJpAN8Oki-t4XazOhnf-EbL7D4nO_rb4-jae-exTnslfYmKZuTJ5vKsxs-MVxPl6DCTW8bEzSVlWhhZzKW0Q",
    order: 4,
  },
  {
    key: "vikram",
    name: "Vikram Singh",
    meta: { en: "Scorpio • Delhi, IN", hi: "वृश्चिक • दिल्ली, भारत" },
    rating: 5,
    wide: true,
    quote: {
      en: "Finding a digital space that respects traditional Vedic principles while offering a seamless, modern experience is rare. The consultation I had was profound, deeply rooted in ancient wisdom, yet perfectly applicable to my contemporary life challenges.",
      hi: "एक ऐसा डिजिटल स्थान खोजना दुर्लभ है जो पारंपरिक वैदिक सिद्धांतों का सम्मान करते हुए एक सहज, आधुनिक अनुभव प्रदान करे। मेरा परामर्श गहन था, प्राचीन ज्ञान में गहराई से निहित, फिर भी मेरी समकालीन जीवन-चुनौतियों पर पूर्णतः लागू।",
    },
    image: G + "AB6AXuDJu-I-_5A9Wo3bsE8TFd8rItRfyWoYMQz8bUgZQOgSLuNfT5kUlWxxGscGXzUAi8H2k75P3MHYFLkCumGc2hpwT-raks2AvlsvpGNU6go7SI3uYnPu57hMNhPWfO_XBz-8ZOyUZfzqJiMa13eewr8KwguSFcjNFCUW-Gn4oPXag3iDIefjAe6CxQd_R-rKLL0KQt8OPWbtCmmSON72Sfd21utbR_7KqVyOVSlAWMcYroFLlq4y1x_G0w",
    order: 5,
  },
  {
    key: "ananya",
    name: "Ananya Iyer",
    meta: { en: "Pisces • Bengaluru, IN", hi: "मीन • बेंगलुरु, भारत" },
    rating: 5,
    quote: {
      en: "The consecrated Ganesha we received for our shop opening felt different the moment we unwrapped it. Our team noticed the calm.",
      hi: "हमारी दुकान के उद्घाटन के लिए मिली प्राण-प्रतिष्ठित गणेश प्रतिमा को खोलते ही अलग महसूस हुई। हमारी टीम ने उस शांति को महसूस किया।",
    },
    image: G + "AB6AXuCcmEFl7f6kOQphA2yJ5Rpx7oT-4Z7rgDYHqhoTcC9gCtVjZBwhinUF0IJOunWTg8ouFcz8jZZkhp0nN4PxOdmj5wOOGbcbTrEpfKinsXpktfML98gxplxaI6vxbUqX3lKAGp7EcCmmhlNoaPXzT_AzM9OW-7wArUB47Z-SU3cn2kLhWKlLEpho1oNa_kjPvhj-NkbAM9reMAm3ncIphEkihPWOau3pDj7VpxMBGDLS88rh-SJ5B4Psxw",
    order: 6,
  },
];

const faqPairs: [string, string, string, string][] = [
  [
    "What is Vastu Shastra?",
    "वास्तु शास्त्र क्या है?",
    "Vastu Shastra is an ancient Indian science of architecture and construction that aims to harmonize buildings with the natural environment and cosmic energies for prosperity and peace.",
    "वास्तु शास्त्र वास्तुकला और निर्माण का एक प्राचीन भारतीय विज्ञान है जिसका उद्देश्य समृद्धि और शांति के लिए भवनों को प्राकृतिक पर्यावरण और ब्रह्मांडीय ऊर्जाओं के साथ सामंजस्य में लाना है।",
  ],
  [
    "How can astrology help me?",
    "ज्योतिष मेरी कैसे मदद कर सकता है?",
    "Astrology provides insights into your personality, life path, and timing of events based on celestial positions, helping you make informed decisions and understand your unique potential.",
    "ज्योतिष खगोलीय स्थितियों के आधार पर आपके व्यक्तित्व, जीवन-पथ और घटनाओं के समय के बारे में अंतर्दृष्टि देता है, जिससे आपको सूचित निर्णय लेने और अपनी अनूठी क्षमता समझने में मदद मिलती है।",
  ],
  [
    "Are your products authentic?",
    "क्या आपके उत्पाद प्रामाणिक हैं?",
    "Yes, all our products are sourced through traditional channels and are certified by authorized labs to ensure spiritual purity and material quality.",
    "हाँ, हमारे सभी उत्पाद पारंपरिक माध्यमों से प्राप्त किए जाते हैं और आध्यात्मिक शुद्धता व सामग्री की गुणवत्ता सुनिश्चित करने के लिए अधिकृत प्रयोगशालाओं द्वारा प्रमाणित हैं।",
  ],
  [
    "What is a Kundali?",
    "कुंडली क्या है?",
    "A Kundali, or birth chart, is a map of the heavens at the exact moment of your birth, used in Vedic astrology to predict life events and determine planetary influences.",
    "कुंडली, या जन्म-चक्र, आपके जन्म के ठीक क्षण में आकाश का एक मानचित्र है, जिसका उपयोग वैदिक ज्योतिष में जीवन-घटनाओं की भविष्यवाणी और ग्रहों के प्रभाव निर्धारित करने के लिए किया जाता है।",
  ],
  [
    "How do I choose the right Yantra?",
    "मैं सही यंत्र कैसे चुनूँ?",
    "Choosing a Yantra depends on your specific goals — such as prosperity, protection, or health. We recommend consulting with our experts to find the one aligned with your Rashi and purpose.",
    "यंत्र का चुनाव आपके विशिष्ट लक्ष्यों — जैसे समृद्धि, सुरक्षा या स्वास्थ्य — पर निर्भर करता है। हम अनुशंसा करते हैं कि आप अपनी राशि और उद्देश्य के अनुरूप यंत्र खोजने के लिए हमारे विशेषज्ञों से परामर्श करें।",
  ],
  [
    "Do you offer international shipping?",
    "क्या आप अंतरराष्ट्रीय शिपिंग देते हैं?",
    "Currently, we specialize in secure and sacred delivery across all of India. Please contact our support team for specific international inquiries.",
    "वर्तमान में, हम पूरे भारत में सुरक्षित और पवित्र डिलीवरी में विशेषज्ञ हैं। विशिष्ट अंतरराष्ट्रीय पूछताछ के लिए कृपया हमारी सहायता टीम से संपर्क करें।",
  ],
  [
    "What is the significance of Rudraksha?",
    "रुद्राक्ष का क्या महत्व है?",
    "Rudraksha beads are sacred seeds used for prayer and meditation, believed to provide spiritual protection and health benefits by aligning the wearer's energy.",
    "रुद्राक्ष के दाने प्रार्थना और ध्यान के लिए प्रयुक्त पवित्र बीज हैं, माना जाता है कि वे धारक की ऊर्जा को संरेखित कर आध्यात्मिक सुरक्षा और स्वास्थ्य-लाभ देते हैं।",
  ],
  [
    "How can I book a consultation?",
    "मैं परामर्श कैसे बुक करूँ?",
    "You can book a consultation from the Consultancy page in the navigation menu, or by using any 'Consult Now' button across the site.",
    "आप नेविगेशन मेनू में परामर्श पृष्ठ से, या साइट पर किसी भी 'अभी परामर्श करें' बटन से परामर्श बुक कर सकते हैं।",
  ],
  [
    "What is the return policy?",
    "वापसी नीति क्या है?",
    "We offer a comprehensive refund policy for damaged or incorrect items. Please refer to our 'Refund Policy' link in the footer for detailed terms.",
    "हम क्षतिग्रस्त या ग़लत वस्तुओं के लिए एक व्यापक धनवापसी नीति देते हैं। विस्तृत शर्तों के लिए कृपया फ़ुटर में 'धनवापसी नीति' लिंक देखें।",
  ],
  [
    "How are the products energized?",
    "उत्पादों को ऊर्जावान कैसे किया जाता है?",
    "Every item undergoes traditional Vedic rituals and consecration by learned priests to ensure it carries the intended spiritual vibration before reaching you.",
    "प्रत्येक वस्तु आप तक पहुँचने से पहले विद्वान पुजारियों द्वारा पारंपरिक वैदिक अनुष्ठानों और प्राण-प्रतिष्ठा से गुज़रती है ताकि वह इच्छित आध्यात्मिक स्पंदन धारण करे।",
  ],
];

export const faqSeeds = faqPairs.map(([qEn, qHi, aEn, aHi], i) => ({
  key: `faq-${i + 1}`,
  question: { en: qEn, hi: qHi },
  answer: { en: aEn, hi: aHi },
  order: i + 1,
}));

const legalIntro = (topic: string, hi: string) => ({
  heading: { en: "Overview", hi: "सिंहावलोकन" },
  body: {
    en: `This ${topic} explains how Vastukosh handles the matters below. It is a template for the rebuild — replace it with counsel-reviewed copy before launch.`,
    hi: `यह ${hi} बताता है कि वास्तुकोष नीचे दिए गए विषयों को कैसे संभालता है। यह पुनर्निर्माण के लिए एक टेम्पलेट है — लॉन्च से पहले इसे अधिवक्ता-समीक्षित सामग्री से बदलें।`,
  },
});

export const legalSeeds = [
  {
    slug: "privacy",
    title: { en: "Privacy Policy", hi: "गोपनीयता नीति" },
    sections: [
      legalIntro("Privacy Policy", "गोपनीयता नीति"),
      {
        heading: { en: "What we collect", hi: "हम क्या एकत्र करते हैं" },
        body: {
          en: "Contact details you submit, birth details you share for a consultation, and standard analytics about how the site is used.",
          hi: "आपके द्वारा प्रस्तुत संपर्क विवरण, परामर्श के लिए साझा किया गया जन्म विवरण, और साइट के उपयोग के बारे में सामान्य विश्लेषण।",
        },
      },
      {
        heading: { en: "How to reach us", hi: "हम तक कैसे पहुँचें" },
        body: {
          en: "Write to support@vastukosh.com for any request to access or delete your data.",
          hi: "अपने डेटा तक पहुँचने या उसे हटाने के किसी भी अनुरोध के लिए support@vastukosh.com पर लिखें।",
        },
      },
    ],
  },
  {
    slug: "terms",
    title: { en: "Terms of Service", hi: "सेवा की शर्तें" },
    sections: [
      legalIntro("Terms of Service", "सेवा की शर्तें"),
      {
        heading: { en: "Use of the site", hi: "साइट का उपयोग" },
        body: {
          en: "Content is offered for personal, non-commercial use. Consultations are guidance, not a substitute for professional medical, legal or financial advice.",
          hi: "सामग्री व्यक्तिगत, गैर-वाणिज्यिक उपयोग के लिए दी जाती है। परामर्श मार्गदर्शन है, पेशेवर चिकित्सा, कानूनी या वित्तीय सलाह का विकल्प नहीं।",
        },
      },
    ],
  },
  {
    slug: "shipping",
    title: { en: "Shipping Info", hi: "शिपिंग जानकारी" },
    sections: [
      legalIntro("Shipping policy", "शिपिंग नीति"),
      {
        heading: { en: "Dispatch & delivery", hi: "प्रेषण और डिलीवरी" },
        body: {
          en: "Consecrated items ship within 3–5 working days of the ritual completing. All-India delivery typically takes a further 3–7 days.",
          hi: "प्राण-प्रतिष्ठित वस्तुएँ अनुष्ठान पूरा होने के 3–5 कार्यदिवसों के भीतर भेजी जाती हैं। संपूर्ण भारत डिलीवरी में सामान्यतः 3–7 दिन और लगते हैं।",
        },
      },
    ],
  },
  {
    slug: "refund",
    title: { en: "Refund Policy", hi: "धनवापसी नीति" },
    sections: [
      legalIntro("Refund Policy", "धनवापसी नीति"),
      {
        heading: { en: "Damaged or incorrect items", hi: "क्षतिग्रस्त या ग़लत वस्तुएँ" },
        body: {
          en: "Report within 48 hours of delivery with photos and we will replace the item or refund it in full.",
          hi: "डिलीवरी के 48 घंटों के भीतर तस्वीरों सहित सूचित करें और हम वस्तु बदल देंगे या पूरा धन वापस कर देंगे।",
        },
      },
    ],
  },
];

export const pageSeeds: {
  key: string;
  path: string;
  seo: { metaTitle: { en: string; hi: string }; metaDescription: { en: string; hi: string } };
}[] = [
  {
    key: "home",
    path: "/",
    seo: {
      metaTitle: { en: "Vastukosh — Astrology & Vastu Shastra", hi: "वास्तुकोष — ज्योतिष और वास्तु शास्त्र" },
      metaDescription: {
        en: "Discover harmony through ancient Vastu principles and astrological guidance. Consecrated idols, yantras, malas and expert consultations.",
        hi: "प्राचीन वास्तु सिद्धांतों और ज्योतिषीय मार्गदर्शन से सामंजस्य पाएँ। प्राण-प्रतिष्ठित मूर्तियाँ, यंत्र, मालाएँ और विशेषज्ञ परामर्श।",
      },
    },
  },
  {
    key: "shop",
    path: "/shop",
    seo: {
      metaTitle: { en: "Sacred Collections", hi: "पवित्र संग्रह" },
      metaDescription: {
        en: "Consecrated idols, yantras, crystals and malas aligned to your Rashi and purpose.",
        hi: "आपकी राशि और उद्देश्य के अनुरूप प्राण-प्रतिष्ठित मूर्तियाँ, यंत्र, क्रिस्टल और मालाएँ।",
      },
    },
  },
  {
    key: "about",
    path: "/about",
    seo: {
      metaTitle: { en: "Our Story", hi: "हमारी कहानी" },
      metaDescription: {
        en: "Where ancient Vedic wisdom meets modern devotion — curators, craftsmen and seekers.",
        hi: "जहाँ प्राचीन वैदिक ज्ञान आधुनिक भक्ति से मिलता है — संग्रहकर्ता, शिल्पकार और साधक।",
      },
    },
  },
  {
    key: "consultancy",
    path: "/consultancy",
    seo: {
      metaTitle: { en: "Book a Consultation", hi: "परामर्श बुक करें" },
      metaDescription: {
        en: "Private astrology and Vastu consultations with verified Vedic experts.",
        hi: "सत्यापित वैदिक विशेषज्ञों के साथ निजी ज्योतिष और वास्तु परामर्श।",
      },
    },
  },
  {
    key: "contact",
    path: "/contact",
    seo: {
      metaTitle: { en: "Contact Us", hi: "संपर्क करें" },
      metaDescription: {
        en: "Reach the Vastukosh sanctuary for guidance, orders and consultations.",
        hi: "मार्गदर्शन, ऑर्डर और परामर्श के लिए वास्तुकोष से संपर्क करें।",
      },
    },
  },
  {
    key: "testimonials",
    path: "/testimonials",
    seo: {
      metaTitle: { en: "Stories from Seekers", hi: "साधकों की कहानियाँ" },
      metaDescription: {
        en: "Real reflections from families and individuals who walked their path with Vastukosh.",
        hi: "उन परिवारों और व्यक्तियों के वास्तविक विचार जिन्होंने वास्तुकोष के साथ अपना पथ चला।",
      },
    },
  },
];
