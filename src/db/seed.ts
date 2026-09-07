/**
 * Idempotent seed. `npm run seed` upserts reference + demo content keyed by
 * slug/key, so it is safe to re-run. Pass `--fresh` to drop collections first.
 */
import { customAlphabet } from "nanoid";
import { connectDb, disconnectDb } from "./connection.js";
import { logger } from "../config/logger.js";
import { hashPassword } from "../shared/auth/password.js";
import { ProductModel } from "../modules/catalog/product.model.js";
import { RashiModel } from "../modules/catalog/rashi.model.js";
import { CollectionModel } from "../modules/catalog/collection.model.js";
import {
  FaqModel,
  LegalDocModel,
  PageModel,
  TestimonialModel,
} from "../modules/content/content.model.js";
import { PromoModel } from "../modules/cart/cart.model.js";
import { ConsultationServiceModel } from "../modules/consultation/consultation.model.js";
import { SiteSettingsModel } from "../modules/seo/site-settings.model.js";
import { AnnouncementModel } from "../modules/seo/announcement.model.js";
import { UserModel } from "../modules/auth/auth.model.js";
import { ensureSuperAdminRole } from "../modules/roles/role.service.js";
import { productSeeds } from "./seeds/products.js";
import { rashiSeeds } from "./seeds/rashis.js";
import {
  faqSeeds,
  legalSeeds,
  pageSeeds,
  testimonialSeeds,
} from "./seeds/content.js";
import {
  collectionSeeds,
  consultationServiceSeeds,
  promoSeeds,
  siteSettingsSeed,
} from "./seeds/misc.js";

const referralSuffix = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

async function upsertMany<T extends Record<string, unknown>>(
  model: { updateOne: (f: object, u: object, o: object) => Promise<unknown> },
  items: T[],
  keyField: keyof T,
) {
  for (const item of items) {
    await model.updateOne(
      { [keyField]: item[keyField] },
      { $set: item },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
}

async function main() {
  const fresh = process.argv.includes("--fresh");
  await connectDb();

  if (fresh) {
    logger.warn("--fresh: dropping seeded collections");
    await Promise.all([
      ProductModel.deleteMany({}),
      RashiModel.deleteMany({}),
      CollectionModel.deleteMany({}),
      TestimonialModel.deleteMany({}),
      FaqModel.deleteMany({}),
      LegalDocModel.deleteMany({}),
      PageModel.deleteMany({}),
      PromoModel.deleteMany({}),
      ConsultationServiceModel.deleteMany({}),
    ]);
  }

  await upsertMany(RashiModel, rashiSeeds, "slug");
  await upsertMany(
    ProductModel,
    productSeeds.map((p) => ({ ...p, status: "active", currency: "INR" })),
    "slug",
  );
  await upsertMany(CollectionModel, collectionSeeds, "slug");
  await upsertMany(TestimonialModel, testimonialSeeds, "key");
  await upsertMany(FaqModel, faqSeeds, "key");
  await upsertMany(LegalDocModel, legalSeeds, "slug");
  await upsertMany(PageModel, pageSeeds, "key");
  await upsertMany(PromoModel, promoSeeds, "code");
  await upsertMany(ConsultationServiceModel, consultationServiceSeeds, "key");
  await SiteSettingsModel.updateOne(
    { key: "default" },
    { $set: siteSettingsSeed },
    { upsert: true },
  );
  await AnnouncementModel.updateOne(
    { key: "default" },
    {
      $setOnInsert: {
        enabled: true,
        text: { en: "Trusted by 10,000+ seekers", hi: "10,000+ साधकों का विश्वास" },
        linkHref: "",
      },
    },
    { upsert: true },
  );

  await ensureSuperAdminRole();

  // A dev admin so the admin-scoped mutations are reachable out of the box.
  const adminEmail = "admin@vastukosh.com";
  if (!(await UserModel.exists({ email: adminEmail }))) {
    await UserModel.create({
      email: adminEmail,
      passwordHash: await hashPassword("admin1234"),
      name: "Vastukosh Admin",
      roles: ["admin", "customer"],
      referralCode: `SEEKER-${referralSuffix()}`,
      emailVerified: true,
    });
    logger.info({ email: adminEmail, password: "admin1234" }, "Created dev admin user");
  }

  const counts = {
    products: await ProductModel.countDocuments(),
    rashis: await RashiModel.countDocuments(),
    collections: await CollectionModel.countDocuments(),
    testimonials: await TestimonialModel.countDocuments(),
    faqs: await FaqModel.countDocuments(),
    legalDocs: await LegalDocModel.countDocuments(),
    pages: await PageModel.countDocuments(),
    promos: await PromoModel.countDocuments(),
    consultationServices: await ConsultationServiceModel.countDocuments(),
  };
  logger.info(counts, "Seed complete");

  await disconnectDb();
  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err }, "Seed failed");
  process.exit(1);
});
