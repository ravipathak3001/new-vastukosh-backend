import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { getEmailProvider } from "../email/email.provider.js";
import type { ConsultationBookingDoc } from "./consultation.model.js";

/**
 * Transactional emails for the booking lifecycle. Sending is best-effort: a
 * mail outage must never roll back a payment, confirmation or refund.
 */

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Deep link to the booking page; carries the access token so guests can act on it. */
export function bookingManageUrl(b: ConsultationBookingDoc): string {
  const locale = b.locale || "en";
  return `${env.SITE_URL}/${locale}/bookings/${b.bookingNo}?t=${b.accessToken}`;
}

function serviceLabel(b: ConsultationBookingDoc): string {
  const name = b.serviceName?.[(b.locale as "en" | "hi") || "en"] || b.serviceName?.en || b.serviceKey;
  return b.kind === "pooja" ? `${name} (online pooja)` : name;
}

function when(date: string, slot: string): string {
  return `${date} at ${slot} (${env.BOOKING_TIMEZONE})`;
}

function layout(title: string, body: string, b: ConsultationBookingDoc): string {
  return `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b1d0e">
  <h2 style="color:#8a3b12">${esc(title)}</h2>
  <p>Namaste ${esc(b.name)},</p>
  ${body}
  <p style="margin-top:24px"><a href="${bookingManageUrl(b)}" style="background:#8a3b12;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">View your booking</a></p>
  <p style="color:#7a6a58;font-size:13px">Booking reference: ${esc(b.bookingNo ?? "")}</p>
  <p>— Team Vastukosh</p>
</div>`;
}

async function send(b: ConsultationBookingDoc, subject: string, title: string, body: string) {
  try {
    await getEmailProvider().send(b.email, subject, layout(title, body, b));
  } catch (err) {
    logger.error({ err, bookingNo: b.bookingNo, subject }, "Booking email failed");
  }
}

export function sendBookingReceived(b: ConsultationBookingDoc) {
  const paid = b.amount > 0 ? `<p>We've received your payment of ₹${b.amount}.</p>` : "";
  return send(
    b,
    `Booking received — ${serviceLabel(b)}`,
    "We've received your booking",
    `<p>Thank you for booking <b>${esc(serviceLabel(b))}</b> on <b>${when(b.date, b.slot)}</b>.</p>
     ${paid}
     <p>Our team will confirm your slot shortly. ${
       b.kind === "consultation"
         ? "Once confirmed, you'll receive the video meeting link."
         : "The pooja will be performed in your name and the recording shared with you."
     }</p>`,
  );
}

export function sendBookingConfirmed(b: ConsultationBookingDoc) {
  const body =
    b.kind === "consultation" && b.meeting?.url
      ? `<p>Your <b>${esc(serviceLabel(b))}</b> is confirmed for <b>${when(b.date, b.slot)}</b>.</p>
         <p>Join the consultation online at the scheduled time:</p>
         <p><a href="${esc(b.meeting.url)}">${esc(b.meeting.url)}</a></p>
         <p>Please keep your birth details handy.</p>`
      : `<p>Your <b>${esc(serviceLabel(b))}</b> is confirmed for <b>${when(b.date, b.slot)}</b>.</p>
         <p>The pandit will perform the pooja with your sankalp. We'll email you the recording once it's complete.</p>`;
  return send(b, `Confirmed — ${serviceLabel(b)}`, "Your booking is confirmed", body);
}

export function sendRescheduleProposed(b: ConsultationBookingDoc) {
  return send(
    b,
    `New time proposed — ${serviceLabel(b)}`,
    "Could we move your booking?",
    `<p>We're sorry — we can't keep your slot on ${when(b.date, b.slot)}.</p>
     <p>We'd like to propose <b>${when(b.proposedDate, b.proposedSlot)}</b> instead.</p>
     ${b.adminNote ? `<p><i>${esc(b.adminNote)}</i></p>` : ""}
     <p>Please open your booking to accept the new time, or decline it for a full refund.</p>`,
  );
}

export function sendBookingRefunded(b: ConsultationBookingDoc) {
  return send(
    b,
    `Refund issued — ${serviceLabel(b)}`,
    "Your refund is on its way",
    `<p>We've refunded ₹${b.payment.refundAmount || b.amount} for your booking of <b>${esc(serviceLabel(b))}</b>.</p>
     <p>UPI and wallet refunds usually arrive within minutes; card refunds can take 5–7 working days.</p>`,
  );
}

export function sendRecordingReady(b: ConsultationBookingDoc) {
  return send(
    b,
    `Your pooja recording — ${serviceLabel(b)}`,
    "Your pooja has been performed",
    `<p>The <b>${esc(serviceLabel(b))}</b> has been performed with your sankalp.</p>
     <p>Watch the recording here:</p>
     <p><a href="${esc(b.recordingUrl)}">${esc(b.recordingUrl)}</a></p>`,
  );
}

/** To the expert: a customer has booked (and paid for) a session with them. */
export async function sendExpertNewBooking(b: ConsultationBookingDoc, expertEmail: string) {
  const panelUrl = `${env.SITE_URL}/en/expert/bookings`;
  const details =
    b.kind === "pooja"
      ? `<p>Sankalp: ${esc(b.name)}${b.sankalp?.gotra ? `, gotra ${esc(b.sankalp.gotra)}` : ""}</p>`
      : b.notes
        ? `<p>Their question: <i>${esc(b.notes)}</i></p>`
        : "";
  try {
    await getEmailProvider().send(
      expertEmail,
      `New booking — ${serviceLabel(b)} on ${b.date} ${b.slot}`,
      `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b1d0e">
  <h2 style="color:#8a3b12">You have a new booking</h2>
  <p><b>${esc(serviceLabel(b))}</b> on <b>${when(b.date, b.slot)}</b> for ${esc(b.name)}.</p>
  ${details}
  <p>Please confirm it (or propose another time) from your expert panel.</p>
  <p style="margin-top:24px"><a href="${panelUrl}" style="background:#8a3b12;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Open expert panel</a></p>
  <p style="color:#7a6a58;font-size:13px">Booking reference: ${esc(b.bookingNo ?? "")}</p>
</div>`,
    );
  } catch (err) {
    logger.error({ err, bookingNo: b.bookingNo }, "Expert booking email failed");
  }
}
