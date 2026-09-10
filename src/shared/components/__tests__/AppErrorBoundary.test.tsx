import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { AppErrorBoundary } from "../AppErrorBoundary";
import { logClientError } from "../../errors/errorLog";

jest.mock("../../errors/errorLog", () => ({
  logClientError: jest.fn().mockResolvedValue(undefined),
}));

describe("AppErrorBoundary", () => {
  afterEach(() => jest.clearAllMocks());

  it("shows a Japanese fallback with a retry button instead of crashing", async () => {
    const { getByTestId, getByText } = await render(
      <AppErrorBoundary error={new Error("boom")} retry={jest.fn().mockResolvedValue(undefined)} />
    );

    expect(getByTestId("app-error-boundary")).toBeTruthy();
    expect(getByText("問題が発生しました")).toBeTruthy();
    expect(getByTestId("app-error-boundary-retry")).toBeTruthy();
  });

  it("logs the error once on mount", async () => {
    const error = new Error("boom");
    await render(<AppErrorBoundary error={error} retry={jest.fn().mockResolvedValue(undefined)} />);

    await waitFor(() => expect(logClientError).toHaveBeenCalledWith(error, "render"));
    expect(logClientError).toHaveBeenCalledTimes(1);
  });

  it("calls retry when the retry button is pressed", async () => {
    const retry = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = await render(<AppErrorBoundary error={new Error("boom")} retry={retry} />);

    await fireEvent.press(getByTestId("app-error-boundary-retry"));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows the error detail only in dev builds", async () => {
    const { queryByTestId } = await render(
      <AppErrorBoundary error={new Error("secret detail")} retry={jest.fn().mockResolvedValue(undefined)} />
    );

    // __DEV__ is true under Jest, so the detail is shown here
    expect(queryByTestId("app-error-boundary-detail")).toBeTruthy();
  });
});
