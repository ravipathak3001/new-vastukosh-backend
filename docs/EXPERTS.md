# Vastukosh — Expert Marketplace (pandits, astrologers, Vastu experts)

Experts register on the website, set their own services and fees, choose their
working hours, and get paid for every booking through a wallet they cash out
from. Customers browse experts, compare reviews and fees, and book one directly.
The platform keeps a commission on each booking.

Code: `src/modules/expert/` (`expert.model.ts`, `expert.service.ts`,
`expert.refs.ts` for the GraphQL types, `expert.schema.ts` for public and
expert operations, `expert.admin.schema.ts`) plus booking integration in
`modules/consultation/consultation.service.ts`. Tests: `tests/experts.test.ts`.

---

## 1. Lifecycle of an expert

1. A signed-in user applies at `/{locale}/expert` → `applyAsExpert`. This
   creates an `ExpertProfile` with status `pending` and adds the `expert` role.
2. While pending, they can already set up their services and fees, weekly
   hours, profile and payout details. They aren't listed or bookable yet.
3. Admin (Admin → Experts) **approves**, **rejects** (with a note; the expert
   edits their profile to resubmit) or later **suspends** (hidden immediately;
   existing bookings are unaffected).

Expert access is decided by looking up the caller's profile
(`ctx.expertId()`, cached per request), not by the role in the token. A
brand-new applicant therefore gets panel access immediately, without waiting
for a token refresh.

## 2. Services, fees and availability

- `ExpertOffering`: one per expert per service. A consultation is
  `astro` / `vastu` / `gem`; a pooja is any pooja slug from the catalog.
  Each has a **price** (₹), **duration** (15–600 min in 15-min steps), and for
  poojas **number of pandits** and **samagri included**.
- **Availability**: weekly windows (`day` 0–6, `start`/`end` HH:mm in IST)
  plus `daysOff` dates.
- **Slots** (`expertSlots`) are 30-min-grid start times inside a window where
  the whole session fits and doesn't overlap the expert's other bookings.
  Same-day bookings need 60 min lead time; bookings are open up to 120 days
  ahead. Two simultaneous bookings that overlap: the earlier one wins.
- Platform bookings (no expert) keep their own fixed slot grid, which ignores
  expert bookings, and admin can assign an expert to one later
  (`assignBookingExpert`).

## 3. Money

```
customer pays ₹P (Razorpay) ──► booking stores commissionPct, platformFee, expertEarning (fixed at booking time)
booking completed ──► ledger booking_credit +expertEarning   (wallet ↑, lifetime ↑)
refunded after completion ──► ledger booking_reversal −expertEarning
cashout requested ──► ledger payout_hold −amount              (atomic: never below zero)
admin marks paid (UTR) ──► payout = paid
admin rejects ──► ledger payout_release +amount
admin adjustment ──► ledger adjustment ±amount (note required)
```

- **Commission**: marketplace default (Admin → Experts → settings, default
  20%) or a per-expert override. Changes apply to **new** bookings only.
- **Ledger** (`ExpertLedger`) is append-only and the source of truth;
  `walletBalance` on the profile is a cached total, updated in the same guarded
  write. Unique `(bookingId|payoutId, type)` indexes make credits, reversals,
  holds and releases idempotent, so retries never double-pay.
- **Cashouts**: need status `approved`, a payout destination (bank account +
  IFSC, or UPI) and at least the minimum (default ₹500). Only one request can
  be open at a time. Paid manually by admin (Admin → Expert payouts), who then
  enters the UTR.

## 4. Reviews

After a **completed** booking, the customer (signed in, or a guest using the
booking link's token) can leave one 1–5★ review with an optional comment
(`submitExpertReview`). The expert's `ratingAvg` and `ratingCount` are
recomputed. Admin can hide a review.

## 5. Privacy

Public: name, title, photo, headline, bio, specialities, languages,
experience, city, rating, active offerings, working weekdays and upcoming days
off. Private (the expert and staff with `experts.view` only): status notes,
email, phone, KYC (PAN, ID last-4, bank and UPI), wallet and the full
schedule. On bookings, the customer's phone, birth details, sankalp and the
earnings split are visible to staff and to **the assigned expert only**.

## 6. Permissions (admin roles)

| Key | Allows |
| --- | --- |
| `experts.view` | See experts, their wallets and reviews |
| `experts.manage` | Approve / reject / suspend, commission, marketplace settings, hide reviews |
| `payouts.manage` | Mark cashouts paid / rejected, wallet adjustments |

## 7. Known follow-ups

- **No file uploads yet.** The photo is a link and KYC is numbers only (no
  ID or certificate documents). Adding uploads needs a storage choice (S3,
  Cloudinary, …).
- **Payouts are manual.** RazorpayX Payouts could automate them later
  without changing the ledger.
- **The mobile app** can browse and book only platform services; booking a
  specific expert is web-only for now.
- **GST/TDS on expert payouts** isn't calculated. Check with your accountant
  before going live.
