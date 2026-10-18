import { act, renderHook, waitFor } from "@testing-library/react-native";

import { hasCompletedOnboarding, markOnboardingCompleted } from "../onboardingStorage";
import { useOnboarding } from "../hooks";

jest.mock("../onboardingStorage", () => ({
  hasCompletedOnboarding: jest.fn(),
  markOnboardingCompleted: jest.fn(),
}));

afterEach(() => jest.clearAllMocks());

describe("useOnboarding", () => {
  it("shows the tutorial once the user is known and has not completed it", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(false);

    const { result } = await renderHook(() => useOnboarding("user-1"));

    await waitFor(() => expect(result.current.isVisible).toBe(true));
    expect(hasCompletedOnboarding).toHaveBeenCalledWith("user-1");
  });

  it("stays hidden for a user who already completed it", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(true);

    const { result } = await renderHook(() => useOnboarding("user-1"));

    await waitFor(() => expect(hasCompletedOnboarding).toHaveBeenCalled());
    expect(result.current.isVisible).toBe(false);
  });

  it("stays hidden, and does not read storage, while the user is not known yet", async () => {
    const { result } = await renderHook(() => useOnboarding(undefined));

    expect(result.current.isVisible).toBe(false);
    expect(hasCompletedOnboarding).not.toHaveBeenCalled();
  });

  it("hides and remembers the completion when completed", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(false);
    const { result } = await renderHook(() => useOnboarding("user-1"));
    await waitFor(() => expect(result.current.isVisible).toBe(true));

    await act(async () => {
      result.current.complete();
    });

    expect(result.current.isVisible).toBe(false);
    expect(markOnboardingCompleted).toHaveBeenCalledWith("user-1");
  });

  it("can be shown again on demand (e.g. from the settings) even after it was completed", async () => {
    (hasCompletedOnboarding as jest.Mock).mockResolvedValue(true);
    const { result } = await renderHook(() => useOnboarding("user-1"));
    await waitFor(() => expect(hasCompletedOnboarding).toHaveBeenCalled());

    await act(async () => {
      result.current.show();
    });

    expect(result.current.isVisible).toBe(true);

    await act(async () => {
      result.current.complete();
    });

    expect(result.current.isVisible).toBe(false);
  });

  it("does not show the tutorial again to another user logging in on the same hook instance after completion", async () => {
    (hasCompletedOnboarding as jest.Mock).mockImplementation(async (id: string) => id === "user-1");

    const { result, rerender } = await renderHook(({ id }: { id: string }) => useOnboarding(id), {
      initialProps: { id: "user-1" },
    });
    await waitFor(() => expect(hasCompletedOnboarding).toHaveBeenCalledWith("user-1"));
    expect(result.current.isVisible).toBe(false);

    await rerender({ id: "user-2" });

    await waitFor(() => expect(result.current.isVisible).toBe(true));
  });
});
