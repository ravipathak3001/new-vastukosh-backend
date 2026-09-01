/**
 * Seed catalogue — ported from `frontend/data/products.ts`. Once the frontend
 * reads from the API this file is the single source; keep it in sync until then.
 */
const G = "https://lh3.googleusercontent.com/aida-public/";

export type ProductSeed = {
  slug: string;
  name: { en: string; hi: string };
  tagline: { en: string; hi: string };
  description: { en: string; hi: string };
  price: number;
  mrp?: number;
  rating: number;
  reviewsCount: number;
  category: string;
  rashis: string[];
  needs: string[];
  image: string;
  gallery?: string[];
  featured?: boolean;
  highlights?: { en: string; hi: string }[];
  details?: { title: { en: string; hi: string }; body: { en: string; hi: string } }[];
};

export const productSeeds: ProductSeed[] = [
  {
    slug: "sacred-crystal-ganesha",
    name: { en: "Sacred Crystal Ganesha", hi: "पवित्र क्रिस्टल गणेश" },
    tagline: {
      en: "A crystal idol tuned to your Rashi and intention",
      hi: "आपकी राशि और संकल्प के अनुरूप ढाली गई क्रिस्टल प्रतिमा",
    },
    description: {
      en: "Hand-carved from unheated AAA-grade clear quartz, paired with a brass Yantra and consecrated through Prana Pratishtha before it reaches you.",
      hi: "बिना गरम की गई AAA-ग्रेड स्वच्छ स्फटिक से हस्तनिर्मित, पीतल यंत्र के साथ, और आप तक पहुँचने से पहले प्राण-प्रतिष्ठा द्वारा प्रतिष्ठित।",
    },
    price: 4999,
    mrp: 6499,
    rating: 4.9,
    reviewsCount: 214,
    category: "idols",
    rashis: ["mesha", "karka", "simha", "tula", "meena"],
    needs: ["newhome", "prosperity", "peace"],
    image:
      G +
      "AB6AXuBWeEv4CJjmAdwIaTfSmUDNQG4f6_fdRopPHMzjja3Ml-AySPmRPqwvXQjso10C1Medlv0koGqpQjcOYbnUL-Y0ja3I86GLACV5BS-ZeyJZ1VmMegA_jIBoACkyCddoArcZdzgIykAz_56y7EVQR4xtq7FqRQGlpqav4Yn7mhloFdg5CxNYdcT8EjA_NSmh4ODyGMabx3vHu7ApqeaKwGY3wfl3Fq-qtFgnNJdD-q9A1Ob13CWSBvVqNg",
    gallery: [
      G +
        "AB6AXuDGcOfEzLpzAotNV9j1dObyg9a4V2lfrbhDDw6ktYEu-cU2adSCEhxMsYKvke1drjoAiLHBuTbe-wyBUGbL3sptlCJNAEiIS55Fn5V0OYuEceYa3iEaBMhaVDJNDJiKeu8RCNicXiNdpkWGiLvct3iodVaKOIFsrPZva-Aws5FVK3Vv2PfR5L7WYiK6lnJYrQxRgcgvvhvit4oDLVq5TzlDVnoXO1_BAX8GsR9Cx6FTynLdvczzvpbZ2A",
      G +
        "AB6AXuCILJPj5i9NMn0aaHm21nNTrxX1gN_yzSSg17xGhm4zh2Bx1oQT0QSp8Pifh9HrvpkyMUzSYBKKz0oBIqLZRXJsF333Rm3m73A_yarEZicDLEnGc4bFdZHfcfAImfHDW34-s_wU52qry-XELI1gvB4QCM2oC6uqLdB7pMBvConw92hxmlylzqtKupBn1MmqQzzm_hamJl2MF-0qqmOGu23NESgkFzZuC1Ri1_Kf72EwNut4LWFTyl6x4Q",
    ],
    featured: true,
    highlights: [
      {
        en: "Unheated, untreated clear quartz preserves its natural piezoelectric properties.",
        hi: "बिना गरम की गई, बिना उपचारित स्फटिक अपने प्राकृतिक पीज़ोइलेक्ट्रिक गुण बनाए रखती है।",
      },
      {
        en: "Accompanying Yantra etched into pure brass for longevity and conductivity.",
        hi: "साथ में शुद्ध पीतल पर उकेरा गया यंत्र, दीर्घायु और सुचालकता के लिए।",
      },
      {
        en: "Prana Pratishtha performed by Vedic scholars before dispatch.",
        hi: "भेजने से पहले वैदिक विद्वानों द्वारा की गई प्राण-प्रतिष्ठा।",
      },
    ],
    details: [
      {
        title: { en: "Fused with Intention", hi: "संकल्प से संयुक्त" },
        body: {
          en: "By uniting the vibrational frequency of your Rashi with a targeted geometric Yantra, we create a synergistic resonance. The clear quartz acts as an amplifier, radiating your chosen intention throughout your environment.",
          hi: "आपकी राशि की स्पंदन-आवृत्ति को एक लक्षित ज्यामितीय यंत्र से जोड़कर, हम एक सहक्रियात्मक अनुनाद बनाते हैं। स्वच्छ स्फटिक एक प्रवर्धक के रूप में कार्य करती है, जो आपके चुने हुए संकल्प को आपके वातावरण में विकीर्ण करती है।",
        },
      },
      {
        title: { en: "Artisanal Purity", hi: "शिल्प शुद्धता" },
        body: {
          en: "Each idol is hand-carved from ethically sourced, AAA-grade clear quartz by master artisans trained in traditional Shilpa Shastras.",
          hi: "प्रत्येक प्रतिमा पारंपरिक शिल्प शास्त्र में प्रशिक्षित कुशल शिल्पकारों द्वारा नैतिक रूप से प्राप्त AAA-ग्रेड स्वच्छ स्फटिक से हस्तनिर्मित है।",
        },
      },
      {
        title: { en: "Sacred Consecration", hi: "पवित्र प्रतिष्ठा" },
        body: {
          en: "Before reaching your sanctuary, each idol undergoes Prana Pratishtha — a vitalising ritual performed by Vedic scholars through ancient mantras and offerings.",
          hi: "आपके आश्रय तक पहुँचने से पहले, प्रत्येक प्रतिमा प्राण-प्रतिष्ठा से गुज़रती है — प्राचीन मंत्रों और अर्पणों के माध्यम से वैदिक विद्वानों द्वारा किया गया एक प्राण-संचार अनुष्ठान।",
        },
      },
    ],
  },
  {
    slug: "sri-yantra-copper-plate",
    name: { en: "Sri Yantra – Copper Plate", hi: "श्री यंत्र – ताम्र पट्ट" },
    tagline: { en: "Hand-engraved copper Sri Yantra", hi: "हस्त-उत्कीर्ण ताम्र श्री यंत्र" },
    description: {
      en: "Hand-engraved copper Sri Yantra to invite abundance and align sacred geometry in your space.",
      hi: "प्रचुरता को आमंत्रित करने और आपके स्थान में पवित्र ज्यामिति को संरेखित करने के लिए हस्त-उत्कीर्ण ताम्र श्री यंत्र।",
    },
    price: 1499,
    rating: 4.8,
    reviewsCount: 128,
    category: "yantras",
    rashis: ["vrishabha", "dhanu", "makara"],
    needs: ["business", "prosperity"],
    image:
      G +
      "AB6AXuDWroDcZdoscTM_sw98Sn48eP1xffpcQUma8phL2yvHjpNJhgz8dTZv0aDVYPrXQSycRNqiXzXbaP3KIFjq2wkbFw2MGjibUXS3omoLqd_nZ0oZoI_LyiEVJsZ5IkV5g7xzC6h0j8B3nAvt_1xf6I5KYjnVDKDe-Wj6WNW5NcV8MBDVLDhAMID7qHFPZPfjy3vindL8s78eWu88QD-RaUAoAr5HjwNx3lJE64RRwZ3dunBPFQkwgfYkAA",
    highlights: [
      { en: "99.9% pure copper, no plating.", hi: "99.9% शुद्ध ताँबा, कोई परत नहीं।" },
      { en: "Engraved to classical proportions.", hi: "शास्त्रीय अनुपात में उत्कीर्ण।" },
    ],
  },
  {
    slug: "rose-quartz-cluster",
    name: { en: "Rose Quartz Crystal Cluster", hi: "रोज़ क्वार्ट्ज़ क्रिस्टल समूह" },
    tagline: {
      en: "For love, healing and emotional balance",
      hi: "प्रेम, उपचार और भावनात्मक संतुलन के लिए",
    },
    description: {
      en: "Natural rose quartz cluster for love, healing, and emotional balance.",
      hi: "प्रेम, उपचार और भावनात्मक संतुलन के लिए प्राकृतिक रोज़ क्वार्ट्ज़ समूह।",
    },
    price: 899,
    rating: 4.6,
    reviewsCount: 94,
    category: "crystals",
    rashis: ["vrishabha", "tula", "karka"],
    needs: ["prosperity", "peace"],
    image:
      G +
      "AB6AXuCcmEFl7f6kOQphA2yJ5Rpx7oT-4Z7rgDYHqhoTcC9gCtVjZBwhinUF0IJOunWTg8ouFcz8jZZkhp0nN4PxOdmj5wOOGbcbTrEpfKinsXpktfML98gxplxaI6vxbUqX3lKAGp7EcCmmhlNoaPXzT_AzM9OW-7wArUB47Z-SU3cn2kLhWKlLEpho1oNa_kjPvhj-NkbAM9reMAm3ncIphEkihPWOau3pDj7VpxMBGDLS88rh-SJ5B4Psxw",
  },
  {
    slug: "rudraksha-mala-108",
    name: { en: "Rudraksha Mala – 108 Beads", hi: "रुद्राक्ष माला – 108 दाने" },
    tagline: { en: "Authentic 5-mukhi, hand-strung for japa", hi: "प्रामाणिक 5-मुखी, जप के लिए हस्त-गुँथी" },
    description: {
      en: "Authentic 5-mukhi Rudraksha mala, hand-strung for daily japa and meditation.",
      hi: "दैनिक जप और ध्यान के लिए हस्त-गुँथी प्रामाणिक 5-मुखी रुद्राक्ष माला।",
    },
    price: 1299,
    rating: 4.9,
    reviewsCount: 211,
    category: "malas",
    rashis: ["meena", "vrishchika", "kumbha"],
    needs: ["prosperity", "peace"],
    image:
      G +
      "AB6AXuA-1bmPJGqzLthuCIhjCuYRkhirfYfpunlKdurm9qoL1K2PaxZDmFVm9Sc5ca7lE6GZ8ExhNvLPB3EIa3XDQBaoSSn2yEzqwzJYXFCm_nG6LQgg9IT5SIa3Qy_JwggBxNWocQpx1524Bu-38lCjzmi-8lql5-4RYAavl_-FvybS8gvXqojTgBnO-abCj9luxxQLjuKmctpqCCGD9cV_aQombv16xsqiybk_13Rov4x2PoGINcjHX7ZXYQ",
  },
  {
    slug: "vastu-color-pyramid-set",
    name: { en: "Vastu Color Pyramid Set", hi: "वास्तु रंग पिरामिड सेट" },
    tagline: { en: "Correct Vastu imbalances in any room", hi: "किसी भी कमरे में वास्तु असंतुलन ठीक करें" },
    description: {
      en: "Five-element color pyramid set to correct Vastu imbalances in any room.",
      hi: "किसी भी कमरे में वास्तु असंतुलन को ठीक करने के लिए पंचतत्व रंग पिरामिड सेट।",
    },
    price: 649,
    rating: 4.5,
    reviewsCount: 76,
    category: "vastukits",
    rashis: ["karka", "kanya", "tula"],
    needs: ["newhome"],
    image:
      G +
      "AB6AXuATq_BWyBLUoqnGFpdnzEgAtwXlcPixkhHUgVZY1r83wYQel2bj5vTj577qmaf7SJdBIo9FJVFAnL1jtqQuT9VOtRJkRi00OheFny1r4HmXim7By2C3-mJsUmu-UThP4qmZvCooAQvTHPZrLkYwg-mtR2tQcdYqferb_XUJtaIGFFg1iwVvqyeK-iZxbOfcLBM-muca1YKOz3AD23QWmVE7nsgVSHhOCxEP4XkL75CPsw6ZQqDZlT__Pg",
  },
  {
    slug: "griha-pravesh-puja-kit",
    name: { en: "Griha Pravesh Puja Kit", hi: "गृह प्रवेश पूजा किट" },
    tagline: { en: "Complete consecrated housewarming kit", hi: "पूर्ण प्रतिष्ठित गृह-प्रवेश किट" },
    description: {
      en: "Complete consecrated kit for housewarming rituals, blessed before dispatch.",
      hi: "गृह-प्रवेश अनुष्ठानों के लिए पूर्ण प्रतिष्ठित किट, भेजने से पहले आशीर्वादित।",
    },
    price: 2199,
    rating: 4.7,
    reviewsCount: 58,
    category: "vastukits",
    rashis: ["karka", "vrishabha", "meena"],
    needs: ["newhome"],
    image:
      G +
      "AB6AXuCvApEmUqUNwuu8s5u-_V3Fop_qKqwG_WBLtpd7jbLh2Z8NunxhJApf7zyNb59JR1JnUyHesMVutQ-f7l_Xr9sXYdqt5C6Pi87SgvuXjPfcGv3eIVnLZM1uHzkZre7BRJTQuytwpsdJ9lwaPhQbGGeeTIrUpbfoxoaeaSZVV0pxxjzFcxYw2S9y2M2Kc3wWIu1DnBldplXSLIejfhBcakuMQgKDA03aB6yG_l1B6SHLjpsHjwUCriEyow",
  },
  {
    slug: "vehicle-protection-yantra",
    name: { en: "Vehicle Protection Yantra", hi: "वाहन सुरक्षा यंत्र" },
    tagline: { en: "Compact yantra to safeguard your journeys", hi: "आपकी यात्राओं की रक्षा हेतु सुगठित यंत्र" },
    description: {
      en: "Compact protective yantra designed to safeguard your journeys.",
      hi: "आपकी यात्राओं की रक्षा के लिए डिज़ाइन किया गया सुगठित सुरक्षा यंत्र।",
    },
    price: 749,
    rating: 4.6,
    reviewsCount: 63,
    category: "yantras",
    rashis: ["mesha", "vrishchika", "dhanu"],
    needs: ["vehicle"],
    image:
      G +
      "AB6AXuCPFTBoDOX4T-FjGzHZEFJQr3mVq-zSxnRJ07BAiT5bMAU4eIDNW2oi56rOEiOqF8zy6d940F4kkfcw5VtmqsIulbIzbQWSMhH1NwNzN4yxSbn9cTJ26nzjmOdKdFAlnCQZLPc5FFKWDz6q6wjJpiwDzSLeRfzcxf-6GijJpAN8Oki-t4XazOhnf-EbL7D4nO_rb4-jae-exTnslfYmKZuTJ5vKsxs-MVxPl6DCTW8bEzSVlWhhZzKW0Q",
  },
  {
    slug: "kuber-yantra-business",
    name: { en: "Kuber Yantra for Business", hi: "व्यापार हेतु कुबेर यंत्र" },
    tagline: { en: "Invite steady growth to your enterprise", hi: "अपने उद्यम में स्थिर वृद्धि आमंत्रित करें" },
    description: {
      en: "Copper Kuber Yantra to invite steady growth and prosperity for your enterprise.",
      hi: "आपके उद्यम के लिए स्थिर वृद्धि और समृद्धि आमंत्रित करने हेतु ताम्र कुबेर यंत्र।",
    },
    price: 1199,
    rating: 4.8,
    reviewsCount: 140,
    category: "yantras",
    rashis: ["simha", "makara", "mithuna", "kanya"],
    needs: ["business"],
    image:
      G +
      "AB6AXuBm6DXee45yhe7lAzbX48K1N-Xc4b0GN7JGBnyzlsAozEKPyb5MzdTiA5woULOz9UOI7POzHy0bye7NEKO_g537RS35MnIMMc29rd5P9F5kuKJ-1L1yYwVsNBVO7hPh50RWbe6I6tQUWIJemkYyGnpcrm7s8KVJftc0KMFaTU0m58afWLAVVWSy5q-WmGyIHuFjkVZdsftIamRu011fhZfp4yaZViXzbaQ5HJs3NilWjIvBaOZIRItvaA",
  },
  {
    slug: "citrine-prosperity-gemstone",
    name: { en: "Citrine Prosperity Gemstone", hi: "सिट्रीन समृद्धि रत्न" },
    tagline: { en: "Certified citrine to align with abundance", hi: "प्रचुरता से संरेखण हेतु प्रमाणित सिट्रीन" },
    description: {
      en: "Certified citrine gemstone to align personal vibrations with abundance.",
      hi: "व्यक्तिगत स्पंदनों को प्रचुरता के साथ संरेखित करने हेतु प्रमाणित सिट्रीन रत्न।",
    },
    price: 1899,
    rating: 4.9,
    reviewsCount: 102,
    category: "crystals",
    rashis: ["simha", "dhanu", "makara"],
    needs: ["prosperity"],
    image:
      G +
      "AB6AXuA1IeRCZq4yCmBtBociieaP1-nLs3NX0kFlGeLRTimjtFGZilaTvJBLPDLZISewbfIkQlWMA1KEm-ttgk96wpXPqNCh19v5qIY4AuB2I_RGDFfmTf7xD5A_9rluuLOebzdcDcXCD1JcsnB3s64R8fcW85KsVp5wi6ETGV3-KVuNb7UkffCcS5QVYj9KlCb1ztWYY-ECj5Ubtf31wTD1C-0OoaY6yLZCPtGzkHZ1KWxYzHngigUR5SntKA",
  },
];
