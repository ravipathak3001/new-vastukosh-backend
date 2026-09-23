/**
 * Starter stone catalogue: the 9 traditional gems (already priced sky-high relative to their
 * alternatives — these are illustrative placeholders, not real pricing) plus exactly one budget
 * alternative per graha, picked from the alternatives spreadsheet. Deliberately not the full ~32-stone
 * list yet — prove the pipeline (pricing, cart, picker UI) on 18 stones first, then add the rest as
 * data rows once that's working; nothing about adding stone #19 needs new code.
 */
import type { GrahaName } from "vedic-kundali";

export type StoneSeed = {
  slug: string;
  name: { en: string; hi: string };
  grahas: GrahaName[];
  primary: boolean;
  pricePerBead: number;
};

export const stoneSeeds: StoneSeed[] = [
  {
    slug: "ruby",
    name: { en: "Ruby (Manikya)", hi: "माणिक्य (रूबी)" },
    grahas: ["Sun"],
    primary: true,
    pricePerBead: 180,
  },
  {
    slug: "sunstone",
    name: { en: "Sunstone", hi: "सनस्टोन" },
    grahas: ["Sun"],
    primary: false,
    pricePerBead: 15,
  },
  {
    slug: "pearl",
    name: { en: "Natural Pearl (Moti)", hi: "मोती" },
    grahas: ["Moon"],
    primary: true,
    pricePerBead: 120,
  },
  {
    slug: "moonstone",
    name: { en: "Moonstone", hi: "मूनस्टोन" },
    grahas: ["Moon"],
    primary: false,
    pricePerBead: 18,
  },
  {
    slug: "red-coral",
    name: { en: "Red Coral (Moonga)", hi: "मूंगा" },
    grahas: ["Mars"],
    primary: true,
    pricePerBead: 150,
  },
  {
    slug: "carnelian",
    name: { en: "Carnelian", hi: "कार्नेलियन" },
    grahas: ["Mars"],
    primary: false,
    pricePerBead: 12,
  },
  {
    slug: "emerald",
    name: { en: "Emerald (Panna)", hi: "पन्ना" },
    grahas: ["Mercury"],
    primary: true,
    pricePerBead: 200,
  },
  {
    slug: "peridot",
    name: { en: "Peridot", hi: "पेरिडॉट" },
    grahas: ["Mercury"],
    primary: false,
    pricePerBead: 20,
  },
  {
    slug: "yellow-sapphire",
    name: { en: "Yellow Sapphire (Pukhraj)", hi: "पुखराज" },
    grahas: ["Jupiter"],
    primary: true,
    pricePerBead: 170,
  },
  {
    slug: "citrine",
    name: { en: "Citrine", hi: "सिट्रीन" },
    grahas: ["Jupiter"],
    primary: false,
    pricePerBead: 15,
  },
  {
    slug: "diamond",
    name: { en: "Diamond (Heera)", hi: "हीरा" },
    grahas: ["Venus"],
    primary: true,
    pricePerBead: 350,
  },
  {
    slug: "rose-quartz",
    name: { en: "Rose Quartz", hi: "रोज़ क्वार्ट्ज़" },
    grahas: ["Venus"],
    primary: false,
    pricePerBead: 10,
  },
  {
    slug: "blue-sapphire",
    name: { en: "Blue Sapphire (Neelam)", hi: "नीलम" },
    grahas: ["Saturn"],
    primary: true,
    pricePerBead: 190,
  },
  {
    slug: "amethyst",
    name: { en: "Amethyst", hi: "एमेथिस्ट" },
    grahas: ["Saturn"],
    primary: false,
    pricePerBead: 18,
  },
  {
    slug: "hessonite",
    name: { en: "Hessonite (Gomed)", hi: "गोमेद" },
    grahas: ["Rahu"],
    primary: true,
    pricePerBead: 140,
  },
  {
    slug: "smoky-quartz",
    name: { en: "Smoky Quartz", hi: "स्मोकी क्वार्ट्ज़" },
    grahas: ["Rahu"],
    primary: false,
    pricePerBead: 12,
  },
  {
    slug: "cats-eye",
    name: { en: "Cat's Eye (Lehsunia)", hi: "लहसुनिया" },
    grahas: ["Ketu"],
    primary: true,
    pricePerBead: 160,
  },
  {
    slug: "tigers-eye",
    name: { en: "Tiger's Eye", hi: "टाइगर आई" },
    grahas: ["Ketu"],
    primary: false,
    pricePerBead: 14,
  },
];
