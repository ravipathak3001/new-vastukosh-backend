/** Daily content: mantras (with audio), Sanskrit verses, shareable cards. */

export const dailyMantraSeeds = [
  {
    key: "gayatri",
    title: { en: "Gayatri Mantra", hi: "गायत्री मंत्र" },
    deity: "Savitr (Sun)",
    sanskrit:
      "ॐ भूर्भुवः स्वः तत्सवितुर्वरेण्यं भर्गो देवस्य धीमहि धियो यो नः प्रचोदयात्",
    transliteration:
      "Om bhūr bhuvaḥ svaḥ, tat savitur vareṇyaṃ, bhargo devasya dhīmahi, dhiyo yo naḥ pracodayāt",
    meaning: {
      en: "We meditate on the effulgent glory of the divine Light; may it illumine our understanding.",
      hi: "हम उस दिव्य सविता के वरणीय तेज का ध्यान करते हैं; वह हमारी बुद्धि को प्रेरित करे।",
    },
    audioUrl: "https://download.samplelib.com/mp3/sample-12s.mp3",
    durationSeconds: 12,
    artwork: "",
    order: 1,
    published: true,
  },
  {
    key: "mahamrityunjaya",
    title: { en: "Mahamrityunjaya Mantra", hi: "महामृत्युंजय मंत्र" },
    deity: "Shiva",
    sanskrit:
      "ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम् उर्वारुकमिव बन्धनान्मृत्योर्मुक्षीय मामृतात्",
    transliteration:
      "Om tryambakaṃ yajāmahe sugandhiṃ puṣṭi-vardhanam, urvārukam iva bandhanān mṛtyor mukṣīya māmṛtāt",
    meaning: {
      en: "We worship the three-eyed One who nourishes all beings; may He free us from death, as a cucumber is severed from its stem, for the sake of immortality.",
      hi: "हम त्रिनेत्रधारी की उपासना करते हैं जो सबका पोषण करते हैं; वे हमें मृत्यु के बंधन से मुक्त करें, जैसे ककड़ी बेल से, अमरता के लिए।",
    },
    audioUrl: "",
    durationSeconds: 0,
    artwork: "",
    order: 2,
    published: true,
  },
  {
    key: "ganesha",
    title: { en: "Ganesha Mantra", hi: "गणेश मंत्र" },
    deity: "Ganesha",
    sanskrit: "ॐ गं गणपतये नमः",
    transliteration: "Om gaṃ gaṇapataye namaḥ",
    meaning: {
      en: "Salutations to Ganapati, the remover of obstacles.",
      hi: "विघ्नहर्ता गणपति को नमस्कार।",
    },
    audioUrl: "",
    durationSeconds: 0,
    artwork: "",
    order: 3,
    published: true,
  },
];

export const dailyVerseSeeds = [
  {
    key: "gita-2-47",
    sanskrit:
      "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन। मा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥",
    transliteration:
      "karmaṇy evādhikāras te mā phaleṣu kadācana; mā karma-phala-hetur bhūr mā te saṅgo 'stv akarmaṇi",
    meaning: {
      en: "You have a right to action alone, never to its fruits. Let not the fruit of action be your motive, nor let your attachment be to inaction.",
      hi: "तेरा अधिकार केवल कर्म में है, उसके फलों में कभी नहीं। तू कर्मफल का हेतु मत बन, और अकर्म में भी तेरी आसक्ति न हो।",
    },
    source: "Bhagavad Gita 2.47",
    order: 1,
    published: true,
  },
  {
    key: "rigveda-1-89-1",
    sanskrit: "आ नो भद्राः क्रतवो यन्तु विश्वतः",
    transliteration: "ā no bhadrāḥ kratavo yantu viśvataḥ",
    meaning: {
      en: "Let noble thoughts come to us from every direction.",
      hi: "हमें हर दिशा से श्रेष्ठ विचार प्राप्त हों।",
    },
    source: "Rig Veda 1.89.1",
    order: 2,
    published: true,
  },
  {
    key: "mundaka-3-1-6",
    sanskrit: "सत्यमेव जयते नानृतं",
    transliteration: "satyam eva jayate nānṛtaṃ",
    meaning: {
      en: "Truth alone triumphs, not falsehood.",
      hi: "सत्य की ही विजय होती है, असत्य की नहीं।",
    },
    source: "Mundaka Upanishad 3.1.6",
    order: 3,
    published: true,
  },
  {
    key: "isha-1",
    sanskrit: "ईशावास्यमिदं सर्वं यत्किञ्च जगत्यां जगत्",
    transliteration: "īśāvāsyam idaṃ sarvaṃ yat kiñca jagatyāṃ jagat",
    meaning: {
      en: "All this, whatever moves in this moving world, is pervaded by the Lord.",
      hi: "इस चराचर जगत् में जो कुछ है, वह सब ईश्वर से व्याप्त है।",
    },
    source: "Isha Upanishad 1",
    order: 4,
    published: true,
  },
  {
    key: "gita-6-35",
    sanskrit:
      "असंशयं महाबाहो मनो दुर्निग्रहं चलम्। अभ्यासेन तु कौन्तेय वैराग्येण च गृह्यते॥",
    transliteration:
      "asaṃśayaṃ mahā-bāho mano durnigrahaṃ calam; abhyāsena tu kaunteya vairāgyeṇa ca gṛhyate",
    meaning: {
      en: "Undoubtedly the mind is restless and hard to restrain; but by practice and by detachment it is held.",
      hi: "निःसंदेह मन चंचल और कठिनता से वश में होने वाला है; पर अभ्यास और वैराग्य से वह वश में होता है।",
    },
    source: "Bhagavad Gita 6.35",
    order: 5,
    published: true,
  },
];

export const dailyCardSeeds = [
  {
    key: "shanti-mantra",
    title: { en: "Peace to all", hi: "सर्वे भवन्तु सुखिनः" },
    caption: {
      en: "सर्वे भवन्तु सुखिनः, सर्वे सन्तु निरामयाः — may all be happy, may all be free from illness.",
      hi: "सर्वे भवन्तु सुखिनः, सर्वे सन्तु निरामयाः — सब सुखी हों, सब निरोगी हों।",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1545389336-cf090694435e?w=1080&q=80",
    order: 1,
    published: true,
  },
  {
    key: "morning-blessing",
    title: { en: "Morning blessing", hi: "प्रातः आशीर्वाद" },
    caption: {
      en: "May today's sunrise bring clarity to your mind and steadiness to your home.",
      hi: "आज का सूर्योदय आपके मन को स्पष्टता और आपके घर को स्थिरता दे।",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1080&q=80",
    order: 2,
    published: true,
  },
  {
    key: "diya-wish",
    title: { en: "Light within", hi: "अंतर्ज्योति" },
    caption: {
      en: "As one lamp lights another, may your calm kindle calm in everyone you meet.",
      hi: "जैसे एक दीप दूसरे को जलाता है, आपकी शांति सबमें शांति जगाए।",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1604608672516-f1b9b1d37076?w=1080&q=80",
    order: 3,
    published: true,
  },
];
