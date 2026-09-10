import { logClientError } from "../errorLog";
import { installGlobalErrorHandler } from "../globalHandler";

jest.mock("../errorLog", () => ({
  logClientError: jest.fn().mockResolvedValue(undefined),
}));

describe("installGlobalErrorHandler", () => {
  const realErrorUtils = (globalThis as { ErrorUtils?: unknown }).ErrorUtils;

  afterEach(() => {
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = realErrorUtils;
    jest.clearAllMocks();
  });

  it("does nothing when ErrorUtils is unavailable", () => {
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = undefined;
    expect(() => installGlobalErrorHandler()).not.toThrow();
  });

  it("wraps the existing handler: logs the error (labelled by fatality) then delegates", () => {
    const previous = jest.fn();
    let current: (error: unknown, isFatal?: boolean) => void = previous;
    (globalThis as Record<string, unknown>).ErrorUtils = {
      getGlobalHandler: () => current,
      setGlobalHandler: (h: typeof current) => {
        current = h;
      },
    };

    installGlobalErrorHandler();
    // the module-level guard means it only installs once; that's fine - the
    // wrapper is now in place and we exercise it directly.
    expect(current).not.toBe(previous);

    const fatal = new Error("uncaught fatal");
    current(fatal, true);
    expect(logClientError).toHaveBeenCalledWith(fatal, "global:fatal");
    expect(previous).toHaveBeenCalledWith(fatal, true);

    const nonFatal = new Error("uncaught");
    current(nonFatal, false);
    expect(logClientError).toHaveBeenCalledWith(nonFatal, "global");
    expect(previous).toHaveBeenCalledWith(nonFatal, false);
  });
});
