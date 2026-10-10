import http from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { UserModel } from "../src/modules/auth/auth.model.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const gql = makeExecutor();
const AUD = "test-web.apps.googleusercontent.com";

// A stand-in for Google: our own key pair, its public half served as a JWKS
// at the URL vitest.config.ts points GOOGLE_JWKS_URL to.
let privateKey: CryptoKey;
let server: http.Server;
const strangerKey = await generateKeyPair("RS256");

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
  server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((r) => server.listen(45991, "127.0.0.1", r));
  await startTestDb();
});
afterAll(async () => {
  server.close();
  await stopTestDb();
});
beforeEach(resetDb);

function googleToken(
  claims: Record<string, unknown> = {},
  opts: { aud?: string; iss?: string; exp?: string; key?: CryptoKey } = {},
) {
  return new SignJWT({ email: "meera@gmail.com", email_verified: true, name: "Meera Iyer", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(opts.iss ?? "https://accounts.google.com")
    .setAudience(opts.aud ?? AUD)
    .setSubject("google-sub-123")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "1h")
    .sign(opts.key ?? privateKey);
}

const LOGIN = `mutation ($t: String!) { loginWithGoogle(idToken: $t) { accessToken user { id name email } } }`;

describe("Continue with Google", () => {
  it("creates an account from the Google profile on first use", async () => {
    const res = await gql(LOGIN, { t: await googleToken() });
    expect(res.errors).toBeUndefined();
    expect(res.data.loginWithGoogle.accessToken).toBeTruthy();
    expect(res.data.loginWithGoogle.user).toMatchObject({ name: "Meera Iyer", email: "meera@gmail.com" });
    const user = await UserModel.findOne({ email: "meera@gmail.com" });
    expect(user?.googleId).toBe("google-sub-123");
    expect(user?.emailVerified).toBe(true);
    expect(user?.passwordHash).toBe("");
  });

  it("signs the same person back in instead of creating a second account", async () => {
    const first = await gql(LOGIN, { t: await googleToken() });
    const again = await gql(LOGIN, { t: await googleToken({ email: "Meera@Gmail.com" }) });
    expect(again.data.loginWithGoogle.user.id).toBe(first.data.loginWithGoogle.user.id);
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it("links to an existing email + password account, which keeps working", async () => {
    const signup = await gql(
      `mutation { signup(input: { name: "Meera", email: "meera@gmail.com", password: "secret123" }) { user { id } } }`,
    );
    const res = await gql(LOGIN, { t: await googleToken() });
    expect(res.data.loginWithGoogle.user.id).toBe(signup.data.signup.user.id);
    const pw = await gql(`mutation { login(input: { email: "meera@gmail.com", password: "secret123" }) { accessToken } }`);
    expect(pw.data.login.accessToken).toBeTruthy();
  });

  it("tells a Google-only account to use Google when it tries a password", async () => {
    await gql(LOGIN, { t: await googleToken() });
    const res = await gql(`mutation { login(input: { email: "meera@gmail.com", password: "whatever1" }) { accessToken } }`);
    expect(res.errors?.[0]?.message).toMatch(/uses Google sign-in/);
  });

  it.each([
    ["a token for another app", { aud: "someone-else.apps.googleusercontent.com" }],
    ["a token not from Google", { iss: "https://evil.example.com" }],
    ["an expired token", { exp: "-1m" }],
    ["a token signed with someone else's key", { key: strangerKey.privateKey }],
  ])("refuses %s", async (_label, opts) => {
    const res = await gql(LOGIN, { t: await googleToken({}, opts) });
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
    expect(res.errors?.[0]?.message).toBe("Google sign-in failed — please try again");
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it("refuses an unverified Google email", async () => {
    const res = await gql(LOGIN, { t: await googleToken({ email_verified: false }) });
    expect(res.errors?.[0]?.message).toBe("Your Google account's email isn't verified");
  });
});
