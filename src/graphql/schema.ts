import { builder } from "./builder.js";
import { registerAuthModule } from "../modules/auth/auth.schema.js";
import { registerUserModule } from "../modules/user/user.schema.js";
import { registerCatalogModule } from "../modules/catalog/catalog.schema.js";
import { registerContentModule } from "../modules/content/content.schema.js";
import { registerSeoModule } from "../modules/seo/seo.schema.js";
import { registerCartModule } from "../modules/cart/cart.schema.js";
import { registerOrderModule } from "../modules/order/order.schema.js";
import { registerConsultationModule } from "../modules/consultation/consultation.schema.js";
import { registerMarketingModule } from "../modules/marketing/marketing.schema.js";
import { registerPanchangModule } from "../modules/panchang/panchang.schema.js";

/**
 * The single composition point. Every domain module contributes its types and
 * root fields here; adding a module is one import + one call.
 */
let built: ReturnType<typeof builder.toSchema> | null = null;

export function buildSchema() {
  if (built) return built;

  registerAuthModule();
  registerUserModule();
  registerCatalogModule();
  registerContentModule();
  registerSeoModule();
  registerCartModule();
  registerOrderModule();
  registerConsultationModule();
  registerMarketingModule();
  registerPanchangModule();

  built = builder.toSchema();
  return built;
}
