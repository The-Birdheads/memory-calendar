import { createClient } from "@supabase/supabase-js";

import { createSupabaseClient, MissingSupabaseConfigError } from "../supabaseClient";

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ mocked: true })),
}));

describe("createSupabaseClient", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("throws MissingSupabaseConfigError when the URL is missing", () => {
    expect(() => createSupabaseClient({ anonKey: "anon-key" })).toThrow(
      MissingSupabaseConfigError
    );
  });

  it("throws MissingSupabaseConfigError when the anon key is missing", () => {
    expect(() =>
      createSupabaseClient({ url: "https://example.supabase.co" })
    ).toThrow(MissingSupabaseConfigError);
  });

  it("creates a Supabase client with the provided URL and anon key", () => {
    createSupabaseClient({ url: "https://example.supabase.co", anonKey: "anon-key" });

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({ auth: expect.any(Object) })
    );
  });
});
