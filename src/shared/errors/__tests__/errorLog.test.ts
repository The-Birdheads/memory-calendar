import { getSupabaseClient } from "../../api/supabaseClient";
import { logClientError } from "../errorLog";

jest.mock("../../api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.2.3" } },
}));

function mockClient() {
  const insert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn().mockReturnValue({ insert });
  (getSupabaseClient as jest.Mock).mockReturnValue({ from });
  return { from, insert };
}

describe("logClientError", () => {
  afterEach(() => jest.clearAllMocks());

  it("writes message, stack, context, platform and app version to client_error_log", async () => {
    const { from, insert } = mockClient();
    const error = new Error("kaboom");

    await logClientError(error, "calendar");

    expect(from).toHaveBeenCalledWith("client_error_log");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "kaboom",
        stack: expect.stringContaining("kaboom"),
        context: "calendar",
        platform: expect.any(String),
        app_version: "1.2.3",
      })
    );
  });

  it("coerces a non-Error value into a message", async () => {
    const { insert } = mockClient();

    await logClientError("just a string");

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ message: "just a string", context: null })
    );
  });

  it("truncates very long messages and stacks", async () => {
    const { insert } = mockClient();
    const huge = new Error("x".repeat(5000));
    huge.stack = "y".repeat(20000);

    await logClientError(huge);

    const arg = insert.mock.calls[0][0];
    expect(arg.message.length).toBe(2000);
    expect(arg.stack.length).toBe(8000);
  });

  it("never throws, even if the insert fails", async () => {
    const insert = jest.fn().mockRejectedValue(new Error("network down"));
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: jest.fn().mockReturnValue({ insert }) });

    await expect(logClientError(new Error("boom"))).resolves.toBeUndefined();
  });

  it("never throws, even if getting the client throws", async () => {
    (getSupabaseClient as jest.Mock).mockImplementation(() => {
      throw new Error("no config");
    });

    await expect(logClientError(new Error("boom"))).resolves.toBeUndefined();
  });
});
