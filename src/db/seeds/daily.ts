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

/**
 * One mantra per weekday (0 = Sunday … 6 = Saturday) — the website's
 * "Daily Mantra" and ticker. Audio is added from the admin panel.
 */
export const weekdayMantraSeeds = [
  {
    key: "weekday-sunday",
    title: { en: "Surya Mantra", hi: "सूर्य मंत्र" },
    deity: "Surya (Sun)",
    sanskrit: "ॐ घृणिः सूर्याय नमः ॥",
    transliteration: "Om Ghrinih Suryaya Namah",
    meaning: {
      en: "Salutations to the radiant Sun. Chanted at sunrise for vitality, confidence and good health.",
      hi: "तेजस्वी सूर्य देव को नमन। सूर्योदय के समय जपने से ऊर्जा, आत्मविश्वास और अच्छा स्वास्थ्य मिलता है।",
    },
    audioUrl: "",
    durationSeconds: 0,
    artwork: "",
    weekday: 0,
    order: 10,
    published: true,
  },
  {
    key: "weekday-monday",
    title: { en: "Shiva Panchakshari Mantra", hi: "शिव पंचाक्षरी मंत्र" },
    deity: "Shiva",
    sanskrit: "ॐ नमः शिवाय ॥",
    transliteration: "Om Namah Shivaya",
    meaning: {
      en: "The five-syllable mantra of Shiva. It quietens the mind and dissolves inner restlessness.",
      hi: "शिव का पंचाक्षरी मंत्र। यह मन को शांत करता है और भीतर की बेचैनी दूर करता है।",
    },
    audioUrl: "",
    durationSeconds: 0,
    artwork: "",
    weekday: 1,
    order: 11,
    published: true,
  },
  {
    key: "weekday-tuesday",
    title: { en: "Hanuman Mantra", hi: "हनुमान मंत्र" },
    deity: "Hanuman",
    sanskrit: "ॐ हं हनुमते नमः ॥",
    transliteration: "Om Ham Hanumate Namah",
    meaning: {
      en: "Invokes Hanuman's strength and courage, and steadies the energy of Mars (Mangal).",
      hi: "हनुमान जी के बल और साहस का आह्वान करता है तथा मंगल ग्रह की ऊर्जा को संतुलित करता है।",
    },
    audioUrl: "",
    durationSeconds: 0,
    artwork: "",
    weekday: 2,
    order: 12,
    published: true,
  },
  {
    key: "weekday-wednesday",
    title: { en: "Ganesha Mantra", hi: "गणेश मंत्र" },
    deity: "Ganesha",
    sanskrit: "ॐ गं गणपतये नमः ॥",
    transliteration: "Om Gam Ganapataye Namah",
    meaning: {
      en: "Salutations to Ganesha, remover of obstacles. Chanted before any new beginning.",
      hi: "विघ्नहर्ता श्री गणेश को नमन। किसी भी नए कार्य के आरंभ से पहले इसका जप किया जाता है।",
    },
    audioUrl: "",
    durationSeconds: 0,
    artwork: "",
    weekday: 3,
    order: 13,
    published: true,
  },
  {
    key: "weekday-thursday",
    title: { en: "Vishnu Mantra", hi: "विष्णु मंत्र" },
    deity: "Vishnu",
    sanskrit: "ॐ नमो भगवते वासुदेवाय ॥",
    transliteration: "Om Namo Bhagavate Vasudevaya",
    meaning: {
      en: "Surrender to Vishnu, the sustainer. Calms the mind and brings balance to life.",
      hi: "पालनकर्ता भगवान विष्णु के प्रति समर्पण। मन को शांत करता है और जीवन में संतुलन लाता है।",
    },
    audioUrl: "",
    durationSeconds: 0,
    artwork: "",
    weekday: 4,
    order: 14,
    published: true,
  },
  {
    key: "weekday-friday",
    title: { en: "Lakshmi Mantra", hi: "लक्ष्मी मंत्र" },
    deity: "Lakshmi",
    sanskrit: "ॐ श्रीं महालक्ष्म्यै नमः ॥",
    transliteration: "Om Shreem Mahalakshmyai Namah",
    meaning: {
      en: "Invites the grace of Lakshmi for prosperity, abundance and harmony at home.",
      hi: "समृद्धि, वैभव और घर में सुख-शांति के लिए माँ लक्ष्मी की कृपा का आह्वान।",
    },
    audioUrl: "",
    durationSeconds: 0,
    artwork: "",
    weekday: 5,
    order: 15,
    published: true,
  },
  {
    key: "weekday-saturday",
    title: { en: "Shani Mantra", hi: "शनि मंत्र" },
    deity: "Shani (Saturn)",
    sanskrit: "ॐ शं शनैश्चराय नमः ॥",
    transliteration: "Om Sham Shanaishcharaya Namah",
    meaning: {
      en: "Salutations to Shani. Chanted for patience, discipline and relief from Saturn's hardships.",
      hi: "शनि देव को नमन। धैर्य, अनुशासन और शनि के कष्टों से राहत के लिए जपा जाता है।",
    },
    audioUrl: "",
    durationSeconds: 0,
    artwork: "",
    weekday: 6,
    order: 16,
    published: true,
  },
];

/** Vastu Shastra tips — the website's ticker + /vastu-tips page. */
export const vastuTipSeeds = [
  {
    key: "northeast",
    icon: "explore",
    area: { en: "North-east", hi: "ईशान कोण" },
    title: {
      en: "Keep the north-east corner clean and clutter-free",
      hi: "ईशान कोण को साफ़ और अव्यवस्था-रहित रखें",
    },
    body: {
      en: "The north-east (Ishan kon) holds the water element. Keep it light and open; a small water bowl or green plant here invites positive energy and prosperity.",
      hi: "ईशान कोण जल तत्व का स्थान है। इसे हल्का और खुला रखें; यहाँ जल का छोटा पात्र या हरा पौधा सकारात्मक ऊर्जा और समृद्धि लाता है।",
    },
    image: "",
    order: 1,
    published: true,
  },
  {
    key: "entrance",
    icon: "door_front",
    area: { en: "Main entrance", hi: "मुख्य द्वार" },
    title: {
      en: "Keep the main entrance bright, clean and unblocked",
      hi: "मुख्य द्वार को रोशन, साफ़ और बाधा-रहित रखें",
    },
    body: {
      en: "The entrance is where energy enters the home. Keep it well lit, avoid piling shoes or dustbins near the door, and fix creaking hinges.",
      hi: "मुख्य द्वार से ही घर में ऊर्जा प्रवेश करती है। इसे अच्छी रोशनी में रखें, दरवाज़े के पास जूते या कूड़ेदान न रखें और चरमराते कब्ज़े ठीक करवाएँ।",
    },
    image: "",
    order: 2,
    published: true,
  },
  {
    key: "kitchen",
    icon: "local_fire_department",
    area: { en: "Kitchen", hi: "रसोई" },
    title: {
      en: "The south-east is the ideal place for the kitchen",
      hi: "रसोई के लिए आग्नेय कोण सबसे उपयुक्त है",
    },
    body: {
      en: "The south-east (Agni kon) is ruled by fire. If possible, place the stove here and cook facing east.",
      hi: "आग्नेय कोण अग्नि तत्व का स्थान है। संभव हो तो चूल्हा यहीं रखें और पूर्व की ओर मुख करके भोजन बनाएँ।",
    },
    image: "",
    order: 3,
    published: true,
  },
  {
    key: "bedroom",
    icon: "bed",
    area: { en: "Bedroom", hi: "शयनकक्ष" },
    title: {
      en: "Sleep with your head towards the south or east",
      hi: "सोते समय सिर दक्षिण या पूर्व दिशा में रखें",
    },
    body: {
      en: "The master bedroom is best in the south-west. Sleeping with your head to the south or east supports restful sleep; avoid the north.",
      hi: "मुख्य शयनकक्ष के लिए नैऋत्य कोण उत्तम है। सिर दक्षिण या पूर्व की ओर रखकर सोने से नींद अच्छी आती है; उत्तर दिशा से बचें।",
    },
    image: "",
    order: 4,
    published: true,
  },
  {
    key: "pooja",
    icon: "temple_hindu",
    area: { en: "Pooja room", hi: "पूजा घर" },
    title: {
      en: "Place the pooja room in the north-east",
      hi: "पूजा घर ईशान कोण में बनाएँ",
    },
    body: {
      en: "The north-east is the most sacred zone of the home. Face east or north while praying, and keep the space simple and uncluttered.",
      hi: "ईशान कोण घर का सबसे पवित्र क्षेत्र है। पूजा करते समय पूर्व या उत्तर की ओर मुख रखें और स्थान को सादा व व्यवस्थित रखें।",
    },
    image: "",
    order: 5,
    published: true,
  },
  {
    key: "mirror",
    icon: "flip",
    area: { en: "Mirrors", hi: "दर्पण" },
    title: {
      en: "Never place a mirror facing the bed",
      hi: "दर्पण कभी भी बिस्तर के सामने न लगाएँ",
    },
    body: {
      en: "Mirrors reflect and multiply energy. Hang them on north or east walls, and cover any mirror that faces the bed at night.",
      hi: "दर्पण ऊर्जा को परावर्तित करता है। इसे उत्तर या पूर्व की दीवार पर लगाएँ, और बिस्तर के सामने वाला दर्पण रात में ढक दें।",
    },
    image: "",
    order: 6,
    published: true,
  },
  {
    key: "heavy",
    icon: "weight",
    area: { en: "Furniture", hi: "फ़र्नीचर" },
    title: {
      en: "Keep heavy furniture in the south-west",
      hi: "भारी फ़र्नीचर नैऋत्य कोण में रखें",
    },
    body: {
      en: "The south-west is the zone of stability. Wardrobes, storage and heavy items here keep the home grounded; keep the north and east lighter.",
      hi: "नैऋत्य कोण स्थिरता का क्षेत्र है। अलमारी और भारी सामान यहाँ रखने से घर में स्थिरता आती है; उत्तर और पूर्व को हल्का रखें।",
    },
    image: "",
    order: 7,
    published: true,
  },
  {
    key: "study",
    icon: "menu_book",
    area: { en: "Study", hi: "अध्ययन" },
    title: {
      en: "Study facing east or north for better focus",
      hi: "बेहतर एकाग्रता के लिए पूर्व या उत्तर की ओर मुख करके पढ़ें",
    },
    body: {
      en: "Place the study table so you face east or north. Keep the desk tidy and avoid sitting with your back to a door.",
      hi: "अध्ययन की मेज़ ऐसे रखें कि मुख पूर्व या उत्तर की ओर हो। मेज़ व्यवस्थित रखें और दरवाज़े की ओर पीठ करके न बैठें।",
    },
    image: "",
    order: 8,
    published: true,
  },
  {
    key: "locker",
    icon: "lock",
    area: { en: "Wealth", hi: "धन" },
    title: {
      en: "Keep the locker on the south-west wall, opening north",
      hi: "तिजोरी नैऋत्य दीवार पर रखें, जिसका मुख उत्तर की ओर खुले",
    },
    body: {
      en: "North is the direction of Kubera, lord of wealth. A safe placed against the south-west wall that opens towards the north is considered auspicious.",
      hi: "उत्तर दिशा धन के देवता कुबेर की है। नैऋत्य दीवार से सटी और उत्तर की ओर खुलने वाली तिजोरी शुभ मानी जाती है।",
    },
    image: "",
    order: 9,
    published: true,
  },
  {
    key: "broken",
    icon: "schedule",
    area: { en: "Clutter", hi: "अव्यवस्था" },
    title: {
      en: "Remove broken items and stopped clocks",
      hi: "टूटी वस्तुएँ और बंद घड़ियाँ हटा दें",
    },
    body: {
      en: "Broken objects and stopped clocks hold stagnant energy. Repair or remove them, and clear out things you no longer use.",
      hi: "टूटी वस्तुएँ और बंद घड़ियाँ रुकी हुई ऊर्जा रखती हैं। इन्हें ठीक करवाएँ या हटा दें, और अनुपयोगी सामान निकाल दें।",
    },
    image: "",
    order: 10,
    published: true,
  },
  {
    key: "toilet",
    icon: "water_drop",
    area: { en: "Bathroom", hi: "शौचालय" },
    title: {
      en: "Avoid a toilet in the north-east",
      hi: "ईशान कोण में शौचालय न बनाएँ",
    },
    body: {
      en: "A toilet in the sacred north-east is a major Vastu dosha. Where it can't be moved, keep it spotless and the door closed.",
      hi: "पवित्र ईशान कोण में शौचालय बड़ा वास्तु दोष है। यदि इसे हटाया न जा सके, तो इसे बिल्कुल साफ़ और दरवाज़ा बंद रखें।",
    },
    image: "",
    order: 11,
    published: true,
  },
  {
    key: "office",
    icon: "work",
    area: { en: "Office", hi: "कार्यालय" },
    title: {
      en: "At work, sit in the south-west facing north or east",
      hi: "कार्यालय में नैऋत्य कोण में बैठें, मुख उत्तर या पूर्व की ओर",
    },
    body: {
      en: "The owner or senior-most person should sit in the south-west of the office with a solid wall behind, facing north or east.",
      hi: "मालिक या वरिष्ठ व्यक्ति को कार्यालय के नैऋत्य भाग में, पीछे ठोस दीवार के साथ, उत्तर या पूर्व की ओर मुख करके बैठना चाहिए।",
    },
    image: "",
    order: 12,
    published: true,
  },
];
