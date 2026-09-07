import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PasswordResetTokenModel, UserModel } from "../src/modules/auth/auth.model.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const gql = makeExecutor();

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(resetDb);

async function signUp(email: string) {
  return gql(
    `mutation ($i: SignupInput!) { signup(input: $i) { accessToken refreshToken user { id } } }`,
    { i: { name: "Reset Me", email, password: "originalpw1" } },
  );
}

/**
 * `resetPassword` only ever sees a token's hash — the raw token exists solely
 * in the email `requestPasswordReset` sends. To test the *consumption* side
 * without fighting ESM's non-configurable `crypto` exports (monkey-patching
 * `randomBytes` throws "Cannot redefine property"), plant a token row the
 * same way the service does: same hash algorithm, real user, real expiry.
 */
async function plantResetToken(email: string, expiresInMs = 60 * 60 * 1000): Promise<string> {
  const user = await UserModel.findOne({ email });
  if (!user) throw new Error(`no user for ${email}`);
  const token = crypto.randomBytes(32).toString("base64url");
  await PasswordResetTokenModel.create({
    userId: user._id,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + expiresInMs),
  });
  return token;
}

describe("forgot / reset password", () => {
  it("returns true for both a real and a non-existent email (no account enumeration)", async () => {
    await signUp("real@test.com");
    const real = await gql(`mutation { requestPasswordReset(email: "real@test.com") }`);
    const fake = await gql(`mutation { requestPasswordReset(email: "nobody@test.com") }`);
    expect(real.data.requestPasswordReset).toBe(true);
    expect(fake.data.requestPasswordReset).toBe(true);
  });

  it("creates a token row only for a real account", async () => {
    await signUp("real2@test.com");
    await gql(`mutation { requestPasswordReset(email: "real2@test.com") }`);
    await gql(`mutation { requestPasswordReset(email: "nobody2@test.com") }`);
    expect(await PasswordResetTokenModel.countDocuments({})).toBe(1);
  });

  it("resets the password end to end and revokes existing sessions", async () => {
    const signup = await signUp("owner@test.com");
    const oldRefreshToken = signup.data.signup.refreshToken as string;
    const token = await plantResetToken("owner@test.com");

    const reset = await gql(
      `mutation ($t: String!, $p: String!) { resetPassword(token: $t, newPassword: $p) }`,
      { t: token, p: "brandNewPw1" },
    );
    expect(reset.data.resetPassword).toBe(true);

    // Old password no longer works.
    const oldLogin = await gql(
      `mutation { login(input: { email: "owner@test.com", password: "originalpw1" }) { accessToken } }`,
    );
    expect(oldLogin.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");

    // New password works.
    const newLogin = await gql(
      `mutation { login(input: { email: "owner@test.com", password: "brandNewPw1" }) { accessToken } }`,
    );
    expect(newLogin.data.login.accessToken).toBeTruthy();

    // The refresh token issued before the reset is revoked.
    const rotated = await gql(
      `mutation ($t: String!) { refreshToken(refreshToken: $t) { accessToken } }`,
      { t: oldRefreshToken },
    );
    expect(rotated.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a reused token", async () => {
    await signUp("reuse@test.com");
    const token = await plantResetToken("reuse@test.com");

    const first = await gql(
      `mutation ($t: String!) { resetPassword(token: $t, newPassword: "firstNewPw1") }`,
      { t: token },
    );
    expect(first.data.resetPassword).toBe(true);

    const second = await gql(
      `mutation ($t: String!) { resetPassword(token: $t, newPassword: "secondNewPw1") }`,
      { t: token },
    );
    expect(second.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("rejects an expired token", async () => {
    await signUp("expired@test.com");
    const token = await plantResetToken("expired@test.com", -1000);

    const res = await gql(
      `mutation ($t: String!) { resetPassword(token: $t, newPassword: "whatever123") }`,
      { t: token },
    );
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("rejects an unknown token", async () => {
    const res = await gql(
      `mutation { resetPassword(token: "not-a-real-token", newPassword: "whatever123") }`,
    );
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("rejects a password shorter than 8 characters", async () => {
    await signUp("short@test.com");
    const token = await plantResetToken("short@test.com");

    const res = await gql(
      `mutation ($t: String!) { resetPassword(token: $t, newPassword: "short") }`,
      { t: token },
    );
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });
});
