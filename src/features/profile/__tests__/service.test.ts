import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deleteOwnAccount,
  getAvatarUrls,
  getMyProfile,
  getProfileErrorMessageJa,
  isHabitasInUse,
  removeMyAvatar,
  removeOwnAvatarFiles,
  updateDisplayName,
  updateWeekStartsOn,
  uploadMyAvatar,
} from "../service";

describe("getMyProfile", () => {
  it("returns the caller's profile", async () => {
    const eq = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: { id: "user-1", display_name: "たろう", avatar_path: null, week_starts_on: 0 },
      error: null,
    });
    const client = {
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), eq, single }),
    } as unknown as SupabaseClient;

    const result = await getMyProfile(client, "user-1");

    expect(result).toEqual({
      ok: true,
      value: { id: "user-1", displayName: "たろう", avatarPath: null, weekStartsOn: 0 },
    });
    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("maps a missing row to NotFound", async () => {
    const client = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
      }),
    } as unknown as SupabaseClient;

    const result = await getMyProfile(client, "user-1");

    expect(result).toEqual({ ok: false, error: { type: "NotFound" } });
  });
});

describe("updateDisplayName", () => {
  it("updates and returns the caller's profile with the new display name", async () => {
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: { id: "user-1", display_name: "新しい名前", avatar_path: null, week_starts_on: 0 },
      error: null,
    });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateDisplayName(client, "user-1", "新しい名前");

    expect(result).toEqual({
      ok: true,
      value: { id: "user-1", displayName: "新しい名前", avatarPath: null, weekStartsOn: 0 },
    });
    expect(update).toHaveBeenCalledWith({ display_name: "新しい名前" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("trims the given display name before saving", async () => {
    const update = jest.fn().mockReturnThis();
    const client = {
      from: jest.fn().mockReturnValue({
        update,
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: "user-1", display_name: "たろう", avatar_path: null },
          error: null,
        }),
      }),
    } as unknown as SupabaseClient;

    await updateDisplayName(client, "user-1", "  たろう  ");

    expect(update).toHaveBeenCalledWith({ display_name: "たろう" });
  });

  it("returns a ValidationError without calling the database when the name is blank", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await updateDisplayName(client, "user-1", "   ");

    expect(result).toEqual({ ok: false, error: { type: "ValidationError", field: "displayName" } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a permission error to Forbidden", async () => {
    const client = {
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: "42501" } }),
      }),
    } as unknown as SupabaseClient;

    const result = await updateDisplayName(client, "user-1", "たろう");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("updateWeekStartsOn", () => {
  it("updates and returns the caller's profile with the new week-start day", async () => {
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: { id: "user-1", display_name: "たろう", avatar_path: null, week_starts_on: 1 },
      error: null,
    });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateWeekStartsOn(client, "user-1", 1);

    expect(result).toEqual({
      ok: true,
      value: { id: "user-1", displayName: "たろう", avatarPath: null, weekStartsOn: 1 },
    });
    expect(update).toHaveBeenCalledWith({ week_starts_on: 1 });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("maps a permission error to Forbidden", async () => {
    const client = {
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: "42501" } }),
      }),
    } as unknown as SupabaseClient;

    const result = await updateWeekStartsOn(client, "user-1", 1);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("deleteOwnAccount", () => {
  it("calls the delete_own_account RPC and returns ok on success", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await deleteOwnAccount(client);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(rpc).toHaveBeenCalledWith("delete_own_account");
  });

  it("maps an RPC failure to DeleteFailed", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
    } as unknown as SupabaseClient;

    const result = await deleteOwnAccount(client);

    expect(result).toEqual({ ok: false, error: { type: "DeleteFailed" } });
  });
});

describe("isHabitasInUse", () => {
  it("returns true when the account also uses Habitas", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: ["memory_calendar", "habitas"], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    expect(await isHabitasInUse(client)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("get_account_usage");
  });

  it("returns false when only Memory Calendar is used", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: ["memory_calendar"], error: null }),
    } as unknown as SupabaseClient;

    expect(await isHabitasInUse(client)).toBe(false);
  });

  it("returns null when the usage cannot be fetched (RPC error, bad data, or network failure)", async () => {
    const error = { rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) };
    const bad = { rpc: jest.fn().mockResolvedValue({ data: "nope", error: null }) };
    const offline = { rpc: jest.fn().mockRejectedValue(new Error("offline")) };

    expect(await isHabitasInUse(error as unknown as SupabaseClient)).toBeNull();
    expect(await isHabitasInUse(bad as unknown as SupabaseClient)).toBeNull();
    expect(await isHabitasInUse(offline as unknown as SupabaseClient)).toBeNull();
  });
});

describe("getProfileErrorMessageJa", () => {
  it("returns a Japanese message for each known error type", () => {
    expect(getProfileErrorMessageJa({ type: "NotFound" })).toContain("見つかりません");
    expect(getProfileErrorMessageJa({ type: "Forbidden" })).toContain("権限");
    expect(getProfileErrorMessageJa({ type: "ValidationError", field: "displayName" })).toContain(
      "ユーザー名"
    );
    expect(getProfileErrorMessageJa({ type: "DeleteFailed" })).toContain("削除");
  });
});

describe("uploadMyAvatar", () => {
  const PHOTO = { fileName: "me.jpg", contentType: "image/jpeg", data: "binary" as unknown as Blob };

  function makeClient(overrides: { uploadError?: unknown; updateError?: unknown } = {}) {
    const upload = jest.fn().mockResolvedValue({ error: overrides.uploadError ?? null });
    const remove = jest.fn().mockResolvedValue({ error: null });
    const single = jest.fn().mockResolvedValue({
      data: overrides.updateError
        ? null
        : { id: "user-1", display_name: "たろう", avatar_path: "user-1/123.jpg", week_starts_on: 0 },
      error: overrides.updateError ?? null,
    });
    const update = jest.fn().mockReturnThis();
    const client = {
      storage: { from: jest.fn().mockReturnValue({ upload, remove }) },
      from: jest.fn().mockReturnValue({ update, eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single }),
    } as unknown as SupabaseClient;
    return { client, upload, remove, update };
  }

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(123);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uploads under the user's own folder, saves the path on the profile and returns it", async () => {
    const { client, upload, update } = makeClient();

    const result = await uploadMyAvatar(client, "user-1", PHOTO, null);

    expect(client.storage.from).toHaveBeenCalledWith("avatars");
    expect(upload).toHaveBeenCalledWith("user-1/123.jpg", PHOTO.data, { contentType: "image/jpeg" });
    expect(update).toHaveBeenCalledWith({ avatar_path: "user-1/123.jpg" });
    expect(result).toEqual({
      ok: true,
      value: { id: "user-1", displayName: "たろう", avatarPath: "user-1/123.jpg", weekStartsOn: 0 },
    });
  });

  it("removes the previous image after the new one is saved", async () => {
    const { client, remove } = makeClient();

    await uploadMyAvatar(client, "user-1", PHOTO, "user-1/old.jpg");

    expect(remove).toHaveBeenCalledWith(["user-1/old.jpg"]);
  });

  it("keeps the previous image when the upload fails", async () => {
    const { client, remove, update } = makeClient({ uploadError: { message: "boom" } });

    const result = await uploadMyAvatar(client, "user-1", PHOTO, "user-1/old.jpg");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes the just-uploaded file when saving the path fails", async () => {
    const { client, remove } = makeClient({ updateError: { code: "42501" } });

    const result = await uploadMyAvatar(client, "user-1", PHOTO, "user-1/old.jpg");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
    expect(remove).toHaveBeenCalledWith(["user-1/123.jpg"]);
    expect(remove).not.toHaveBeenCalledWith(["user-1/old.jpg"]);
  });
});

describe("removeMyAvatar", () => {
  it("clears the saved path and deletes the stored file", async () => {
    const remove = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: { id: "user-1", display_name: "たろう", avatar_path: null, week_starts_on: 0 },
      error: null,
    });
    const client = {
      storage: { from: jest.fn().mockReturnValue({ remove }) },
      from: jest.fn().mockReturnValue({ update, eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single }),
    } as unknown as SupabaseClient;

    const result = await removeMyAvatar(client, "user-1", "user-1/old.jpg");

    expect(update).toHaveBeenCalledWith({ avatar_path: null });
    expect(remove).toHaveBeenCalledWith(["user-1/old.jpg"]);
    expect(result).toEqual({
      ok: true,
      value: { id: "user-1", displayName: "たろう", avatarPath: null, weekStartsOn: 0 },
    });
  });
});

describe("getAvatarUrls", () => {
  it("returns a map from storage path to signed url", async () => {
    const createSignedUrls = jest.fn().mockResolvedValue({
      data: [
        { path: "user-1/a.jpg", signedUrl: "https://signed/a", error: null },
        { path: "user-2/b.jpg", signedUrl: "https://signed/b", error: null },
      ],
      error: null,
    });
    const client = { storage: { from: jest.fn().mockReturnValue({ createSignedUrls }) } } as unknown as SupabaseClient;

    const result = await getAvatarUrls(client, ["user-1/a.jpg", "user-2/b.jpg"]);

    expect(client.storage.from).toHaveBeenCalledWith("avatars");
    expect(createSignedUrls).toHaveBeenCalledWith(["user-1/a.jpg", "user-2/b.jpg"], 3600);
    expect(result).toEqual({
      ok: true,
      value: { "user-1/a.jpg": "https://signed/a", "user-2/b.jpg": "https://signed/b" },
    });
  });

  it("skips entries that could not be signed", async () => {
    const createSignedUrls = jest.fn().mockResolvedValue({
      data: [
        { path: "user-1/a.jpg", signedUrl: "https://signed/a", error: null },
        { path: "user-2/gone.jpg", signedUrl: null, error: "Object not found" },
      ],
      error: null,
    });
    const client = { storage: { from: jest.fn().mockReturnValue({ createSignedUrls }) } } as unknown as SupabaseClient;

    const result = await getAvatarUrls(client, ["user-1/a.jpg", "user-2/gone.jpg"]);

    expect(result).toEqual({ ok: true, value: { "user-1/a.jpg": "https://signed/a" } });
  });

  it("does not call storage when there are no paths", async () => {
    const client = { storage: { from: jest.fn() } } as unknown as SupabaseClient;

    const result = await getAvatarUrls(client, []);

    expect(result).toEqual({ ok: true, value: {} });
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it("maps a storage error to Forbidden", async () => {
    const createSignedUrls = jest.fn().mockResolvedValue({ data: null, error: { message: "denied" } });
    const client = { storage: { from: jest.fn().mockReturnValue({ createSignedUrls }) } } as unknown as SupabaseClient;

    const result = await getAvatarUrls(client, ["user-1/a.jpg"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("removeOwnAvatarFiles", () => {
  function makeClient(options: { user?: { id: string } | null; files?: { name: string }[]; listError?: unknown; throwOnList?: boolean }) {
    const list = options.throwOnList
      ? jest.fn().mockRejectedValue(new Error("network"))
      : jest.fn().mockResolvedValue({ data: options.files ?? [], error: options.listError ?? null });
    const remove = jest.fn().mockResolvedValue({ error: null });
    const client = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: options.user === undefined ? { id: "user-1" } : options.user }, error: null }) },
      storage: { from: jest.fn().mockReturnValue({ list, remove }) },
    } as unknown as SupabaseClient;
    return { client, list, remove };
  }

  it("deletes every file in the caller's own avatar folder", async () => {
    const { client, list, remove } = makeClient({ files: [{ name: "1.jpg" }, { name: "2.jpg" }] });

    await removeOwnAvatarFiles(client);

    expect(client.storage.from).toHaveBeenCalledWith("avatars");
    expect(list).toHaveBeenCalledWith("user-1");
    expect(remove).toHaveBeenCalledWith(["user-1/1.jpg", "user-1/2.jpg"]);
  });

  it("does nothing when the folder is empty", async () => {
    const { client, remove } = makeClient({ files: [] });

    await removeOwnAvatarFiles(client);

    expect(remove).not.toHaveBeenCalled();
  });

  it("does nothing when nobody is signed in", async () => {
    const { client, list } = makeClient({ user: null });

    await removeOwnAvatarFiles(client);

    expect(list).not.toHaveBeenCalled();
  });

  it("never throws, so a storage problem cannot block deleting the account", async () => {
    const { client } = makeClient({ throwOnList: true });

    await expect(removeOwnAvatarFiles(client)).resolves.toBeUndefined();
  });
});
