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

/** Ported verbatim from `frontend/data/legal.ts` — keep the two in sync. */
export const legalSeeds = [
  {
    slug: "privacy",
    title: { en: "Privacy Policy", hi: "गोपनीयता नीति" },
    sections: [
      {
        heading: { en: "Overview", hi: "सिंहावलोकन" },
        body: {
          en: `This Privacy Policy explains how Vastukosh ("we", "us", "our") collects, uses, shares and protects your personal information when you use vastukosh.com or our mobile app, place an order, or book a consultation with our team. It applies to every visitor, registered user and customer, and it should be read together with our Terms of Service, Shipping & Delivery Policy and Return & Refund Policy. By using our services you agree to the practices described below.`,
          hi: `यह गोपनीयता नीति बताती है कि वास्तुकोष ("हम", "हमें", "हमारा") आपकी व्यक्तिगत जानकारी को कैसे एकत्र, उपयोग, साझा और सुरक्षित करता है, जब आप vastukosh.com या हमारे मोबाइल ऐप का उपयोग करते हैं, कोई ऑर्डर देते हैं, या हमारी टीम से परामर्श बुक करते हैं। यह नीति हर आगंतुक, पंजीकृत उपयोगकर्ता और ग्राहक पर लागू होती है, और इसे हमारी सेवा की शर्तें, शिपिंग और डिलीवरी नीति तथा रिटर्न और धनवापसी नीति के साथ पढ़ा जाना चाहिए। हमारी सेवाओं का उपयोग करके, आप नीचे बताई गई प्रक्रियाओं से सहमत होते हैं।`,
        },
      },
      {
        heading: { en: "Information we collect", hi: "हम जो जानकारी एकत्र करते हैं" },
        body: {
          en: `We collect the information you give us directly — your name, email address, phone number and password when you create an account or check out as a guest; your shipping and billing address; and, when you use kundali, panchang, gemstone-matching or consultation features, the birth date, time and place you share with us. We also collect order, payment and transaction details such as items purchased and amount paid — your full card or UPI credentials are handled directly by our payment partner and are never stored on our servers. Finally, we automatically collect technical data such as your IP address, device and browser type, and the pages you visit, through cookies and analytics tools.`,
          hi: `हम आपके द्वारा सीधे दी गई जानकारी एकत्र करते हैं — खाता बनाते या अतिथि के रूप में चेकआउट करते समय आपका नाम, ईमेल पता, फोन नंबर और पासवर्ड; आपका शिपिंग और बिलिंग पता; और जब आप कुंडली, पंचांग, रत्न-मिलान या परामर्श सुविधाओं का उपयोग करते हैं, तो आपके द्वारा साझा की गई जन्म तिथि, समय और स्थान। हम ऑर्डर, भुगतान और लेन-देन का विवरण भी एकत्र करते हैं, जैसे ख़रीदी गई वस्तुएँ और भुगतान की गई राशि — आपके पूर्ण कार्ड या यूपीआई विवरण सीधे हमारे भुगतान साझेदार द्वारा संभाले जाते हैं और कभी भी हमारे सर्वर पर संग्रहीत नहीं होते। अंत में, हम कुकीज़ और एनालिटिक्स टूल के माध्यम से आपका आईपी पता, डिवाइस व ब्राउज़र प्रकार, तथा आपके द्वारा देखे गए पृष्ठों जैसा तकनीकी डेटा स्वतः एकत्र करते हैं।`,
        },
      },
      {
        heading: { en: "How we use your information", hi: "हम आपकी जानकारी का उपयोग कैसे करते हैं" },
        body: {
          en: `We use your information to process, consecrate, pack and ship your orders and keep you updated on their status; to generate your personalised kundali, panchang readings and gemstone recommendations; to schedule and conduct the astrology, vastu and gemstone consultations you book; to process payments, prevent fraud and handle cancellations, returns and refunds; to respond to your queries and provide customer support; and, only with your consent, to send newsletters and offers, which you can opt out of at any time. We also use aggregated, non-identifying data to improve our website, app and services, and to comply with tax, accounting and other legal obligations.`,
          hi: `हम आपकी जानकारी का उपयोग आपके ऑर्डर को संसाधित करने, प्राण-प्रतिष्ठित करने, पैक करने और भेजने तथा उनकी स्थिति की जानकारी देते रहने के लिए करते हैं; आपकी व्यक्तिगत कुंडली, पंचांग विवेचन और रत्न सुझाव तैयार करने के लिए; आपके द्वारा बुक किए गए ज्योतिष, वास्तु और रत्न परामर्श को निर्धारित व संचालित करने के लिए; भुगतान संसाधित करने, धोखाधड़ी रोकने और रद्दीकरण, रिटर्न व धनवापसी को संभालने के लिए; आपकी पूछताछ का उत्तर देने और ग्राहक सहायता प्रदान करने के लिए; और केवल आपकी सहमति से, न्यूज़लेटर व ऑफ़र भेजने के लिए, जिनसे आप कभी भी बाहर निकल सकते हैं। हम अपनी वेबसाइट, ऐप और सेवाओं में सुधार करने, तथा कर, लेखांकन एवं अन्य कानूनी दायित्वों का पालन करने के लिए समग्र, गैर-पहचान योग्य डेटा का भी उपयोग करते हैं।`,
        },
      },
      {
        heading: { en: "Your birth details, handled with care", hi: "आपका जन्म विवरण, सावधानीपूर्वक संभाला गया" },
        body: {
          en: `The birth date, time and place you share for kundali, panchang or consultation features are sensitive to you, and we treat them that way: they are used only to generate your astrological readings and recommendations, are visible only to the systems and consultants involved in preparing them, and are never used for unrelated profiling, advertising, or sold to any third party. You may ask us to delete stored birth details at any time by writing to support@vastukosh.com.`,
          hi: `कुंडली, पंचांग या परामर्श सुविधाओं के लिए आपके द्वारा साझा की गई जन्म तिथि, समय और स्थान आपके लिए संवेदनशील है, और हम इसे उसी रूप में संभालते हैं: इसका उपयोग केवल आपकी ज्योतिषीय विवेचना और सुझाव तैयार करने के लिए किया जाता है, यह केवल उन प्रणालियों और सलाहकारों को दिखाई देता है जो इसे तैयार करने में शामिल हैं, और इसे कभी भी असंबंधित प्रोफाइलिंग या विज्ञापन के लिए उपयोग नहीं किया जाता, न ही किसी तीसरे पक्ष को बेचा जाता है। आप किसी भी समय support@vastukosh.com पर लिखकर संग्रहीत जन्म विवरण को हटाने के लिए कह सकते हैं।`,
        },
      },
      {
        heading: { en: "Who we share it with", hi: "हम किसके साथ साझा करते हैं" },
        body: {
          en: `To fulfil your order and provide our services, we share limited information with trusted partners: your name, address and phone number with Shiprocket and other courier partners so they can deliver your order; your order amount with Razorpay, our payment gateway, to process payment securely; your contact details with our email, SMS and WhatsApp providers to send order updates and, if you've opted in, marketing messages; and relevant order or consultation details with our own staff and empanelled astrologers and vastu consultants directly involved in serving you. We disclose information to government authorities or regulators only where required by law. We do not sell your personal data to anyone.`,
          hi: `आपके ऑर्डर को पूरा करने और हमारी सेवाएँ प्रदान करने के लिए, हम विश्वसनीय साझेदारों के साथ सीमित जानकारी साझा करते हैं: आपका नाम, पता और फोन नंबर शिपरॉकेट व अन्य कूरियर साझेदारों के साथ, ताकि वे आपका ऑर्डर डिलीवर कर सकें; आपकी ऑर्डर राशि हमारे भुगतान गेटवे रेज़रपे के साथ, ताकि भुगतान सुरक्षित रूप से संसाधित हो सके; आपका संपर्क विवरण हमारे ईमेल, एसएमएस और व्हाट्सऐप प्रदाताओं के साथ, ताकि ऑर्डर अपडेट और — यदि आपने सहमति दी है — मार्केटिंग संदेश भेजे जा सकें; और प्रासंगिक ऑर्डर या परामर्श विवरण हमारे अपने कर्मचारियों तथा आपकी सेवा में सीधे शामिल सूचीबद्ध ज्योतिषियों व वास्तु सलाहकारों के साथ। हम जानकारी केवल कानून द्वारा आवश्यक होने पर ही सरकारी प्राधिकरणों या नियामकों के साथ साझा करते हैं। हम आपका व्यक्तिगत डेटा किसी को नहीं बेचते।`,
        },
      },
      {
        heading: { en: "Cookies and analytics", hi: "कुकीज़ और एनालिटिक्स" },
        body: {
          en: `We use essential cookies to keep you signed in and remember your cart and language preference, and analytics cookies to understand how the site is used so we can improve it. You can control or disable cookies from your browser settings at any time; some features, such as staying logged in or a persistent cart, may not work correctly without them.`,
          hi: `हम आपको साइन-इन रखने और आपकी कार्ट व भाषा प्राथमिकता याद रखने के लिए आवश्यक कुकीज़ का, तथा साइट के उपयोग को समझने और उसमें सुधार करने के लिए एनालिटिक्स कुकीज़ का उपयोग करते हैं। आप किसी भी समय अपनी ब्राउज़र सेटिंग्स से कुकीज़ को नियंत्रित या अक्षम कर सकते हैं; इसके बिना लॉग-इन बने रहने या कार्ट सुरक्षित रहने जैसी कुछ सुविधाएँ सही ढंग से काम नहीं कर सकतीं।`,
        },
      },
      {
        heading: { en: "Data retention and security", hi: "डेटा प्रतिधारण और सुरक्षा" },
        body: {
          en: `We retain order, invoice and payment records for as long as required under Indian tax and accounting law. Account, birth and consultation details are retained while your account is active and are deleted or anonymised within a reasonable period after you close your account or request deletion. We protect your data with HTTPS encryption, access controls and industry-standard safeguards; payment details are tokenised and processed directly by our payment partner and are never stored in full on our servers. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.`,
          hi: `हम ऑर्डर, इनवॉइस और भुगतान रिकॉर्ड को भारतीय कर एवं लेखांकन कानून के तहत आवश्यक अवधि तक संग्रहीत रखते हैं। खाता, जन्म और परामर्श विवरण आपके खाते के सक्रिय रहने तक रखे जाते हैं, और खाता बंद करने या हटाने के अनुरोध के बाद उचित अवधि के भीतर हटा दिए जाते हैं या गुमनाम कर दिए जाते हैं। हम आपके डेटा की सुरक्षा HTTPS एन्क्रिप्शन, एक्सेस नियंत्रण और उद्योग-मानक सुरक्षा उपायों से करते हैं; भुगतान विवरण को टोकनाइज़ किया जाता है और सीधे हमारे भुगतान साझेदार द्वारा संसाधित किया जाता है, तथा इसे कभी भी पूरी तरह हमारे सर्वर पर संग्रहीत नहीं किया जाता। ट्रांसमिशन या संग्रहण की कोई भी विधि पूर्णतः सुरक्षित नहीं होती, और हम पूर्ण सुरक्षा की गारंटी नहीं दे सकते।`,
        },
      },
      {
        heading: { en: "Your rights", hi: "आपके अधिकार" },
        body: {
          en: `You may ask to access the personal data we hold about you, have inaccurate or incomplete information corrected, request deletion of your account and personal data (subject to records we must legally retain), and withdraw consent for marketing communications at any time. To exercise any of these rights, write to support@vastukosh.com; we aim to respond within 30 days. Our services are not directed at individuals under 18 — if a consultation involves a minor's birth or personal details, it must be booked and supervised by a parent or legal guardian.`,
          hi: `आप हमारे पास मौजूद अपने व्यक्तिगत डेटा तक पहुँच माँग सकते हैं, ग़लत या अधूरी जानकारी को सही करवा सकते हैं, अपने खाते और व्यक्तिगत डेटा को हटाने का अनुरोध कर सकते हैं (उन रिकॉर्ड्स को छोड़कर जिन्हें कानूनी रूप से रखना आवश्यक है), और किसी भी समय मार्केटिंग संचार के लिए दी गई सहमति वापस ले सकते हैं। इनमें से किसी भी अधिकार का प्रयोग करने के लिए support@vastukosh.com पर लिखें; हम 30 दिनों के भीतर उत्तर देने का प्रयास करते हैं। हमारी सेवाएँ 18 वर्ष से कम आयु के व्यक्तियों के लिए नहीं हैं — यदि किसी परामर्श में किसी नाबालिग का जन्म या व्यक्तिगत विवरण शामिल है, तो उसे माता-पिता या कानूनी अभिभावक द्वारा बुक और पर्यवेक्षित किया जाना चाहिए।`,
        },
      },
      {
        heading: { en: "Grievance officer", hi: "शिकायत निवारण अधिकारी" },
        body: {
          en: `In accordance with the Information Technology Act, 2000, the rules made thereunder, and the Digital Personal Data Protection Act, 2023, any grievance or complaint regarding the treatment of your personal information may be addressed to our Grievance Officer at support@vastukosh.com or +91 98765 43210. We will acknowledge your complaint promptly and aim to resolve it within 30 days.`,
          hi: `सूचना प्रौद्योगिकी अधिनियम, 2000, उसके अंतर्गत बनाए गए नियमों, और डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के अनुसार, आपकी व्यक्तिगत जानकारी के व्यवहार से संबंधित कोई भी शिकायत हमारे शिकायत निवारण अधिकारी को support@vastukosh.com या +91 98765 43210 पर भेजी जा सकती है। हम आपकी शिकायत को शीघ्र स्वीकार करेंगे और 30 दिनों के भीतर उसका समाधान करने का प्रयास करेंगे।`,
        },
      },
      {
        heading: { en: "Changes to this policy", hi: "इस नीति में परिवर्तन" },
        body: {
          en: `We may update this Privacy Policy from time to time to reflect changes in our practices or the law. The "last updated" date at the top of this page shows when it was last revised, and material changes will be notified on the site or by email before they take effect. Please review this page periodically.`,
          hi: `हम अपनी प्रक्रियाओं या कानून में बदलाव को दर्शाने के लिए समय-समय पर इस गोपनीयता नीति को अद्यतन कर सकते हैं। इस पृष्ठ के शीर्ष पर दी गई "अंतिम अद्यतन" तारीख यह दर्शाती है कि इसे अंतिम बार कब संशोधित किया गया था, और महत्वपूर्ण परिवर्तनों की सूचना प्रभावी होने से पहले साइट पर या ईमेल के माध्यम से दी जाएगी। कृपया इस पृष्ठ की समय-समय पर समीक्षा करें।`,
        },
      },
    ],
  },
  {
    slug: "terms",
    title: { en: "Terms of Service", hi: "सेवा की शर्तें" },
    sections: [
      {
        heading: { en: "Acceptance of terms", hi: "शर्तों की स्वीकृति" },
        body: {
          en: `These Terms of Service ("Terms") govern your access to and use of vastukosh.com, our mobile app and the products and consultations Vastukosh ("we", "us") offers. By creating an account, placing an order or booking a consultation, you agree to be bound by these Terms, our Privacy Policy, Shipping & Delivery Policy and Return & Refund Policy. If you do not agree, please do not use our services.`,
          hi: `ये सेवा की शर्तें ("शर्तें") vastukosh.com, हमारे मोबाइल ऐप, तथा वास्तुकोष ("हम") द्वारा प्रस्तुत उत्पादों और परामर्श तक आपकी पहुँच व उनके उपयोग को नियंत्रित करती हैं। खाता बनाकर, ऑर्डर देकर या परामर्श बुक करके, आप इन शर्तों, हमारी गोपनीयता नीति, शिपिंग और डिलीवरी नीति तथा रिटर्न और धनवापसी नीति से बाध्य होने के लिए सहमत होते हैं। यदि आप सहमत नहीं हैं, तो कृपया हमारी सेवाओं का उपयोग न करें।`,
        },
      },
      {
        heading: { en: "Eligibility and your account", hi: "पात्रता और आपका खाता" },
        body: {
          en: `You must be at least 18 years old to create an account or place an order; a parent or legal guardian must act on behalf of a minor. You agree to provide accurate, current information when registering or checking out, and you are responsible for maintaining the confidentiality of your password and for all activity under your account. Notify us immediately at support@vastukosh.com if you suspect unauthorised use of your account.`,
          hi: `खाता बनाने या ऑर्डर देने के लिए आपकी आयु कम से कम 18 वर्ष होनी चाहिए; किसी नाबालिग की ओर से माता-पिता या कानूनी अभिभावक को कार्य करना होगा। पंजीकरण या चेकआउट करते समय आप सटीक, वर्तमान जानकारी देने के लिए सहमत होते हैं, और आप अपने पासवर्ड की गोपनीयता बनाए रखने तथा अपने खाते के अंतर्गत होने वाली सभी गतिविधियों के लिए ज़िम्मेदार हैं। यदि आपको अपने खाते के अनधिकृत उपयोग का संदेह हो, तो तुरंत support@vastukosh.com पर हमें सूचित करें।`,
        },
      },
      {
        heading: { en: "Our products and their nature", hi: "हमारे उत्पाद और उनकी प्रकृति" },
        body: {
          en: `Vastukosh sells bracelets, gemstones, yantras, malas and related items, many of which are ritually consecrated ("Prana Pratishtha") by our in-house priests as part of order fulfilment. This consecration follows traditional Vedic practice; its spiritual effects are a matter of faith and tradition and are not scientifically verifiable or guaranteed by us. Product descriptions, astrological guidance, gemstone recommendations and kundali or panchang readings on our site or app are offered for informational and spiritual guidance only and are not a substitute for professional medical, legal, financial or psychological advice — please consult an appropriately qualified professional for such matters.`,
          hi: `वास्तुकोष ब्रेसलेट, रत्न, यंत्र, माला और संबंधित वस्तुएँ बेचता है, जिनमें से कई को ऑर्डर पूर्ति के भाग के रूप में हमारे स्वयं के पुरोहितों द्वारा अनुष्ठानिक रूप से प्राण-प्रतिष्ठित किया जाता है। यह प्राण-प्रतिष्ठा पारंपरिक वैदिक प्रथा का पालन करती है; इसके आध्यात्मिक प्रभाव आस्था और परंपरा का विषय हैं तथा हमारे द्वारा वैज्ञानिक रूप से सत्यापन योग्य या गारंटीकृत नहीं हैं। हमारी साइट या ऐप पर उत्पाद विवरण, ज्योतिषीय मार्गदर्शन, रत्न सुझाव तथा कुंडली या पंचांग विवेचन केवल सूचनात्मक और आध्यात्मिक मार्गदर्शन हेतु प्रस्तुत किए जाते हैं और पेशेवर चिकित्सा, कानूनी, वित्तीय या मनोवैज्ञानिक सलाह का विकल्प नहीं हैं — ऐसे विषयों के लिए कृपया उपयुक्त योग्य पेशेवर से परामर्श करें।`,
        },
      },
      {
        heading: { en: "Orders, pricing and payment", hi: "ऑर्डर, मूल्य निर्धारण और भुगतान" },
        body: {
          en: `All prices are listed in Indian Rupees (₹) and are inclusive of applicable taxes unless stated otherwise. We take reasonable care to display accurate pricing and availability, but in the event of an error we may cancel the affected order and issue a full refund. An order is confirmed only once payment is authorised (for prepaid orders) or placed (for Cash on Delivery, where available). We accept UPI, cards and net banking through our payment partner Razorpay, as well as Cash on Delivery on eligible orders; we may refuse or cancel an order at our discretion, including on suspicion of fraud, pricing errors or unavailability of stock, in which case any amount paid will be refunded.`,
          hi: `सभी मूल्य भारतीय रुपये (₹) में सूचीबद्ध हैं और जब तक अन्यथा न बताया जाए, लागू करों सहित हैं। हम सटीक मूल्य और उपलब्धता दिखाने का उचित ध्यान रखते हैं, परंतु किसी त्रुटि की स्थिति में हम प्रभावित ऑर्डर को रद्द कर पूर्ण धनवापसी कर सकते हैं। कोई ऑर्डर तभी पुष्ट माना जाता है जब भुगतान अधिकृत हो जाए (प्रीपेड ऑर्डर के लिए) या दिया जाए (कैश ऑन डिलीवरी के लिए, जहाँ उपलब्ध हो)। हम अपने भुगतान साझेदार रेज़रपे के माध्यम से यूपीआई, कार्ड और नेट बैंकिंग स्वीकार करते हैं, साथ ही योग्य ऑर्डर पर कैश ऑन डिलीवरी भी; हम अपने विवेक से किसी ऑर्डर को अस्वीकार या रद्द कर सकते हैं, जिसमें धोखाधड़ी की आशंका, मूल्य त्रुटि या स्टॉक की अनुपलब्धता शामिल है, ऐसी स्थिति में भुगतान की गई कोई भी राशि वापस कर दी जाएगी।`,
        },
      },
      {
        heading: { en: "Shipping, cancellations and returns", hi: "शिपिंग, रद्दीकरण और रिटर्न" },
        body: {
          en: `Delivery of physical orders is governed by our Shipping & Delivery Policy, and cancellations, returns and refunds by our Return & Refund Policy — both form part of these Terms. In short: orders can generally be cancelled free of charge any time before they are packed for dispatch; once dispatched, an order can no longer be cancelled, and the standard return process applies after delivery.`,
          hi: `भौतिक ऑर्डर की डिलीवरी हमारी शिपिंग और डिलीवरी नीति द्वारा, तथा रद्दीकरण, रिटर्न और धनवापसी हमारी रिटर्न और धनवापसी नीति द्वारा नियंत्रित होते हैं — दोनों इन शर्तों का हिस्सा हैं। संक्षेप में: ऑर्डर को पैक होकर भेजे जाने से पहले किसी भी समय बिना किसी शुल्क के रद्द किया जा सकता है; एक बार भेजे जाने के बाद ऑर्डर रद्द नहीं किया जा सकता, और डिलीवरी के बाद मानक रिटर्न प्रक्रिया लागू होती है।`,
        },
      },
      {
        heading: { en: "Consultation bookings", hi: "परामर्श बुकिंग" },
        body: {
          en: `Booking a consultation reserves a time slot with one of our astrologers or vastu consultants. Please reschedule or cancel at least 24 hours before your slot if you cannot attend; cancellations within 24 hours of the slot and no-shows are treated as completed for billing purposes since the consultant's time has been reserved for you, except where we are at fault. If we need to reschedule a session — for instance due to a consultant's unavailability — we will offer you a new slot or a full refund. Consultants provide guidance in good faith based on the information you share; outcomes and predictions are not guaranteed.`,
          hi: `परामर्श बुक करने से हमारे किसी ज्योतिषी या वास्तु सलाहकार के साथ एक समय स्लॉट आरक्षित होता है। यदि आप उपस्थित नहीं हो सकते, तो कृपया अपने स्लॉट से कम से कम 24 घंटे पहले पुनर्निर्धारित करें या रद्द करें; स्लॉट के 24 घंटे के भीतर रद्दीकरण और न आने की स्थिति को बिलिंग के प्रयोजन हेतु पूर्ण माना जाता है, क्योंकि सलाहकार का समय आपके लिए आरक्षित किया जा चुका होता है, सिवाय उन स्थितियों के जहाँ त्रुटि हमारी ओर से हो। यदि हमें किसी सत्र को पुनर्निर्धारित करना पड़े — उदाहरण के लिए सलाहकार की अनुपलब्धता के कारण — तो हम आपको नया स्लॉट या पूर्ण धनवापसी प्रदान करेंगे। सलाहकार आपके द्वारा साझा की गई जानकारी के आधार पर सद्भावपूर्वक मार्गदर्शन प्रदान करते हैं; परिणामों और भविष्यवाणियों की गारंटी नहीं दी जाती।`,
        },
      },
      {
        heading: { en: "Intellectual property", hi: "बौद्धिक संपदा" },
        body: {
          en: `All content on vastukosh.com and our app — including text, graphics, logos, product photography, bead and gemstone illustrations, and software — is owned by Vastukosh or its licensors and is protected by copyright and trademark law. You may view and use this content for personal, non-commercial purposes only; you may not copy, reproduce, republish or create derivative works from it without our prior written permission.`,
          hi: `vastukosh.com और हमारे ऐप पर मौजूद सभी सामग्री — जिसमें टेक्स्ट, ग्राफ़िक्स, लोगो, उत्पाद फ़ोटोग्राफ़ी, बीड और रत्न चित्रण, तथा सॉफ़्टवेयर शामिल हैं — वास्तुकोष या उसके लाइसेंसदाताओं के स्वामित्व में है और कॉपीराइट व ट्रेडमार्क कानून द्वारा संरक्षित है। आप इस सामग्री को केवल व्यक्तिगत, गैर-वाणिज्यिक उद्देश्यों के लिए देख और उपयोग कर सकते हैं; हमारी पूर्व लिखित अनुमति के बिना आप इसे कॉपी, पुनरुत्पादित, पुनः प्रकाशित या इससे व्युत्पन्न कार्य नहीं बना सकते।`,
        },
      },
      {
        heading: { en: "Acceptable use and reviews", hi: "स्वीकार्य उपयोग और समीक्षाएँ" },
        body: {
          en: `You agree not to misuse our site or app — including attempting unauthorised access, submitting fraudulent orders, scraping content, or harassing our staff or consultants. If you submit a review, testimonial or other content, you confirm it is honest and your own, and you grant Vastukosh a non-exclusive, royalty-free licence to display it on our site, app and marketing. We may remove content that is false, abusive or violates these Terms.`,
          hi: `आप हमारी साइट या ऐप का दुरुपयोग न करने के लिए सहमत होते हैं — जिसमें अनधिकृत पहुँच का प्रयास करना, धोखाधड़ी वाले ऑर्डर देना, सामग्री को स्क्रैप करना, या हमारे कर्मचारियों या सलाहकारों को परेशान करना शामिल है। यदि आप कोई समीक्षा, प्रशंसापत्र या अन्य सामग्री प्रस्तुत करते हैं, तो आप पुष्टि करते हैं कि यह ईमानदार और आपकी अपनी है, और आप वास्तुकोष को इसे हमारी साइट, ऐप और मार्केटिंग में प्रदर्शित करने का एक गैर-अनन्य, रॉयल्टी-मुक्त लाइसेंस प्रदान करते हैं। हम ऐसी सामग्री हटा सकते हैं जो असत्य, अपमानजनक हो या इन शर्तों का उल्लंघन करती हो।`,
        },
      },
      {
        heading: { en: "Third-party services", hi: "तृतीय-पक्ष सेवाएँ" },
        body: {
          en: `Our checkout, shipping and communications rely on third-party services — including Razorpay for payments and Shiprocket for logistics — each governed by its own terms and privacy policy. Links to social media or other external sites are provided for convenience; we do not control and are not responsible for third-party content or practices.`,
          hi: `हमारा चेकआउट, शिपिंग और संचार तृतीय-पक्ष सेवाओं पर निर्भर करता है — जिसमें भुगतान के लिए रेज़रपे और लॉजिस्टिक्स के लिए शिपरॉकेट शामिल हैं — प्रत्येक अपनी स्वयं की शर्तों और गोपनीयता नीति द्वारा नियंत्रित होती है। सोशल मीडिया या अन्य बाहरी साइटों के लिंक सुविधा के लिए दिए गए हैं; हम तृतीय-पक्ष सामग्री या प्रथाओं को नियंत्रित नहीं करते और उनके लिए ज़िम्मेदार नहीं हैं।`,
        },
      },
      {
        heading: { en: "Limitation of liability", hi: "दायित्व की सीमा" },
        body: {
          en: `Our services and products are provided on an "as is" and "as available" basis. To the maximum extent permitted by law, Vastukosh is not liable for indirect, incidental or consequential loss, for delivery delays caused by our courier partners or events beyond our reasonable control, or for outcomes attributed to astrological, vastu or gemstone guidance. Nothing in these Terms limits any liability that cannot lawfully be excluded under Indian law, including under the Consumer Protection Act, 2019.`,
          hi: `हमारी सेवाएँ और उत्पाद "जैसी हैं" और "जैसी उपलब्ध हैं" के आधार पर प्रदान किए जाते हैं। कानून द्वारा अनुमत अधिकतम सीमा तक, वास्तुकोष अप्रत्यक्ष, आकस्मिक या परिणामी हानि के लिए, हमारे कूरियर साझेदारों या हमारे उचित नियंत्रण से बाहर की घटनाओं के कारण डिलीवरी में देरी के लिए, या ज्योतिषीय, वास्तु या रत्न मार्गदर्शन से जुड़े परिणामों के लिए उत्तरदायी नहीं है। इन शर्तों में कुछ भी उस दायित्व को सीमित नहीं करता जिसे भारतीय कानून, जिसमें उपभोक्ता संरक्षण अधिनियम, 2019 शामिल है, के तहत वैध रूप से बाहर नहीं रखा जा सकता।`,
        },
      },
      {
        heading: { en: "Governing law and dispute resolution", hi: "शासी कानून और विवाद समाधान" },
        body: {
          en: `These Terms are governed by the laws of India. Subject to applicable consumer-protection rules that may entitle you to approach a forum closer to your residence, courts at New Delhi shall have exclusive jurisdiction over any dispute arising from these Terms or your use of our services. We encourage you to first reach out to support@vastukosh.com so we can try to resolve any concern informally.`,
          hi: `ये शर्तें भारत के कानूनों द्वारा शासित हैं। लागू उपभोक्ता-संरक्षण नियमों के अधीन, जो आपको आपके निवास के निकटतम मंच से संपर्क करने का अधिकार दे सकते हैं, इन शर्तों या हमारी सेवाओं के आपके उपयोग से उत्पन्न किसी भी विवाद पर नई दिल्ली की अदालतों का विशेष क्षेत्राधिकार होगा। हम आपसे आग्रह करते हैं कि पहले support@vastukosh.com पर हमसे संपर्क करें ताकि हम किसी भी चिंता को अनौपचारिक रूप से सुलझाने का प्रयास कर सकें।`,
        },
      },
      {
        heading: { en: "Changes to these terms", hi: "इन शर्तों में परिवर्तन" },
        body: {
          en: `We may revise these Terms from time to time; the "last updated" date above shows when they were last revised. Continued use of our site, app or services after changes take effect constitutes acceptance of the revised Terms. For questions about these Terms, contact us at support@vastukosh.com.`,
          hi: `हम समय-समय पर इन शर्तों को संशोधित कर सकते हैं; ऊपर दी गई "अंतिम अद्यतन" तारीख यह दर्शाती है कि इन्हें अंतिम बार कब संशोधित किया गया था। परिवर्तन प्रभावी होने के बाद हमारी साइट, ऐप या सेवाओं का निरंतर उपयोग संशोधित शर्तों की स्वीकृति माना जाएगा। इन शर्तों के बारे में प्रश्नों के लिए, हमसे support@vastukosh.com पर संपर्क करें।`,
        },
      },
    ],
  },
  {
    slug: "shipping",
    title: { en: "Shipping & Delivery Policy", hi: "शिपिंग और डिलीवरी नीति" },
    sections: [
      {
        heading: { en: "Where we deliver", hi: "हम कहाँ डिलीवर करते हैं" },
        body: {
          en: `We currently deliver across India only, through our logistics partner Shiprocket and its network of courier companies. We check serviceability for your pin code at checkout; in the rare case your pin code isn't serviceable, you'll be notified before payment. We don't offer international shipping yet — join our newsletter to hear when that changes.`,
          hi: `हम फ़िलहाल केवल पूरे भारत में डिलीवरी करते हैं, अपने लॉजिस्टिक्स साझेदार शिपरॉकेट और उसके कूरियर नेटवर्क के माध्यम से। हम चेकआउट पर आपके पिनकोड की सेवा-उपलब्धता जाँचते हैं; यदि आपका पिनकोड सेवा योग्य नहीं है, तो आपको भुगतान से पहले सूचित कर दिया जाएगा। हम अभी अंतरराष्ट्रीय शिपिंग की सुविधा नहीं देते — बदलाव की जानकारी के लिए हमारे न्यूज़लेटर से जुड़ें।`,
        },
      },
      {
        heading: { en: "Order processing and consecration", hi: "ऑर्डर प्रोसेसिंग और प्राण-प्रतिष्ठा" },
        body: {
          en: `Once your payment is confirmed, physical items go through Prana Pratishtha — a short ritual consecration by our in-house priests — before they are packed for dispatch. This typically takes 3–5 business days. You can follow your order's progress (payment confirmed → consecration → packed → shipped → delivered) any time from "My Orders".`,
          hi: `आपके भुगतान की पुष्टि होते ही, भौतिक वस्तुएँ पैक होकर भेजे जाने से पहले प्राण-प्रतिष्ठा — हमारे स्वयं के पुरोहितों द्वारा एक संक्षिप्त अनुष्ठानिक प्राण-प्रतिष्ठा — से गुज़रती हैं। इसमें आमतौर पर 3–5 कार्यदिवस लगते हैं। आप किसी भी समय "मेरे ऑर्डर" से अपने ऑर्डर की प्रगति (भुगतान पुष्ट → प्राण-प्रतिष्ठा → पैक → भेजा गया → डिलीवर) देख सकते हैं।`,
        },
      },
      {
        heading: { en: "Delivery timelines", hi: "डिलीवरी की समय-सीमा" },
        body: {
          en: `After dispatch, orders typically arrive within 3–7 business days in metro cities and 5–9 business days elsewhere in India; remote or hard-to-reach pin codes may occasionally take longer. These are estimates, not guarantees, and the exact estimated delivery window for your address is shown at checkout and in your order confirmation.`,
          hi: `भेजे जाने के बाद, ऑर्डर आमतौर पर महानगरों में 3–7 कार्यदिवसों और भारत के अन्य भागों में 5–9 कार्यदिवसों के भीतर पहुँच जाते हैं; दूरदराज़ या पहुँच में कठिन पिनकोड में कभी-कभी अधिक समय लग सकता है। ये अनुमान हैं, गारंटी नहीं, और आपके पते के लिए सटीक अनुमानित डिलीवरी विंडो चेकआउट और आपकी ऑर्डर पुष्टि में दिखाई जाती है।`,
        },
      },
      {
        heading: { en: "Shipping charges", hi: "शिपिंग शुल्क" },
        body: {
          en: `Shipping is free on all orders above ₹999. Orders below that amount attract a flat shipping fee, shown at checkout before you pay, so there are never any surprises at delivery.`,
          hi: `₹999 से अधिक के सभी ऑर्डर पर शिपिंग निःशुल्क है। इस राशि से कम के ऑर्डर पर एक निश्चित शिपिंग शुल्क लगता है, जो भुगतान से पहले चेकआउट पर दिखाया जाता है, ताकि डिलीवरी के समय कोई आश्चर्य न हो।`,
        },
      },
      {
        heading: { en: "Cash on Delivery", hi: "कैश ऑन डिलीवरी" },
        body: {
          en: `Cash on Delivery (COD) is available on eligible pin codes and order values, shown as a payment option at checkout when applicable. Please keep the exact amount ready for our delivery partner, and have your order number handy in case of any query.`,
          hi: `योग्य पिनकोड और ऑर्डर मूल्यों पर कैश ऑन डिलीवरी (COD) उपलब्ध है, जो लागू होने पर चेकआउट पर भुगतान विकल्प के रूप में दिखाई जाती है। कृपया हमारे डिलीवरी साझेदार के लिए सही राशि तैयार रखें, और किसी भी पूछताछ के लिए अपना ऑर्डर नंबर हाथ में रखें।`,
        },
      },
      {
        heading: { en: "Tracking your order", hi: "अपने ऑर्डर को ट्रैक करना" },
        body: {
          en: `As soon as your order is handed to our courier partner, we email you the AWB/tracking number and a tracking link, and the same is available under "My Orders" with live status updates as the parcel moves.`,
          hi: `जैसे ही आपका ऑर्डर हमारे कूरियर साझेदार को सौंपा जाता है, हम आपको AWB/ट्रैकिंग नंबर और एक ट्रैकिंग लिंक ईमेल करते हैं, और यही जानकारी "मेरे ऑर्डर" के अंतर्गत पार्सल की गति के साथ लाइव स्थिति अपडेट के साथ उपलब्ध होती है।`,
        },
      },
      {
        heading: { en: "Delivery attempts and address accuracy", hi: "डिलीवरी प्रयास और पते की सटीकता" },
        body: {
          en: `Our courier partners typically make more than one delivery attempt before returning a parcel to us (RTO). Please ensure your address and phone number are complete and correct at checkout — we may not be able to redeliver or refund shipping charges for failed deliveries caused by an incomplete or incorrect address, and re-shipment in such cases may attract additional charges.`,
          hi: `हमारे कूरियर साझेदार आमतौर पर पार्सल को हमें वापस (RTO) भेजने से पहले एक से अधिक डिलीवरी प्रयास करते हैं। कृपया चेकआउट पर सुनिश्चित करें कि आपका पता और फोन नंबर पूर्ण और सही हों — अधूरे या ग़लत पते के कारण असफल डिलीवरी के लिए हम पुनः डिलीवरी या शिपिंग शुल्क की वापसी नहीं कर पाएँगे, और ऐसे मामलों में पुनः भेजने पर अतिरिक्त शुल्क लग सकता है।`,
        },
      },
      {
        heading: { en: "Delays outside our control", hi: "हमारे नियंत्रण से बाहर की देरी" },
        body: {
          en: `Occasionally, weather, courier network disruptions, regional restrictions or festival-season rush can delay delivery beyond the estimates shown at checkout. We're not liable for delays caused by such events beyond our reasonable control, but we'll keep you informed and help track down a delayed parcel if you reach out to us.`,
          hi: `कभी-कभी, मौसम, कूरियर नेटवर्क में व्यवधान, क्षेत्रीय प्रतिबंध या त्योहारी सीज़न की भीड़ के कारण डिलीवरी चेकआउट पर दिखाए गए अनुमान से अधिक विलंबित हो सकती है। हम अपने उचित नियंत्रण से बाहर ऐसी घटनाओं के कारण होने वाली देरी के लिए उत्तरदायी नहीं हैं, लेकिन हम आपको सूचित रखेंगे और यदि आप हमसे संपर्क करें तो विलंबित पार्सल का पता लगाने में मदद करेंगे।`,
        },
      },
      {
        heading: { en: "Received a damaged parcel?", hi: "क्षतिग्रस्त पार्सल मिला?" },
        body: {
          en: `Please inspect your package when it arrives. If the outer packaging looks damaged, you may refuse delivery or accept it and note the damage with the delivery agent. Either way, contact us at support@vastukosh.com within 48 hours with photos or a short video — see our Return & Refund Policy for what happens next.`,
          hi: `कृपया पार्सल आने पर उसका निरीक्षण करें। यदि बाहरी पैकेजिंग क्षतिग्रस्त दिखे, तो आप डिलीवरी लेने से मना कर सकते हैं या उसे स्वीकार कर डिलीवरी एजेंट के साथ क्षति नोट करा सकते हैं। दोनों ही स्थितियों में, 48 घंटों के भीतर तस्वीरों या एक छोटे वीडियो के साथ support@vastukosh.com पर हमसे संपर्क करें — आगे क्या होगा यह जानने के लिए हमारी रिटर्न और धनवापसी नीति देखें।`,
        },
      },
      {
        heading: { en: "Questions?", hi: "प्रश्न हैं?" },
        body: {
          en: `For any shipping query, write to support@vastukosh.com or call +91 98765 43210.`,
          hi: `किसी भी शिपिंग संबंधी प्रश्न के लिए, support@vastukosh.com पर लिखें या +91 98765 43210 पर कॉल करें।`,
        },
      },
    ],
  },
  {
    slug: "refund",
    title: { en: "Return & Refund Policy", hi: "रिटर्न और धनवापसी नीति" },
    sections: [
      {
        heading: { en: "Our promise", hi: "हमारा वादा" },
        body: {
          en: `We want you to be happy with your order. Eligible items can be returned within 7 days of delivery, and this policy explains how returns, cancellations and refunds work for both physical orders and consultation bookings.`,
          hi: `हम चाहते हैं कि आप अपने ऑर्डर से संतुष्ट हों। योग्य वस्तुओं को डिलीवरी के 7 दिनों के भीतर लौटाया जा सकता है, और यह नीति बताती है कि भौतिक ऑर्डर और परामर्श बुकिंग दोनों के लिए रिटर्न, रद्दीकरण और धनवापसी कैसे काम करते हैं।`,
        },
      },
      {
        heading: { en: "Return eligibility", hi: "रिटर्न पात्रता" },
        body: {
          en: `You can request a return within 7 days of the delivery date, for items that are damaged, defective, incorrect, or significantly not as described. The item should be unused and unworn beyond trying it on, in its original packaging with any certificate and tags intact. Once 7 days have passed since delivery, we're unable to accept a return.`,
          hi: `आप डिलीवरी की तारीख से 7 दिनों के भीतर उन वस्तुओं के लिए रिटर्न का अनुरोध कर सकते हैं जो क्षतिग्रस्त, दोषपूर्ण, ग़लत हों, या विवरण से काफ़ी भिन्न हों। वस्तु का उपयोग न किया गया हो और उसे पहनकर देखने के अलावा न पहना गया हो, तथा वह अपनी मूल पैकेजिंग में किसी भी प्रमाणपत्र और टैग सहित बरकरार हो। डिलीवरी के 7 दिन बीत जाने के बाद, हम रिटर्न स्वीकार करने में असमर्थ हैं।`,
        },
      },
      {
        heading: { en: "What can't be returned", hi: "क्या रिटर्न नहीं किया जा सकता" },
        body: {
          en: `For hygiene and religious-sanctity reasons, a consecrated item cannot be returned for a change of mind once it has been worn or used. Customised or engraved items, and complimentary gifts included with an order, are also not eligible for return. Consultation sessions that have already been conducted are covered under "Consultation bookings" below, not this section.`,
          hi: `स्वच्छता और धार्मिक पवित्रता के कारणों से, एक बार पहने या उपयोग किए जाने के बाद प्राण-प्रतिष्ठित वस्तु को मन बदलने पर रिटर्न नहीं किया जा सकता। अनुकूलित या उत्कीर्ण वस्तुएँ, तथा ऑर्डर के साथ शामिल पूरक उपहार भी रिटर्न के योग्य नहीं हैं। जो परामर्श सत्र पहले ही संचालित हो चुके हैं, वे इस अनुभाग के अंतर्गत नहीं, बल्कि नीचे दिए गए "परामर्श बुकिंग" के अंतर्गत आते हैं।`,
        },
      },
      {
        heading: { en: "How to request a return", hi: "रिटर्न का अनुरोध कैसे करें" },
        body: {
          en: `Sign in and go to My Orders, select the order and item, choose Request Return, pick a reason and, for damaged, defective or incorrect items, attach a photo. Our team reviews return requests within 2 business days and lets you know whether it's approved.`,
          hi: `साइन इन करें और मेरे ऑर्डर पर जाएँ, ऑर्डर और वस्तु चुनें, रिटर्न का अनुरोध करें चुनें, एक कारण चुनें और क्षतिग्रस्त, दोषपूर्ण या ग़लत वस्तुओं के लिए एक तस्वीर संलग्न करें। हमारी टीम 2 कार्यदिवसों के भीतर रिटर्न अनुरोधों की समीक्षा करती है और आपको बताती है कि यह स्वीकृत हुआ है या नहीं।`,
        },
      },
      {
        heading: { en: "Pickup and quality check", hi: "पिकअप और गुणवत्ता जाँच" },
        body: {
          en: `Once a return is approved, we schedule a free reverse pickup through our courier partner for damaged, defective or incorrect items. The item is quality-checked when it reaches our facility to confirm it matches the reason given; you can follow the return's status — requested, approved, pickup scheduled, received, refunded — from My Returns.`,
          hi: `एक बार रिटर्न स्वीकृत हो जाने पर, हम क्षतिग्रस्त, दोषपूर्ण या ग़लत वस्तुओं के लिए अपने कूरियर साझेदार के माध्यम से एक निःशुल्क रिवर्स पिकअप निर्धारित करते हैं। वस्तु हमारी सुविधा तक पहुँचने पर उसकी गुणवत्ता जाँची जाती है ताकि यह पुष्टि हो सके कि वह दिए गए कारण से मेल खाती है; आप मेरे रिटर्न से रिटर्न की स्थिति — अनुरोधित, स्वीकृत, पिकअप निर्धारित, प्राप्त, धनवापसी — देख सकते हैं।`,
        },
      },
      {
        heading: { en: "Refunds", hi: "धनवापसी" },
        body: {
          en: `Once your returned item passes quality check, we process the refund to your original payment method (or by bank transfer/UPI for Cash on Delivery orders) within 7–10 business days. Shipping charges are non-refundable unless the return is due to our error — a damaged, defective or incorrect item.`,
          hi: `आपकी लौटाई गई वस्तु के गुणवत्ता जाँच में उत्तीर्ण होने के बाद, हम 7–10 कार्यदिवसों के भीतर आपके मूल भुगतान माध्यम में (या कैश ऑन डिलीवरी ऑर्डर के लिए बैंक ट्रांसफ़र/यूपीआई द्वारा) धनवापसी संसाधित करते हैं। शिपिंग शुल्क वापसी योग्य नहीं है, जब तक कि रिटर्न हमारी त्रुटि — क्षतिग्रस्त, दोषपूर्ण या ग़लत वस्तु — के कारण न हो।`,
        },
      },
      {
        heading: { en: "Cancelling an order", hi: "ऑर्डर रद्द करना" },
        body: {
          en: `You can cancel an order free of charge any time before it's packed for dispatch — that is, while it shows as Pending Payment, Paid or Consecration under My Orders. Once an order is Packed or In Transit it can no longer be cancelled; you're welcome to refuse delivery or request a return once it arrives. Prepaid cancellations are refunded in full to your original payment method within 7–10 business days; Cash on Delivery cancellations need no refund since no payment was taken.`,
          hi: `आप किसी ऑर्डर को पैक होकर भेजे जाने से पहले किसी भी समय बिना शुल्क के रद्द कर सकते हैं — अर्थात, जब तक वह मेरे ऑर्डर में भुगतान लंबित, भुगतान हुआ या प्राण-प्रतिष्ठा के रूप में दिखे। एक बार ऑर्डर पैक या ट्रांज़िट में होने के बाद इसे रद्द नहीं किया जा सकता; आप उसके पहुँचने पर डिलीवरी लेने से मना कर सकते हैं या रिटर्न का अनुरोध कर सकते हैं। प्रीपेड रद्दीकरण 7–10 कार्यदिवसों के भीतर आपके मूल भुगतान माध्यम में पूर्ण रूप से वापस कर दिए जाते हैं; कैश ऑन डिलीवरी रद्दीकरण के लिए किसी धनवापसी की आवश्यकता नहीं होती क्योंकि कोई भुगतान नहीं लिया गया था।`,
        },
      },
      {
        heading: { en: "Exchanges", hi: "विनिमय" },
        body: {
          en: `We don't offer direct exchanges today. If you'd like a different size, design or product, return the original item for a refund and place a new order.`,
          hi: `हम फ़िलहाल सीधे विनिमय की सुविधा नहीं देते। यदि आप कोई भिन्न आकार, डिज़ाइन या उत्पाद चाहते हैं, तो मूल वस्तु को धनवापसी के लिए लौटाएँ और एक नया ऑर्डर दें।`,
        },
      },
      {
        heading: { en: "Consultation bookings", hi: "परामर्श बुकिंग" },
        body: {
          en: `You can reschedule or cancel a consultation for a full refund or free reschedule up to 24 hours before your scheduled slot. Cancellations within 24 hours of the slot, and no-shows, are non-refundable, since the consultant's time has already been reserved for you. If we need to reschedule your session — for example, due to a consultant's unavailability — we'll offer you a new slot or a full refund, whichever you prefer.`,
          hi: `आप अपने निर्धारित स्लॉट से कम से कम 24 घंटे पहले तक पूर्ण धनवापसी या निःशुल्क पुनर्निर्धारण के लिए किसी परामर्श को पुनर्निर्धारित या रद्द कर सकते हैं। स्लॉट के 24 घंटे के भीतर रद्दीकरण, और न आने की स्थिति, धनवापसी योग्य नहीं है, क्योंकि सलाहकार का समय आपके लिए पहले ही आरक्षित किया जा चुका होता है। यदि हमें आपके सत्र को पुनर्निर्धारित करना पड़े — उदाहरण के लिए सलाहकार की अनुपलब्धता के कारण — तो हम आपको नया स्लॉट या पूर्ण धनवापसी प्रदान करेंगे, जो भी आप चाहें।`,
        },
      },
      {
        heading: { en: "Tracking your refund", hi: "अपनी धनवापसी को ट्रैक करना" },
        body: {
          en: `You can check the status of any return or refund under My Orders / My Returns at any time. If a refund hasn't reached you within the timelines above, write to support@vastukosh.com with your order or return number and we'll look into it.`,
          hi: `आप किसी भी समय मेरे ऑर्डर / मेरे रिटर्न के अंतर्गत किसी भी रिटर्न या धनवापसी की स्थिति देख सकते हैं। यदि उपरोक्त समय-सीमा के भीतर धनवापसी आप तक नहीं पहुँचती है, तो अपने ऑर्डर या रिटर्न नंबर के साथ support@vastukosh.com पर लिखें और हम इसकी जाँच करेंगे।`,
        },
      },
      {
        heading: { en: "Questions?", hi: "प्रश्न हैं?" },
        body: {
          en: `For any return, cancellation or refund query, write to support@vastukosh.com or call +91 98765 43210.`,
          hi: `किसी भी रिटर्न, रद्दीकरण या धनवापसी संबंधी प्रश्न के लिए, support@vastukosh.com पर लिखें या +91 98765 43210 पर कॉल करें।`,
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
