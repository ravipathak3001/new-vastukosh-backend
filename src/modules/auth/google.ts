import { createRemoteJWKSet, jwtVerify } from "jose";
import { env, isProd } from "../../config/env.js";
import { badInput } from "../../shared/errors.js";

/** The parts of a Google ID token we use to sign someone in. */
export type GoogleIdentity = {
  googleId: string;
  email: string;
  name: string;
};

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function googleKeys() {
  // Tests point this at a local key set; production always uses Google's.
  const url = !isProd && env.GOOGLE_JWKS_URL ? env.GOOGLE_JWKS_URL : "https://www.googleapis.com/oauth2/v3/certs";
  jwks ??= createRemoteJWKSet(new URL(url));
  return jwks;
}

export function googleClientIds(): string[] {
  return (env.GOOGLE_SIGNIN_CLIENT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Checks the ID token Google's sign-in button hands the browser or app: signed
 * by Google, issued for one of our client IDs, not expired, and for an email
 * Google has verified. Anything else is refused.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const audience = googleClientIds();
  if (!audience.length) throw badInput("Google sign-in isn't available right now");

  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(idToken, googleKeys(), { issuer: GOOGLE_ISSUERS, audience }));
  } catch {
    throw badInput("Google sign-in failed — please try again");
  }

  const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : "";
  if (!email || payload.email_verified !== true || typeof payload.sub !== "string") {
    throw badInput("Your Google account's email isn't verified");
  }
  const name =
    (typeof payload.name === "string" && payload.name.trim()) ||
    [payload.given_name, payload.family_name].filter((p) => typeof p === "string" && p).join(" ") ||
    email.split("@")[0]!;
  return { googleId: payload.sub, email, name };
}
