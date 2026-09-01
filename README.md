# Vastukosh — API

The GraphQL backend for the Vastukosh storefront (`../frontend`) and the future
mobile app. **Node.js + TypeScript + MongoDB + GraphQL (Pothos, code-first)**,
organised as self-contained domain modules.

---

## Stack

| Concern        | Choice                                                            |
| -------------- | ---------------------------------------------------------------- |
| HTTP           | Express 4 + [Apollo Server 5](https://www.apollographql.com/docs/apollo-server) (`@as-integrations/express4`) |
| Schema         | [Pothos](https://pothos-graphql.dev) code-first (`scope-auth`, `relay`, `dataloader`, `zod`, `simple-objects`) |
| Data           | Mongoose 8 / MongoDB                                             |
| Auth           | JWT access tokens + rotating, hashed refresh tokens; `bcryptjs`  |
| Config         | `zod`-validated env (`src/config/env.ts`)                        |
| Logging        | `pino`                                                          |
| Tests          | `vitest` + `mongodb-memory-server`                              |
| Dev / build    | `tsx watch` / `tsup` → `dist/`                                  |

The SDL is emitted to **`schema.graphql`** (committed) — the published contract
for the frontend's codegen and any other client.

> **Building a mobile / third-party client?** See
> [`docs/MOBILE_API_GUIDE.md`](docs/MOBILE_API_GUIDE.md) — endpoint, token flow
> for native, localisation, error codes, the full operation catalogue and the
> `panchang` query.

## Getting started

```bash
cd backend
cp .env.example .env
docker compose up -d          # local MongoDB on :27017  (or point MONGODB_URI at Atlas)
npm install
npm run seed                  # idempotent — ports frontend/data/* into MongoDB
npm run dev                   # GraphQL + Apollo Sandbox at http://localhost:4000/graphql
```

`npm run seed` also creates a dev admin: `admin@vastukosh.com` / `admin1234`.

| Script                | Does                                                     |
| --------------------- | ------------------------------------------------------- |
| `npm run dev`         | Watch-mode server (`tsx`)                              |
| `npm run build`       | Bundle to `dist/` (`tsup`)                             |
| `npm start`           | Run the built server                                   |
| `npm run seed`        | Upsert reference + demo content (`--fresh` to wipe first) |
| `npm run print-schema`| Regenerate `schema.graphql`                            |
| `npm run check-schema`| Fail if `schema.graphql` is stale (runs on `pretest`, belongs in CI) |
| `npm run typecheck`   | `tsc --noEmit`                                         |
| `npm run lint`        | ESLint                                                 |
| `npm test`            | Vitest (unit + integration on an in-memory Mongo)      |

## Architecture

```
src/
  config/            env (zod-validated), logger
  db/                mongoose connection, seed runner + seeds/*
  graphql/           Pothos builder, context, schema composition, error masking
  modules/<name>/    one vertical slice per domain
    <name>.model.ts       mongoose schema + inferred TS types (via defineModel)
    <name>.service.ts     business logic — no GraphQL imports, unit-testable
    <name>.schema.ts      Pothos object types + register<Name>Module(builder)
  shared/            localized strings, errors, auth (jwt/password), http helpers
```

Every module is wired in exactly one place — `src/graphql/schema.ts`. Adding a
module = new folder + one `register…()` call.

### Modules

| Module         | Surface                                                              |
| -------------- | ----------------------------------------------------------------- |
| `auth`         | `signup` / `login` / `refreshToken` / `logout`, `me`             |
| `user`         | profile, birth details, addresses (`self`-scoped)                |
| `catalog`      | `products` / `product` / `rashis` / `collections` (+ admin `upsertProduct`) |
| `content`      | `testimonials` / `faqs` / `legalDocs` / `page`                   |
| `seo`          | `siteSettings`, `sitemapEntries`, `redirects`, `seoForPath`; embeds `SeoMeta` |
| `cart`         | `cart`, `addToCart` / `setCartItemQty` / `applyPromo` … (user or guest `anonId`) |
| `order`        | `placeOrder`, `myOrders`, `order`, state machine + admin `advanceOrderStatus` |
| `payment`      | `PaymentProvider` interface + `MockProvider` (auto-confirm) + Razorpay stub + webhook |
| `consultation` | `consultationServices`, `availableSlots`, `bookConsultation`     |
| `marketing`    | `subscribeNewsletter`, `submitContactForm`                       |
| `panchang`     | `panchang(date, latitude, longitude, timezone, monthSystem)` — wraps the standalone [`@vastukosh/panchang`](../packages/panchang) package (`file:` dependency) |

## Auth model (web + mobile)

- **Access token** — JWT, 15 min, sent as `Authorization: Bearer <token>` by every
  client (web and native, identical path).
- **Refresh token** — 48-byte random string, 30 days, stored only as a SHA-256
  hash. Rotated on every use; reusing a revoked token revokes the whole token
  *family* (stolen-token mitigation).
  - **Web** also receives it in an `httpOnly` `vk_rt` cookie — `refreshToken` /
    `logout` read the cookie when no argument is given.
  - **Native** passes `refreshToken:` explicitly and stores it itself.

## SEO

The API is the source of truth for SEO metadata:

- Every indexable type exposes `seo: ResolvedSeo!` — `resolveSeo()` fills missing
  fields from the entity (title + brand suffix, description, `ogImage`, canonical
  path).
- `sitemapEntries(baseUrl)` returns every route × locale with `hreflang`
  alternates; the frontend's `app/sitemap.ts` consumes it.
- `Page` documents let marketing override per-route `<title>` / description
  without a deploy; `redirects` feeds Next's redirect config.
- On catalog writes the API POSTs `FRONTEND_REVALIDATE_URL` with
  `x-revalidate-secret` so Next drops the affected cached pages.

## Payments

`PAYMENT_PROVIDER=mock` (default) auto-confirms orders — good for dev, tests and
the current frontend checkout. Set `PAYMENT_PROVIDER=razorpay` + the
`RAZORPAY_*` keys to switch; `RazorpayPaymentProvider` + `POST /webhooks/razorpay`
(HMAC-verified) are stubbed and ready to complete. Swapping providers needs **no
schema change**.

## Environment

See `.env.example`. Notable: `MONGODB_URI`, `JWT_ACCESS_SECRET` /
`JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `PAYMENT_PROVIDER`, `SITE_URL`,
`FRONTEND_REVALIDATE_URL` / `REVALIDATE_SECRET`.
