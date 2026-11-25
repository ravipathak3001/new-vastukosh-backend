import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type express from "express";
import { createApp } from "../src/app.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { ALL_PERMISSION_KEYS } from "../src/modules/roles/permission-catalog.js";
import { ProductModel } from "../src/modules/catalog/product.model.js";
import { MediaAssetModel } from "../src/modules/media/media.model.js";
import { cloudinarySignature, setMediaStorage, type MediaStorage } from "../src/modules/media/media.storage.js";
import { imageDimensions, sniffAudioType, sniffImageType } from "../src/modules/media/media.service.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

/** In-memory provider so tests never touch disk or Cloudinary. */
class MemoryStorage implements MediaStorage {
  readonly name = "local" as const;
  files = new Map<string, Buffer>();
  async put({ key, ext, body }: { key: string; ext: string; body: Buffer }) {
    const storageKey = `${key}.${ext}`;
    this.files.set(storageKey, body);
    return { storageKey, url: `https://media.test/${storageKey}` };
  }
  async remove(storageKey: string) {
    this.files.delete(storageKey);
  }
}

// A real 3×2 PNG header (+ padding) and a minimal JPEG with an SOF0 frame of 640×480.
const PNG = Buffer.concat([
  Buffer.from("89504e470d0a1a0a0000000d49484452000000030000000208060000", "hex"),
  Buffer.alloc(32),
]);
const JPEG = Buffer.concat([
  Buffer.from("ffd8ffe000104a46494600010100000100010000", "hex"),
  Buffer.from("ffc0001108" + "01e0" + "0280" + "03012200021101031101", "hex"),
  Buffer.alloc(16),
  Buffer.from("ffd9", "hex"),
]);

// ID3-tagged MP3 header (+ padding).
const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.from("0400000000", "hex"), Buffer.alloc(24)]);

const token = (permissions: string[]) =>
  `Bearer ${signAccessToken({ sub: "000000000000000000000001", roles: ["admin"], permissions })}`;
const asAdmin = { authorization: token(ALL_PERMISSION_KEYS) };
const asViewer = { authorization: token(["media.view"]) };

const gql = makeExecutor();
let app: express.Express;
const storage = new MemoryStorage();

beforeAll(async () => {
  await startTestDb();
  setMediaStorage(storage);
  ({ app } = await createApp());
});
afterAll(async () => {
  setMediaStorage(null);
  await stopTestDb();
});
beforeEach(async () => {
  storage.files.clear();
  await resetDb();
});

function upload(body: Buffer, opts: { filename?: string; folder?: string; auth?: string } = {}) {
  const req = request(app)
    .post(`/media/upload${opts.folder ? `?folder=${opts.folder}` : ""}`)
    .set("content-type", "image/png")
    .set("x-filename", encodeURIComponent(opts.filename ?? "Rudraksha Mala.png"));
  if (opts.auth !== "") req.set("authorization", opts.auth ?? asAdmin.authorization);
  return req.send(body);
}

describe("image sniffing", () => {
  it("recognises formats by their bytes and reads dimensions", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(imageDimensions(PNG, "image/png")).toEqual({ width: 3, height: 2 });
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(imageDimensions(JPEG, "image/jpeg")).toEqual({ width: 640, height: 480 });
    expect(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
  });

  it("recognises audio by its bytes", () => {
    expect(sniffAudioType(MP3)).toBe("audio/mpeg");
    expect(sniffAudioType(Buffer.concat([Buffer.from("fffb9064", "hex"), Buffer.alloc(16)]))).toBe("audio/mpeg");
    expect(sniffAudioType(Buffer.concat([Buffer.from("OggS"), Buffer.alloc(16)]))).toBe("audio/ogg");
    expect(sniffAudioType(Buffer.concat([Buffer.from("RIFF0000WAVE"), Buffer.alloc(8)]))).toBe("audio/wav");
    expect(sniffAudioType(Buffer.concat([Buffer.from("00000020", "hex"), Buffer.from("ftypM4A "), Buffer.alloc(8)]))).toBe("audio/mp4");
    // ADTS AAC (layer bits 00) and images are not audio.
    expect(sniffAudioType(Buffer.concat([Buffer.from("fff15080", "hex"), Buffer.alloc(16)]))).toBeNull();
    expect(sniffAudioType(JPEG)).toBeNull();
    expect(sniffAudioType(PNG)).toBeNull();
  });

  it("signs Cloudinary params the documented way", () => {
    // Example from Cloudinary's "Generating authentication signatures" docs.
    expect(
      cloudinarySignature({ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: "1315060510" }, "abcd"),
    ).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });
});

describe("POST /media/upload", () => {
  it("stores the file and creates a library entry", async () => {
    const res = await upload(PNG, { folder: "products" });
    expect(res.status).toBe(201);
    expect(res.body.asset).toMatchObject({
      filename: "Rudraksha Mala.png",
      folder: "products",
      contentType: "image/png",
      width: 3,
      height: 2,
    });
    expect(res.body.asset.url).toMatch(/^https:\/\/media\.test\/products\/[\w-]{10}-rudraksha-mala\.png$/);
    expect(storage.files.size).toBe(1);
    expect(await MediaAssetModel.countDocuments()).toBe(1);
  });

  it("uses the file's real type, not the declared one", async () => {
    const res = await upload(JPEG, { filename: "photo.png" });
    expect(res.status).toBe(201);
    expect(res.body.asset.contentType).toBe("image/jpeg");
    expect(res.body.asset.url).toMatch(/\.jpg$/);
  });

  it("accepts mantra audio and stores it with no pixel size", async () => {
    const res = await upload(MP3, { folder: "daily", filename: "Hanuman Mantra.mp3" });
    expect(res.status).toBe(201);
    expect(res.body.asset).toMatchObject({ contentType: "audio/mpeg", width: null, height: null, folder: "daily" });
    expect(res.body.asset.url).toMatch(/daily\/.+-hanuman-mantra\.mp3$/);
  });

  it("rejects non-images, unknown folders, and callers without media.manage", async () => {
    expect((await upload(Buffer.from("<svg onload=alert(1)>".padEnd(40)))).status).toBe(400);
    expect((await upload(PNG, { folder: "secret" })).status).toBe(400);
    expect((await upload(PNG, { auth: asViewer.authorization })).status).toBe(403);
    expect((await upload(PNG, { auth: "" })).status).toBe(401);
    expect(storage.files.size).toBe(0);
  });
});

describe("media library GraphQL", () => {
  it("lists, filters and edits assets", async () => {
    await upload(PNG, { folder: "products", filename: "tulsi.png" });
    await upload(PNG, { folder: "content", filename: "banner.png" });

    const all = await gql(`{ adminMedia { total items { filename folder } } }`, undefined, asViewer);
    expect(all.data.adminMedia.total).toBe(2);

    const filtered = await gql(`{ adminMedia(folder: products) { total items { id filename } } }`, undefined, asViewer);
    expect(filtered.data.adminMedia.items).toEqual([expect.objectContaining({ filename: "tulsi.png" })]);
    const id = filtered.data.adminMedia.items[0].id;

    const viewerEdit = await gql(
      `mutation($id: ID!) { updateMediaAsset(id: $id, input: { alt: "x" }) { id } }`,
      { id },
      asViewer,
    );
    expect(viewerEdit.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");

    const edit = await gql(
      `mutation($id: ID!) { updateMediaAsset(id: $id, input: { alt: "Tulsi mala", folder: general }) { alt folder } }`,
      { id },
      asAdmin,
    );
    expect(edit.data.updateMediaAsset).toEqual({ alt: "Tulsi mala", folder: "general" });

    const search = await gql(`{ adminMedia(search: "tulsi mala") { total } }`, undefined, asViewer);
    expect(search.data.adminMedia.total).toBe(1);
  });

  it("shows where an image is used and refuses to delete it unless forced", async () => {
    const { body } = await upload(PNG, { folder: "products" });
    const { id, url } = body.asset;
    await ProductModel.create({
      slug: "tulsi-mala",
      name: { en: "Tulsi Mala", hi: "t" },
      tagline: { en: "t", hi: "t" },
      description: { en: "d", hi: "d" },
      price: 100,
      category: "idols",
      image: "/other.jpg",
      gallery: [url],
    });

    const listed = await gql(`{ adminMedia { items { usage { kind label ref } } } }`, undefined, asAdmin);
    expect(listed.data.adminMedia.items[0].usage).toEqual([{ kind: "Product", label: "Tulsi Mala", ref: "tulsi-mala" }]);

    const blocked = await gql(`mutation($id: ID!) { deleteMediaAsset(id: $id) }`, { id }, asAdmin);
    expect(blocked.errors?.[0]?.extensions?.code).toBe("CONFLICT");
    expect(blocked.errors?.[0]?.message).toContain('Product "Tulsi Mala"');
    expect(storage.files.size).toBe(1);

    const forced = await gql(`mutation($id: ID!) { deleteMediaAsset(id: $id, force: true) }`, { id }, asAdmin);
    expect(forced.data.deleteMediaAsset).toBe(true);
    expect(storage.files.size).toBe(0);
    expect(await MediaAssetModel.countDocuments()).toBe(0);
  });
});

describe("profile photos (POST /me/avatar)", () => {
  async function makeUser() {
    const { UserModel } = await import("../src/modules/auth/auth.model.js");
    const u = await UserModel.create({ email: "seeker@test.com", name: "Asha Devi", referralCode: "ASHA01" });
    const auth = `Bearer ${signAccessToken({ sub: String(u._id), roles: ["customer"], permissions: [] })}`;
    return { id: String(u._id), auth };
  }
  const post = (body: Buffer, auth?: string) => {
    const r = request(app).post("/me/avatar").set("content-type", "image/jpeg");
    if (auth) r.set("authorization", auth);
    return r.send(body);
  };

  it("lets any signed-in customer set, replace and remove their own photo", async () => {
    const { auth } = await makeUser();

    const first = await post(JPEG, auth);
    expect(first.status).toBe(200);
    expect(first.body.avatarUrl).toMatch(/^https:\/\/media\.test\/avatars\/[a-f0-9]{24}-[\w-]{8}\.jpg$/);
    expect(storage.files.size).toBe(1);

    const me = await gql(`{ me { avatarUrl } }`, undefined, { authorization: auth });
    expect(me.data.me.avatarUrl).toBe(first.body.avatarUrl);

    // Replacing deletes the old file — one file per user, ever.
    const second = await post(PNG, auth);
    expect(second.status).toBe(200);
    expect(second.body.avatarUrl).not.toBe(first.body.avatarUrl);
    expect(storage.files.size).toBe(1);

    const removed = await gql(`mutation { removeAvatar { avatarUrl } }`, undefined, { authorization: auth });
    expect(removed.data.removeAvatar.avatarUrl).toBeNull();
    expect(storage.files.size).toBe(0);
    // Uploads never appear in the admin's media library.
    expect(await MediaAssetModel.countDocuments()).toBe(0);
  });

  it("rejects signed-out callers and non-images", async () => {
    const { auth } = await makeUser();
    expect((await post(JPEG)).status).toBe(401);
    expect((await post(Buffer.from("<svg onload=alert(1)>".padEnd(40)), auth)).status).toBe(400);
    expect(storage.files.size).toBe(0);
  });
});
