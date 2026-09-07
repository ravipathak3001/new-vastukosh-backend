/**
 * Every permission a custom role can grant. Deliberately a fixed, curated set
 * (not free-text) so the admin UI can render a checkbox matrix and a role can
 * never reference a permission that doesn't gate anything.
 *
 * Adding a new gated action: add the key here, then use
 * `authScopes: { permission: "the.key" }` on the resolver.
 */
export const PERMISSION_CATALOG = [
  { key: "dashboard.view", category: "Dashboard", label: "View the dashboard" },

  { key: "orders.view", category: "Orders", label: "View orders" },
  {
    key: "orders.manage",
    category: "Orders",
    label: "Verify, ship, cancel, and refund orders",
  },
  {
    key: "orders.automation",
    category: "Orders",
    label: "Change Shiprocket automation settings",
  },

  { key: "catalog.view", category: "Catalog", label: "View products and collections" },
  {
    key: "catalog.manage",
    category: "Catalog",
    label: "Create, edit, archive products and collections",
  },

  { key: "promos.view", category: "Promo codes", label: "View promo codes" },
  { key: "promos.manage", category: "Promo codes", label: "Create, edit, delete promo codes" },

  { key: "bookings.view", category: "Bookings", label: "View consultation bookings" },
  {
    key: "bookings.manage",
    category: "Bookings",
    label: "Update booking status and consultation services",
  },

  { key: "content.view", category: "Content", label: "View CMS content" },
  {
    key: "content.manage",
    category: "Content",
    label: "Edit testimonials, FAQs, legal docs, and pages",
  },

  { key: "marketing.view", category: "Marketing", label: "View contact inbox and subscribers" },
  {
    key: "marketing.manage",
    category: "Marketing",
    label: "Update contact and subscriber status",
  },

  { key: "settings.manage", category: "Settings", label: "Edit site settings, redirects, announcement bar" },

  { key: "returns.view", category: "Returns", label: "View return requests" },
  {
    key: "returns.manage",
    category: "Returns",
    label: "Approve, reject, schedule pickup, refund returns",
  },

  { key: "users.view", category: "Users", label: "View customer and admin accounts" },
  { key: "users.manage", category: "Users", label: "Grant or revoke admin-panel access" },

  { key: "roles.manage", category: "Roles", label: "Create roles and assign them to users" },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]["key"];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_CATALOG.map((p) => p.key);

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSION_KEYS as string[]).includes(value);
}
