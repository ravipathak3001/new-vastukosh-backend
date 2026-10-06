import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

export type MeetingRequest = {
  /** Stable id for this booking — makes Google's conference creation idempotent. */
  requestId: string;
  summary: string;
  description: string;
  /** Wall-clock local times (`yyyy-mm-ddTHH:mm:00`) in `timeZone`. */
  start: string;
  end: string;
  timeZone: string;
  attendeeEmail: string;
};

export type Meeting = {
  provider: string;
  url: string;
  /** Provider's event id, used to move or cancel the meeting later. */
  eventId: string;
};

/**
 * The contract every video-meeting backend implements — same pattern as
 * `payment.provider.ts` / `email.provider.ts`, so swapping Google for Zoom
 * never touches the booking flow.
 */
export interface MeetingProvider {
  readonly name: string;
  createMeeting(req: MeetingRequest): Promise<Meeting>;
  rescheduleMeeting(eventId: string, start: string, end: string, timeZone: string): Promise<void>;
  cancelMeeting(eventId: string): Promise<void>;
}

/**
 * Local-dev provider. Issues a real, joinable Jitsi room (no account or keys
 * needed) so the whole booking → confirm → join flow works before Google is
 * connected.
 */
export class MockMeetingProvider implements MeetingProvider {
  readonly name = "mock";

  async createMeeting(req: MeetingRequest): Promise<Meeting> {
    const room = `Vastukosh-${req.requestId}-${crypto.randomBytes(4).toString("hex")}`;
    return { provider: this.name, url: `https://meet.jit.si/${room}`, eventId: room };
  }

  async rescheduleMeeting(): Promise<void> {}

  async cancelMeeting(): Promise<void> {}
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_URL = "https://www.googleapis.com/calendar/v3/calendars";

/**
 * Google Calendar adapter. Google has no standalone "create a Meet link" API —
 * a Meet link is attached to a Calendar event via `conferenceData`. Each
 * confirmed consultation therefore becomes an event on `GOOGLE_CALENDAR_ID`
 * with the customer as an attendee (Google emails them the invite too).
 *
 * Auth is an offline OAuth refresh token for the calendar owner's account,
 * obtained once with `npm run google:auth` (see docs/BOOKINGS.md).
 */
export class GoogleMeetingProvider implements MeetingProvider {
  readonly name = "google";
  private accessToken: { value: string; expiresAt: number } | null = null;

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.value;
    }
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
      throw new Error(
        "Google Meet is selected but GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN are not set",
      );
    }
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!res.ok || !body.access_token) {
      throw new Error(`Google token refresh failed: ${res.status} ${JSON.stringify(body)}`);
    }
    this.accessToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return body.access_token;
  }

  private eventsUrl(path = ""): string {
    return `${GOOGLE_CALENDAR_URL}/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events${path}`;
  }

  private async call(method: string, url: string, body?: unknown): Promise<any> {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return {};
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Google Calendar ${method} failed: ${res.status} ${JSON.stringify(json)}`);
    }
    return json;
  }

  async createMeeting(req: MeetingRequest): Promise<Meeting> {
    let event = await this.call(
      "POST",
      this.eventsUrl("?conferenceDataVersion=1&sendUpdates=all"),
      {
        summary: req.summary,
        description: req.description,
        start: { dateTime: req.start, timeZone: req.timeZone },
        end: { dateTime: req.end, timeZone: req.timeZone },
        attendees: [{ email: req.attendeeEmail }],
        conferenceData: {
          createRequest: {
            requestId: req.requestId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    );

    // Conference creation is usually synchronous, but Google may report it
    // as `pending` — poll the event briefly until the Meet link appears.
    for (let i = 0; i < 5 && !event.hangoutLink; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      event = await this.call("GET", this.eventsUrl(`/${encodeURIComponent(event.id)}`));
    }
    if (!event.hangoutLink) {
      logger.error({ eventId: event.id }, "Google event created without a Meet link");
      throw new Error("Google did not attach a Meet link to the event");
    }
    return { provider: this.name, url: event.hangoutLink as string, eventId: event.id as string };
  }

  async rescheduleMeeting(eventId: string, start: string, end: string, timeZone: string) {
    await this.call("PATCH", this.eventsUrl(`/${encodeURIComponent(eventId)}?sendUpdates=all`), {
      start: { dateTime: start, timeZone },
      end: { dateTime: end, timeZone },
    });
  }

  async cancelMeeting(eventId: string) {
    await this.call("DELETE", this.eventsUrl(`/${encodeURIComponent(eventId)}?sendUpdates=all`));
  }
}

let provider: MeetingProvider | null = null;

export function getMeetingProvider(): MeetingProvider {
  if (provider) return provider;
  provider = env.MEETING_PROVIDER === "google" ? new GoogleMeetingProvider() : new MockMeetingProvider();
  logger.info({ provider: provider.name }, "Meeting provider ready");
  return provider;
}

/** Test hook: swap in a fake provider. */
export function setMeetingProvider(p: MeetingProvider | null): void {
  provider = p;
}
