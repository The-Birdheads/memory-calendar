import { renderHook } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { useModalTopInset } from "../useModalTopInset";

describe("useModalTopInset", () => {
  it("returns the top safe-area inset plus a small margin, so a sheet clears the status bar", async () => {
    const { result } = await renderHook(() => useModalTopInset(), {
      wrapper: ({ children }) => (
        <SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 34, left: 0, right: 0 }}>
          {children}
        </SafeAreaInsetsContext.Provider>
      ),
    });

    expect(result.current).toBe(67);
  });

  it("falls back to just the margin when there is no safe-area provider", async () => {
    const { result } = await renderHook(() => useModalTopInset());

    expect(result.current).toBe(8);
  });
});
