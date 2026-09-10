import { render } from "@testing-library/react-native";

import { PersonalOnlyBadge } from "../PersonalOnlyBadge";

describe("PersonalOnlyBadge", () => {
  it("shows a lock icon and the '個人用' label", async () => {
    const { getByText, getByTestId } = await render(<PersonalOnlyBadge />);

    expect(getByText("個人用")).toBeTruthy();
    expect(getByTestId("personal-only-badge-lock-icon")).toBeTruthy();
  });
});
