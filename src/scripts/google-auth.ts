/**
 * One-time helper: authorises the backend to create Google Calendar events
 * (with Meet links) on your account, and prints the GOOGLE_REFRESH_TOKEN to
 * put in `.env`.
 *
 *   1. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env (OAuth client of
 *      type "Web application" with redirect URI http://localhost:5555/callback).
 *   2. npm run google:auth
 *   3. Open the printed URL, sign in as the calendar owner, approve.
 *
 * See docs/BOOKINGS.md for the full walkthrough.
 */
import { createServer } from "node:http";
import { env } from "../config/env.js";

const PORT = 5555;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: env.GOOGLE_CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: "code",
  scope: SCOPE,
  // offline + consent guarantees Google returns a refresh token.
  access_type: "offline",
  prompt: "consent",
}).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end(`Authorisation failed: ${url.searchParams.get("error") ?? "no code"}`);
    return;
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const body = (await tokenRes.json()) as { refresh_token?: string; error?: string };
  if (!body.refresh_token) {
    res.writeHead(500).end(`No refresh token returned: ${JSON.stringify(body)}`);
    console.error("No refresh token returned:", body);
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("Done — return to the terminal.");
    console.log("\nAdd these to backend/.env:\n");
    console.log("MEETING_PROVIDER=google");
    console.log(`GOOGLE_REFRESH_TOKEN=${body.refresh_token}\n`);
  }
  server.close();
});

server.listen(PORT, () => {
  console.log("Open this URL and sign in as the account whose calendar should hold the meetings:\n");
  console.log(authUrl.toString(), "\n");
});
