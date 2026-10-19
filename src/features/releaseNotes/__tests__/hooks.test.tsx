import { act, renderHook, waitFor } from "@testing-library/react-native";

import { hasCompletedOnboarding } from "../../onboarding/onboardingStorage";
import { EXISTING_ACCOUNT_CUTOFF, RELEASE_NOTES_OPEN_DELAY_MS, useReleaseNotes } from "../hooks";
import { LATEST_RELEASE_VERSION } from "../releases";
import { getLastSeenReleaseVersion, markReleaseNotesSeen } from "../releaseNotesStorage";

jest.mock("../../onboarding/onboardingStorage", () => ({
  hasCompletedOnboarding: jest.fn(),
}));
jest.mock("../releaseNotesStorage", () => ({
  getLastSeenReleaseVersion: jest.fn(),
  markReleaseNotesSeen: jest.fn(),
}));

const OLD_ACCOUNT = "2026-08-01T00:00:00Z";
const NEW_ACCOUNT = "2026-11-01T00:00:00Z";

beforeEach(() => {
  jest.useFakeTimers();
  (markReleaseNotesSeen as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

async function settle() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(RELEASE_NOTES_OPEN_DELAY_MS + 50);
  });
}

describe("useReleaseNotes", () => {
  it("shows the latest notes to someone who finished the tutorial and has not seen them", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(true);
    (getLastSeenReleaseVersion as jest.Mock).mockResolvedValue(null);

    const { result } = await renderHook(() =>
      useReleaseNotes({ userId: "user-1", accountCreatedAt: NEW_ACCOUNT, isBlocked: false })
    );
    await settle();

    expect(result.current.isVisible).toBe(true);
  });

  it("shows the notes to an account that predates the release even before the tutorial is finished (update from the old version)", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(false);
    (getLastSeenReleaseVersion as jest.Mock).mockResolvedValue(null);

    const { result } = await renderHook(() =>
      useReleaseNotes({ userId: "user-1", accountCreatedAt: OLD_ACCOUNT, isBlocked: false })
    );
    await settle();

    expect(result.current.isVisible).toBe(true);
    expect(new Date(OLD_ACCOUNT).getTime()).toBeLessThan(new Date(EXISTING_ACCOUNT_CUTOFF).getTime());
  });

  it("does not show anything to a brand-new user, and marks the latest as seen so it never appears later", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(false);
    (getLastSeenReleaseVersion as jest.Mock).mockResolvedValue(null);

    const { result } = await renderHook(() =>
      useReleaseNotes({ userId: "user-1", accountCreatedAt: NEW_ACCOUNT, isBlocked: false })
    );
    await settle();

    expect(result.current.isVisible).toBe(false);
    expect(markReleaseNotesSeen).toHaveBeenCalledWith("user-1", LATEST_RELEASE_VERSION);
  });

  it("does not show notes the user has already seen", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(true);
    (getLastSeenReleaseVersion as jest.Mock).mockResolvedValue(LATEST_RELEASE_VERSION);

    const { result } = await renderHook(() =>
      useReleaseNotes({ userId: "user-1", accountCreatedAt: OLD_ACCOUNT, isBlocked: false })
    );
    await settle();

    expect(result.current.isVisible).toBe(false);
  });

  it("does not show anything when the stored record cannot be read", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(true);
    (getLastSeenReleaseVersion as jest.Mock).mockResolvedValue("unknown");

    const { result } = await renderHook(() =>
      useReleaseNotes({ userId: "user-1", accountCreatedAt: OLD_ACCOUNT, isBlocked: false })
    );
    await settle();

    expect(result.current.isVisible).toBe(false);
  });

  it("waits while another modal (the tutorial) is open, then shows after it closes", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(false);
    (getLastSeenReleaseVersion as jest.Mock).mockResolvedValue(null);

    const { result, rerender } = await renderHook(
      (props: { isBlocked: boolean }) =>
        useReleaseNotes({ userId: "user-1", accountCreatedAt: OLD_ACCOUNT, isBlocked: props.isBlocked }),
      { initialProps: { isBlocked: true } }
    );
    await settle();
    expect(result.current.isVisible).toBe(false);

    await rerender({ isBlocked: false });
    expect(result.current.isVisible).toBe(false); // 閉じる動きの最中は、まだ出さない
    await settle();
    expect(result.current.isVisible).toBe(true);
  });

  it("records the latest version and hides when closed", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(true);
    (getLastSeenReleaseVersion as jest.Mock).mockResolvedValue(null);

    const { result } = await renderHook(() =>
      useReleaseNotes({ userId: "user-1", accountCreatedAt: NEW_ACCOUNT, isBlocked: false })
    );
    await settle();
    expect(result.current.isVisible).toBe(true);

    await act(async () => result.current.close());

    expect(result.current.isVisible).toBe(false);
    expect(markReleaseNotesSeen).toHaveBeenCalledWith("user-1", LATEST_RELEASE_VERSION);
  });

  it("can be shown again on request (from the settings), even after it was seen", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(true);
    (getLastSeenReleaseVersion as jest.Mock).mockResolvedValue(LATEST_RELEASE_VERSION);

    const { result } = await renderHook(() =>
      useReleaseNotes({ userId: "user-1", accountCreatedAt: NEW_ACCOUNT, isBlocked: false })
    );
    await settle();
    expect(result.current.isVisible).toBe(false);

    await act(async () => result.current.show());
    expect(result.current.isVisible).toBe(true);

    await act(async () => result.current.close());
    expect(result.current.isVisible).toBe(false);
  });

  it("shows nothing before the user is known", async () => {
    const { result } = await renderHook(() =>
      useReleaseNotes({ userId: undefined, accountCreatedAt: undefined, isBlocked: false })
    );
    await settle();

    expect(result.current.isVisible).toBe(false);
    await waitFor(() => expect(hasCompletedOnboarding).not.toHaveBeenCalled());
  });
});
