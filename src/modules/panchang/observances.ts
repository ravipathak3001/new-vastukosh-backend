import type { Panchanga } from "vedic-panchanga";

/**
 * Vrats and festivals for a day, derived from the panchang.
 *
 * Each vrat / festival has a traditional deciding time (`Rule`): the tithi
 * running at that moment decides the day — sunrise for most vrats, midday for
 * Ram Navami and Ganesh Chaturthi, pradosh (evening) for Diwali and Pradosh
 * vrat, midnight for Janmashtami and Shivaratri, moonrise for Karwa Chauth.
 * When the tithi covers that moment on two days running, the first day wins.
 * Regional calendars can still differ by a day in edge years, which the
 * website notes.
 *
 * Major festivals are keyed to the amanta lunar month and skipped in an
 * adhika (leap) month — they belong to the following nija month.
 */

export type ObservanceKind = "festival" | "vrat" | "sankranti";

export type Observance = {
  key: string;
  kind: ObservanceKind;
  name: { en: string; hi: string };
  about: { en: string; hi: string };
};

/** When in the day the tithi is checked. */
export type Rule = "sunrise" | "madhyahna" | "aparahna" | "pradosh" | "nishita" | "moonrise";

type Def = Omit<Observance, "key" | "kind">;
/** `avoidBhadra`: if the deciding moment falls in Bhadra (Vishti karana) and the tithi is still running at the next sunrise, the observance moves to that next day. */
type TithiDef = Def & { key: string; rule: Rule; avoidBhadra?: boolean };

/** Tithi index (1–15 Shukla, 16–30 Krishna) → monthly vrat. */
const MONTHLY: Record<number, TithiDef> = {
  4: {
    key: "vinayaka-chaturthi",
    rule: "madhyahna",
    name: { en: "Vinayaka Chaturthi", hi: "विनायक चतुर्थी" },
    about: {
      en: "Monthly fast for Lord Ganesha on the Shukla Chaturthi; worship with durva grass and modak.",
      hi: "शुक्ल चतुर्थी पर भगवान गणेश का मासिक व्रत; दूर्वा और मोदक से पूजन।",
    },
  },
  8: {
    key: "masik-durgashtami",
    rule: "sunrise",
    name: { en: "Masik Durgashtami", hi: "मासिक दुर्गाष्टमी" },
    about: {
      en: "Monthly worship of Goddess Durga on the Shukla Ashtami.",
      hi: "शुक्ल अष्टमी पर माँ दुर्गा की मासिक पूजा।",
    },
  },
  11: {
    key: "ekadashi",
    rule: "sunrise",
    name: { en: "Ekadashi (Shukla)", hi: "एकादशी (शुक्ल)" },
    about: {
      en: "Fast dedicated to Lord Vishnu; grains are avoided and the fast is broken (parana) the next morning.",
      hi: "भगवान विष्णु को समर्पित व्रत; अन्न का त्याग, और अगली सुबह पारण।",
    },
  },
  13: {
    key: "pradosh",
    rule: "pradosh",
    name: { en: "Pradosh Vrat", hi: "प्रदोष व्रत" },
    about: {
      en: "Fast for Lord Shiva; worship in the pradosh kaal, the twilight around sunset.",
      hi: "भगवान शिव का व्रत; सूर्यास्त के आसपास प्रदोष काल में पूजा।",
    },
  },
  15: {
    key: "purnima",
    rule: "sunrise",
    name: { en: "Purnima", hi: "पूर्णिमा" },
    about: {
      en: "Full moon. Auspicious for fasting, charity, a holy dip and Satyanarayan katha.",
      hi: "पूर्णिमा। व्रत, दान, पवित्र स्नान और सत्यनारायण कथा के लिए शुभ।",
    },
  },
  19: {
    key: "sankashti-chaturthi",
    rule: "moonrise",
    name: { en: "Sankashti Chaturthi", hi: "संकष्टी चतुर्थी" },
    about: {
      en: "Fast for Lord Ganesha on the Krishna Chaturthi, broken after sighting the moon.",
      hi: "कृष्ण चतुर्थी पर भगवान गणेश का व्रत, चंद्र दर्शन के बाद खोला जाता है।",
    },
  },
  23: {
    key: "kalashtami",
    rule: "nishita",
    name: { en: "Kalashtami", hi: "कालाष्टमी" },
    about: {
      en: "Monthly worship of Kaal Bhairav on the Krishna Ashtami.",
      hi: "कृष्ण अष्टमी पर काल भैरव की मासिक पूजा।",
    },
  },
  26: {
    key: "ekadashi",
    rule: "sunrise",
    name: { en: "Ekadashi (Krishna)", hi: "एकादशी (कृष्ण)" },
    about: {
      en: "Fast dedicated to Lord Vishnu; grains are avoided and the fast is broken (parana) the next morning.",
      hi: "भगवान विष्णु को समर्पित व्रत; अन्न का त्याग, और अगली सुबह पारण।",
    },
  },
  28: {
    key: "pradosh",
    rule: "pradosh",
    name: { en: "Pradosh Vrat", hi: "प्रदोष व्रत" },
    about: {
      en: "Fast for Lord Shiva; worship in the pradosh kaal, the twilight around sunset.",
      hi: "भगवान शिव का व्रत; सूर्यास्त के आसपास प्रदोष काल में पूजा।",
    },
  },
  29: {
    key: "masik-shivaratri",
    rule: "nishita",
    name: { en: "Masik Shivaratri", hi: "मासिक शिवरात्रि" },
    about: {
      en: "Monthly night of Lord Shiva on the Krishna Chaturdashi.",
      hi: "कृष्ण चतुर्दशी पर भगवान शिव की मासिक रात्रि।",
    },
  },
  30: {
    key: "amavasya",
    rule: "sunrise",
    name: { en: "Amavasya", hi: "अमावस्या" },
    about: {
      en: "New moon. Traditionally for tarpan and offerings to ancestors (pitru), and charity.",
      hi: "अमावस्या। पितरों के लिए तर्पण, दान और पूजा का दिन।",
    },
  },
};

/** "Amanta masa|tithi index" → festival. */
const FESTIVALS: Record<string, TithiDef> = {
  "Chaitra|1": {
    key: "chaitra-navratri",
    rule: "madhyahna",
    name: { en: "Chaitra Navratri begins · Hindu New Year", hi: "चैत्र नवरात्रि प्रारंभ · हिंदू नववर्ष" },
    about: {
      en: "Nine nights of Goddess Durga begin with ghatasthapana; also Gudi Padwa and Ugadi.",
      hi: "घटस्थापना के साथ माँ दुर्गा की नौ रात्रियाँ आरंभ; गुड़ी पड़वा और उगादि भी।",
    },
  },
  "Chaitra|9": {
    key: "ram-navami",
    rule: "madhyahna",
    name: { en: "Ram Navami", hi: "राम नवमी" },
    about: { en: "Birth of Lord Rama, celebrated at midday.", hi: "भगवान श्रीराम का जन्मोत्सव, मध्याह्न में।" },
  },
  "Chaitra|15": {
    key: "hanuman-jayanti",
    rule: "sunrise",
    name: { en: "Hanuman Jayanti", hi: "हनुमान जयंती" },
    about: { en: "Birth of Lord Hanuman.", hi: "हनुमान जी का जन्मोत्सव।" },
  },
  "Vaishakha|3": {
    key: "akshaya-tritiya",
    rule: "sunrise",
    name: { en: "Akshaya Tritiya", hi: "अक्षय तृतीया" },
    about: {
      en: "An auspicious day for new beginnings, buying gold and charity.",
      hi: "नए कार्यों, स्वर्ण क्रय और दान के लिए अत्यंत शुभ दिन।",
    },
  },
  "Ashadha|15": {
    key: "guru-purnima",
    rule: "sunrise",
    name: { en: "Guru Purnima", hi: "गुरु पूर्णिमा" },
    about: { en: "A day to honour one's guru and teachers.", hi: "गुरु और शिक्षकों के सम्मान का दिन।" },
  },
  "Shravana|15": {
    key: "raksha-bandhan",
    rule: "aparahna",
    avoidBhadra: true,
    name: { en: "Raksha Bandhan", hi: "रक्षा बंधन" },
    about: {
      en: "Sisters tie a rakhi on their brothers' wrists (avoid the bhadra period).",
      hi: "बहनें भाइयों की कलाई पर राखी बाँधती हैं (भद्रा काल से बचें)।",
    },
  },
  "Shravana|23": {
    key: "janmashtami",
    rule: "nishita",
    name: { en: "Krishna Janmashtami", hi: "कृष्ण जन्माष्टमी" },
    about: { en: "Birth of Lord Krishna, celebrated at midnight.", hi: "भगवान श्रीकृष्ण का जन्मोत्सव, अर्धरात्रि में।" },
  },
  "Bhadrapada|4": {
    key: "ganesh-chaturthi",
    rule: "madhyahna",
    name: { en: "Ganesh Chaturthi", hi: "गणेश चतुर्थी" },
    about: {
      en: "Ganesha is welcomed home; the festival runs to Anant Chaturdashi.",
      hi: "गणपति का घर में स्वागत; उत्सव अनंत चतुर्दशी तक चलता है।",
    },
  },
  "Ashwina|1": {
    key: "sharad-navratri",
    rule: "madhyahna",
    name: { en: "Sharad Navratri begins", hi: "शारदीय नवरात्रि प्रारंभ" },
    about: { en: "Nine nights of Goddess Durga begin with ghatasthapana.", hi: "घटस्थापना के साथ माँ दुर्गा की नौ रात्रियाँ आरंभ।" },
  },
  "Ashwina|10": {
    key: "dussehra",
    rule: "aparahna",
    name: { en: "Dussehra (Vijayadashami)", hi: "दशहरा (विजयादशमी)" },
    about: { en: "Victory of good over evil; Shami and weapon puja.", hi: "असत्य पर सत्य की विजय; शमी और शस्त्र पूजन।" },
  },
  "Ashwina|15": {
    key: "sharad-purnima",
    rule: "nishita",
    name: { en: "Sharad Purnima", hi: "शरद पूर्णिमा" },
    about: {
      en: "Kheer is kept under the moonlight overnight; Lakshmi is worshipped.",
      hi: "रात भर चाँदनी में खीर रखी जाती है; लक्ष्मी पूजन।",
    },
  },
  "Ashwina|19": {
    key: "karwa-chauth",
    rule: "moonrise",
    name: { en: "Karwa Chauth", hi: "करवा चौथ" },
    about: {
      en: "Married women fast for their husbands, breaking it after moonrise.",
      hi: "सुहागिनें पति की दीर्घायु के लिए व्रत रखती हैं, चंद्रोदय के बाद खोलती हैं।",
    },
  },
  "Ashwina|28": {
    key: "dhanteras",
    rule: "pradosh",
    name: { en: "Dhanteras", hi: "धनतेरस" },
    about: {
      en: "Worship of Dhanvantari and Lakshmi; buying metal or utensils is auspicious.",
      hi: "धन्वंतरि और लक्ष्मी पूजन; धातु या बर्तन खरीदना शुभ।",
    },
  },
  "Ashwina|30": {
    key: "diwali",
    rule: "pradosh",
    name: { en: "Diwali (Lakshmi Puja)", hi: "दीपावली (लक्ष्मी पूजन)" },
    about: {
      en: "Festival of lights; Lakshmi–Ganesha puja in the evening (pradosh kaal).",
      hi: "दीपों का पर्व; प्रदोष काल में लक्ष्मी-गणेश पूजन।",
    },
  },
  "Kartika|15": {
    key: "kartik-purnima",
    rule: "sunrise",
    name: { en: "Kartik Purnima · Dev Deepawali", hi: "कार्तिक पूर्णिमा · देव दीपावली" },
    about: {
      en: "Holy dip and lamps offered to the gods; Guru Nanak Jayanti.",
      hi: "पवित्र स्नान और देवताओं को दीपदान; गुरु नानक जयंती।",
    },
  },
  "Magha|5": {
    key: "vasant-panchami",
    rule: "madhyahna",
    name: { en: "Vasant Panchami", hi: "वसंत पंचमी" },
    about: { en: "Worship of Goddess Saraswati; the start of spring.", hi: "माँ सरस्वती की पूजा; वसंत ऋतु का आगमन।" },
  },
  "Magha|29": {
    key: "maha-shivaratri",
    rule: "nishita",
    name: { en: "Maha Shivaratri", hi: "महाशिवरात्रि" },
    about: {
      en: "The great night of Lord Shiva — fasting, abhishek and a night-long vigil.",
      hi: "भगवान शिव की महारात्रि — व्रत, अभिषेक और रात्रि जागरण।",
    },
  },
  "Phalguna|15": {
    key: "holika-dahan",
    rule: "pradosh",
    avoidBhadra: true,
    name: { en: "Holika Dahan", hi: "होलिका दहन" },
    about: {
      en: "The Holika bonfire on the eve of Holi (lit after bhadra ends).",
      hi: "होली की पूर्व संध्या पर होलिका दहन (भद्रा समाप्ति के बाद)।",
    },
  },
};

const SANKRANTI: Def = {
  name: { en: "Sankranti", hi: "संक्रांति" },
  about: {
    en: "The Sun enters a new rashi — a time for a holy dip, charity and Surya puja.",
    hi: "सूर्य का नई राशि में प्रवेश — पवित्र स्नान, दान और सूर्य पूजा का समय।",
  },
};

const MAKAR_SANKRANTI: Def = {
  name: { en: "Makar Sankranti", hi: "मकर संक्रांति" },
  about: {
    en: "The Sun enters Makara — til-gud, kite flying, a holy dip and charity.",
    hi: "सूर्य का मकर राशि में प्रवेश — तिल-गुड़, पतंग, पवित्र स्नान और दान।",
  },
};

const DAY_MS = 86_400_000;

/** The instant on `p`'s day at which `rule`'s tithi is checked. */
export function ruleInstant(p: Panchanga, rule: Rule): Date {
  const rise = p.sunrise.getTime();
  const set = p.sunset.getTime();
  switch (rule) {
    case "sunrise":
      return p.sunrise;
    case "madhyahna": // middle of the day
      return new Date(rise + (set - rise) / 2);
    case "aparahna": // the fourth fifth of daylight
      return new Date(rise + (set - rise) * 0.7);
    case "pradosh": // the twilight after sunset
      return new Date(set + 45 * 60_000);
    case "nishita": // midnight between sunset and the next sunrise
      return new Date(set + (p.nextSunrise.getTime() - set) / 2);
    case "moonrise":
      return p.moonrise ?? new Date(set + 60 * 60_000);
  }
}

export type ObservanceInput = {
  /** The day's, the previous day's and the next day's panchang at sunrise. */
  today: Panchanga;
  yesterday: Panchanga;
  tomorrow: Panchanga;
  /** The panchang at any instant (same location) — memoised by the caller. */
  at: (instant: Date) => Panchanga;
};

/** Tithi index `t` advanced by `n` (1–30, wrapping). */
const plus = (t: number, n: number) => ((t - 1 + n) % 30) + 1;

export function observancesFor({ today, yesterday, tomorrow, at }: ObservanceInput): Observance[] {
  const out: Observance[] = [];
  const t0 = today.tithi.index;
  // A tithi can only be running later today if it's today's sunrise tithi or one of the next two.
  const candidates = new Set([t0, plus(t0, 1), plus(t0, 2)]);

  const matches = (def: TithiDef, tithi: number, masa: string | null, p: Panchanga) =>
    p.tithi.index === tithi && (masa == null || p.masaAmanta.iast === masa);

  /** True when `p` falls in an adhika month: the same masa is still running half a month into the next one. */
  const isAdhika = (p: Panchanga) => {
    const daysAhead = 45 - p.tithi.index;
    const later = at(new Date(p.reference.instant.getTime() + daysAhead * DAY_MS));
    return later.masaAmanta.iast === p.masaAmanta.iast;
  };

  const isVishti = (p: Panchanga) => p.karana.name.iast === "Vishti";
  const masaOk = (p: Panchanga, masa: string | null) => masa == null || p.masaAmanta.iast === masa;

  /** Does `def`'s tithi run at its deciding moment on the day whose sunrise panchang is `day`? */
  const ruleHit = (def: TithiDef, tithi: number, masa: string | null, day: Panchanga) => {
    const p = at(ruleInstant(day, def.rule));
    return matches(def, tithi, masa, p) ? p : null;
  };

  /** Decide whether `def` (tithi + optional amanta masa) falls on today. */
  const check = (def: TithiDef, tithi: number, masa: string | null): boolean => {
    if (!candidates.has(tithi) && yesterday.tithi.index !== tithi) return false;

    const hitToday = ruleHit(def, tithi, masa, today);
    const hitYesterday = ruleHit(def, tithi, masa, yesterday);
    const bhadraPushed = (hit: Panchanga | null, nextSunrise: Panchanga) =>
      !!def.avoidBhadra && !!hit && isVishti(hit) && nextSunrise.tithi.index === tithi;

    let day: Panchanga | null = null;
    if (hitToday && !hitYesterday) {
      // In Bhadra today and the tithi carries into tomorrow's sunrise → it's tomorrow.
      if (bhadraPushed(hitToday, tomorrow)) return false;
      day = hitToday;
    } else if (hitYesterday && bhadraPushed(hitYesterday, today) && masaOk(today, masa)) {
      // Pushed here from yesterday's Bhadra.
      day = today;
    } else if (!hitToday && !hitYesterday && !ruleHit(def, tithi, masa, tomorrow)) {
      // The tithi never covers its deciding moment (e.g. it ends minutes before
      // midnight): fall back to the day it's running at sunrise, or — if it
      // covers no sunrise at all — the day it begins and ends within.
      if (t0 === tithi && masaOk(today, masa)) day = today;
      else if (t0 === plus(tithi, 29) && tomorrow.tithi.index === plus(tithi, 1)) {
        const during = at(new Date(today.tithi.end.getTime() + 60_000));
        if (matches(def, tithi, masa, during)) day = during;
      }
    }
    if (!day) return false;
    return masa == null || !isAdhika(day);
  };

  const festivalKeys = new Set<string>();
  for (const [id, def] of Object.entries(FESTIVALS)) {
    const [masa, tithi] = id.split("|") as [string, string];
    if (check(def, Number(tithi), masa)) {
      out.push({ key: def.key, kind: "festival", name: def.name, about: def.about });
      festivalKeys.add(def.key);
    }
  }

  for (const [tithi, def] of Object.entries(MONTHLY)) {
    if (!check(def, Number(tithi), null)) continue;
    // A festival on a full / new moon already names the day (e.g. Guru Purnima).
    const named = (def.key === "purnima" || def.key === "amavasya") && festivalKeys.size > 0;
    if (!named && !out.some((o) => o.key === def.key)) {
      out.push({ key: def.key, kind: "vrat", name: def.name, about: def.about });
    }
  }

  if (today.sunSign.iast !== tomorrow.sunSign.iast) {
    const into = tomorrow.sunSign;
    const makar = into.iast === "Makara";
    out.push({
      key: `sankranti-${into.iast.toLowerCase()}`,
      kind: "sankranti",
      name: makar ? MAKAR_SANKRANTI.name : { en: `${into.iast} Sankranti`, hi: `${into.devanagari} संक्रांति` },
      about: (makar ? MAKAR_SANKRANTI : SANKRANTI).about,
    });
  }
  return out;
}
