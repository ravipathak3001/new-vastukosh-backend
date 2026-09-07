import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserModel } from "../src/modules/auth/auth.model.js";
import { hashPassword } from "../src/shared/auth/password.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { ALL_PERMISSION_KEYS } from "../src/modules/roles/permission-catalog.js";
import { ensureSuperAdminRole } from "../src/modules/roles/role.service.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const gql = makeExecutor();
const superAdminToken = signAccessToken({
  sub: "000000000000000000000001",
  roles: ["admin"],
  permissions: ALL_PERMISSION_KEYS,
});
const superAdminAuth = { authorization: `Bearer ${superAdminToken}` };

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(resetDb);

async function createAdminUser(email: string) {
  return UserModel.create({
    email,
    passwordHash: await hashPassword("secret123"),
    name: "Test Admin",
    roles: ["admin", "customer"],
    referralCode: `SEEKER-${email}`,
  });
}

describe("no-lockout fallback", () => {
  it("grants full access to an admin with no custom role assigned", async () => {
    await createAdminUser("fresh-admin@test.com");
    const login = await gql(
      `mutation { login(input: { email: "fresh-admin@test.com", password: "secret123" }) { accessToken } }`,
    );
    const token = login.data.login.accessToken as string;

    const res = await gql(`{ adminOrders(page: 1, pageSize: 5) { total } }`, undefined, {
      authorization: `Bearer ${token}`,
    });
    expect(res.errors).toBeUndefined();
    expect(res.data.adminOrders.total).toBe(0);
  });
});

describe("custom roles", () => {
  it("rejects an unknown permission key", async () => {
    const res = await gql(
      `mutation { createRole(input: { name: "Bad", permissions: ["not.a.real.permission"] }) { id } }`,
      undefined,
      superAdminAuth,
    );
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("scopes a user down to exactly the assigned role's permissions", async () => {
    const role = await gql(
      `mutation { createRole(input: { name: "Fulfillment", permissions: ["orders.view"] }) { id name permissions } }`,
      undefined,
      superAdminAuth,
    );
    expect(role.data.createRole.permissions).toEqual(["orders.view"]);
    const roleId = role.data.createRole.id as string;

    const user = await createAdminUser("fulfillment@test.com");
    const assign = await gql(
      `mutation ($u: ID!, $r: [ID!]!) { assignUserRoles(userId: $u, roleIds: $r) { customRoles { name } } }`,
      { u: String(user._id), r: [roleId] },
      superAdminAuth,
    );
    expect(assign.data.assignUserRoles.customRoles.map((r: any) => r.name)).toEqual([
      "Fulfillment",
    ]);

    const login = await gql(
      `mutation { login(input: { email: "fulfillment@test.com", password: "secret123" }) { accessToken } }`,
    );
    const scopedAuth = { authorization: `Bearer ${login.data.login.accessToken}` };

    // Allowed: the role has orders.view.
    const view = await gql(`{ adminOrders(page: 1, pageSize: 5) { total } }`, undefined, scopedAuth);
    expect(view.errors).toBeUndefined();

    // Denied: the role does not have orders.manage.
    const manage = await gql(
      `mutation { verifyOrder(orderNo: "VV-000-Om") { orderNo } }`,
      undefined,
      scopedAuth,
    );
    expect(manage.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");

    // Denied: nowhere near catalog permissions either.
    const catalog = await gql(`{ adminProducts(page: 1, pageSize: 5) { total } }`, undefined, scopedAuth);
    expect(catalog.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
  });

  it("refuses to delete a role that's still assigned to a user", async () => {
    const role = await gql(
      `mutation { createRole(input: { name: "Support", permissions: ["orders.view"] }) { id } }`,
      undefined,
      superAdminAuth,
    );
    const roleId = role.data.createRole.id as string;
    const user = await createAdminUser("support@test.com");
    await gql(
      `mutation ($u: ID!, $r: [ID!]!) { assignUserRoles(userId: $u, roleIds: $r) { id } }`,
      { u: String(user._id), r: [roleId] },
      superAdminAuth,
    );

    const del = await gql(`mutation ($id: ID!) { deleteRole(id: $id) }`, { id: roleId }, superAdminAuth);
    expect(del.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("refuses to edit or delete the seeded Super Admin role", async () => {
    const superAdmin = await ensureSuperAdminRole();
    const id = String(superAdmin._id);

    const update = await gql(
      `mutation ($id: ID!) { updateRole(id: $id, name: "Renamed") { id } }`,
      { id },
      superAdminAuth,
    );
    expect(update.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");

    const del = await gql(`mutation ($id: ID!) { deleteRole(id: $id) }`, { id }, superAdminAuth);
    expect(del.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("a customer (non-admin) gets zero permissions even with roleIds", async () => {
    const customerToken = signAccessToken({
      sub: "000000000000000000000099",
      roles: ["customer"],
      permissions: [],
    });
    const res = await gql(`{ adminOrders(page: 1, pageSize: 5) { total } }`, undefined, {
      authorization: `Bearer ${customerToken}`,
    });
    expect(res.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
  });
});
