import type { SupabaseClient } from "@supabase/supabase-js";

import { deleteOwnAccount, getMyProfile, getProfileErrorMessageJa, updateDisplayName } from "../service";

describe("getMyProfile", () => {
  it("returns the caller's profile", async () => {
    const eq = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: { id: "user-1", display_name: "たろう", avatar_url: null },
      error: null,
    });
    const client = {
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), eq, single }),
    } as unknown as SupabaseClient;

    const result = await getMyProfile(client, "user-1");

    expect(result).toEqual({
      ok: true,
      value: { id: "user-1", displayName: "たろう", avatarUrl: null },
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
      data: { id: "user-1", display_name: "新しい名前", avatar_url: null },
      error: null,
    });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateDisplayName(client, "user-1", "新しい名前");

    expect(result).toEqual({
      ok: true,
      value: { id: "user-1", displayName: "新しい名前", avatarUrl: null },
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
          data: { id: "user-1", display_name: "たろう", avatar_url: null },
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
