import { builder } from "./builder.js";
import { registerAuthModule } from "../modules/auth/auth.schema.js";
import { registerUserModule } from "../modules/user/user.schema.js";
import { registerAdminModule } from "../modules/admin/admin.schema.js";
import { registerCatalogModule } from "../modules/catalog/catalog.schema.js";
import { registerCatalogAdminModule } from "../modules/catalog/catalog.admin.schema.js";
import { registerContentModule } from "../modules/content/content.schema.js";
import { registerContentAdminModule } from "../modules/content/content.admin.schema.js";
import { registerSeoModule } from "../modules/seo/seo.schema.js";
import { registerSeoAdminModule } from "../modules/seo/seo.admin.schema.js";
import { registerCartModule } from "../modules/cart/cart.schema.js";
import { registerPromoAdminModule } from "../modules/cart/promo.admin.schema.js";
import { registerOrderModule } from "../modules/order/order.schema.js";
import { registerOrderAdminModule } from "../modules/order/order.admin.schema.js";
import { registerShippingModule } from "../modules/shipping/shipping.schema.js";
import { registerRoleModule } from "../modules/roles/role.schema.js";
import { registerReturnModule } from "../modules/returns/return.schema.js";
import { registerReturnAdminModule } from "../modules/returns/return.admin.schema.js";
import { registerConsultationModule } from "../modules/consultation/consultation.schema.js";
import { registerConsultationAdminModule } from "../modules/consultation/consultation.admin.schema.js";
import { registerMarketingModule } from "../modules/marketing/marketing.schema.js";
import { registerMarketingAdminModule } from "../modules/marketing/marketing.admin.schema.js";
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
  registerAdminModule();
  registerCatalogModule();
  registerCatalogAdminModule();
  registerContentModule();
  registerContentAdminModule();
  registerSeoModule();
  registerSeoAdminModule();
  registerCartModule();
  registerPromoAdminModule();
  registerOrderModule();
  registerOrderAdminModule();
  registerShippingModule();
  registerRoleModule();
  registerReturnModule();
  registerReturnAdminModule();
  registerConsultationModule();
  registerConsultationAdminModule();
  registerMarketingModule();
  registerMarketingAdminModule();
  registerPanchangModule();

  built = builder.toSchema();
  return built;
}
