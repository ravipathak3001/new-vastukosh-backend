# Vastukosh — Consultation & Online Pooja Bookings

Customers book a **consultation** (astro / vastu / gem) or an **online pooja**,
pay at booking time through Razorpay, and the team confirms it from the admin
panel. Confirming a consultation creates a **Google Meet** link that is emailed
to the customer and shown on their booking page. Poojas are performed on the
devotee's behalf; the team shares the **recording** when it's done.

Code: `src/modules/consultation/` (`consultation.service.ts` holds the lifecycle,
`meeting.provider.ts` the Google/mock meeting adapters, `booking.emails.ts` the
emails, `booking.job.ts` the cleanup cron). Tests: `tests/bookings.test.ts`.

---

## 1. Lifecycle

```
createBooking ──► pending_payment ──(paid: webhook or verifyBookingPayment)──► requested
                    │ hold expires (15 min, +30 min grace) → cancelled (cron)
                    │ (a late capture still revives it → requested, flagged in history)

requested ──confirmBooking──► confirmed ──completeBooking──► completed
    │                            │   consultations: Meet link created + emailed
    │                            │   poojas: recordingUrl emailed on completion
    └──proposeBookingReschedule──┴──► reschedule_proposed
                                          ├─ customer accepts → confirmed (at the new time; Meet event created or moved)
                                          └─ customer declines → refunded (full refund via Razorpay)

refundBooking (admin): any paid booking → refunded (cancels the Meet event)
```

| Status | Meaning |
| ------ | ------- |
| `pending_payment` | Slot held until `holdExpiresAt` while the customer pays |
| `requested` | Paid (or free) — waiting for the team to confirm |
| `reschedule_proposed` | Team offered `proposedDate/proposedSlot`; waiting for the customer |
| `confirmed` | Confirmed; consultations carry `meetingUrl` |
| `completed` | Done; poojas carry `recordingUrl` |
| `cancelled` | Unpaid hold expired, or an unpaid booking cancelled by admin |
| `refunded` | Payment returned |

Rules worth knowing:

- **Slots** are wall-clock times in `BOOKING_TIMEZONE` (IST). Consultations:
  8 slots, closed Sundays. Poojas: 6 muhurat slots, every day. Same-day slots
  need 60 min lead time; bookings up to 120 days ahead.
- A slot is taken by `requested`/`confirmed` bookings, unexpired
  `pending_payment` holds, and pending reschedule **proposals**.
- Two simultaneous bookings for one slot: the earliest wins, the other gets
  "slot no longer available" before any payment opens.
- The generic `updateBookingStatus` only allows side-effect-free moves
  (`cancelled` when unpaid, `completed`, or `requested` = "paid offline").
  Confirming, rescheduling and refunding each have their own mutation.
- **Guests** can book without an account. Every booking has a secret
  `accessToken`, returned by `createBooking` and embedded in every email link
  (`/{locale}/bookings/{bookingNo}?t=…`). Signed-in owners don't need it.

## 2. Payments

Bookings use the same Razorpay provider and webhook as shop orders (see
[PAYMENTS.md](PAYMENTS.md)). The webhook tries bookings first, then orders, so
no Razorpay dashboard change is needed. Razorpay receipts are the booking
number (`VB-XXXXXX`) and notes carry `bookingNo` and `kind`.

- Web: `createBooking` → Razorpay Checkout with `clientData` →
  `verifyBookingPayment`. Closing the modal keeps the hold; the customer can
  retry (`resumeBookingPayment` reopens the **same** Razorpay order).
- Mobile: the native Razorpay sheet (`react-native-razorpay`, wrapped in
  `mobile-app/src/lib/razorpay.ts`) opens with `clientData`, then the app calls
  `verifyBookingPayment`. App builds without the native module fall back to
  `/{locale}/bookings/{bookingNo}?t=…&pay=1` in the browser, which launches
  Checkout immediately.
- `PAYMENT_PROVIDER=mock` settles bookings instantly (local dev and tests).

## 3. Google Meet setup (one time)

Google has no "create a Meet link" API on its own. A Meet link comes with a
**Google Calendar event**. Each confirmed consultation becomes an event on
one calendar, with the customer invited as an attendee. Google also sends
them a calendar invite.

1. **Choose the account.** Ideally a Google Workspace account
   (e.g. `consult@yourdomain`), whose calendar will hold the meetings. A
   personal Gmail also works.
2. **Create a Google Cloud project** at https://console.cloud.google.com →
   *APIs & Services* → *Library* → enable **Google Calendar API**.
3. **OAuth consent screen**: Workspace → *Internal*; Gmail → *External*. Add
   the scope `https://www.googleapis.com/auth/calendar.events`. For an
   External app, add the account as a test user or publish the app; while it
   is in *Testing*, refresh tokens expire after 7 days.
4. **Credentials** → *Create credentials* → *OAuth client ID* → type
   **Web application**, authorised redirect URI
   `http://localhost:5555/callback`.
5. Put the client id/secret in `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
6. Run `npm run google:auth`, open the printed URL, sign in **as the calendar
   account**, approve. The terminal prints:
   ```
   MEETING_PROVIDER=google
   GOOGLE_REFRESH_TOKEN=...
   ```
   Add both to `.env` (and to your production secrets), then restart the API.
7. Optional: `GOOGLE_CALENDAR_ID` targets a specific calendar instead of the
   account's `primary` one, e.g. a shared "Consultations" calendar.

Until this is done, `MEETING_PROVIDER=mock` issues a free, working
`meet.jit.si` room link, so the whole flow can be tested.

If confirming fails with a Google error, the booking stays `requested`; nothing
is half-applied. Fix the credentials and confirm again.

## 4. Environment variables

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `BOOKING_TIMEZONE` | `Asia/Kolkata` | Zone the slot times are in |
| `BOOKING_HOLD_MINUTES` | `15` | How long an unpaid booking holds its slot |
| `MEETING_PROVIDER` | `mock` | `mock` (Jitsi link) or `google` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | OAuth client (step 4) |
| `GOOGLE_REFRESH_TOKEN` | — | From `npm run google:auth` |
| `GOOGLE_CALENDAR_ID` | `primary` | Calendar that holds the events |

## 5. Admin panel

- **Bookings** (`/bookings`): filter by type and status; open a booking to
  *Confirm & send Meet link*, *Propose new time*, *Complete & share recording*,
  *Refund*, *Mark paid offline*, or *Cancel* (unpaid only).
- **Online poojas** (`/poojas`): add or edit poojas (bilingual name and
  description, price, duration, order, active). The storefront `/pooja` page
  updates automatically.
- **Consultation services**: the *Consultation services* sheet on the bookings
  page (price, duration, active).

## 6. Known follow-ups

- Poojas have no live stream yet. Adding a Meet link for poojas is a small
  change in `finishConfirm` if you want live darshan later.
- Booking emails are English-only (subject and body). The storefront pages are
  bilingual.
