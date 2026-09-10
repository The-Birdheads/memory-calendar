import { render } from "@testing-library/react-native";

import { CalendarLabel } from "../CalendarLabel";
import type { Calendar } from "../../types";

const PERSONAL: Calendar = {
  id: "cal-1",
  name: "Myカレンダー",
  kind: "personal",
  color: "#2f6fed",
  createdBy: "user-1",
  createdAt: "2026-08-17T00:00:00.000Z",
};

const GROUP: Calendar = {
  id: "cal-2",
  name: "我が家",
  kind: "group",
  color: "#2f6fed",
  createdBy: "user-1",
  createdAt: "2026-08-17T00:00:00.000Z",
};

describe("CalendarLabel", () => {
  it("shows a lock icon alongside the name for a personal calendar", async () => {
    const { getByText, getByTestId } = await render(<CalendarLabel calendar={PERSONAL} />);

    expect(getByText("Myカレンダー")).toBeTruthy();
    expect(getByTestId("calendar-lock-icon-cal-1")).toBeTruthy();
  });

  it("shows no lock icon for a group calendar", async () => {
    const { getByText, queryByTestId } = await render(<CalendarLabel calendar={GROUP} />);

    expect(getByText("我が家")).toBeTruthy();
    expect(queryByTestId("calendar-lock-icon-cal-2")).toBeNull();
  });
});
