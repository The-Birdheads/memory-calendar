import { fireEvent, render, waitFor } from "@testing-library/react-native";

import HistoryScreen from "../history";
import { useMyCalendars } from "../../../src/features/calendars/hooks";
import { usePastEventsByTag } from "../../../src/features/history/hooks";
import { useTagTree } from "../../../src/features/tags/hooks";

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
}));

jest.mock("../../../src/features/tags/hooks", () => ({
  useTagTree: jest.fn(),
}));

jest.mock("../../../src/features/history/hooks", () => ({
  usePastEventsByTag: jest.fn(),
}));

const CALENDARS = [{ id: "cal-1", name: "我が家", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" }];

const TAG_TREE = [
  {
    id: "tag-1",
    calendarId: "cal-1",
    parentId: null,
    level: "major" as const,
    name: "行事",
    color: "#ff0000",
    createdAt: "2026-08-18T00:00:00.000Z",
    children: [
      {
        id: "tag-2",
        calendarId: "cal-1",
        parentId: "tag-1",
        level: "mid" as const,
        name: "誕生日",
        color: "#00ff00",
        createdAt: "2026-08-18T00:01:00.000Z",
        children: [],
      },
    ],
  },
];

const PAST_EVENTS = [
  { id: "event-1", calendarId: "cal-1", title: "先週の集まり", startAt: "2026-08-10T10:00:00.000Z" },
];

describe("HistoryScreen", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows past events for the active calendar in date order", async () => {
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null });
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: TAG_TREE, isLoading: false, error: null });
    (usePastEventsByTag as jest.Mock).mockReturnValue({ events: PAST_EVENTS, isLoading: false, error: null });

    const { getByText } = await render(<HistoryScreen />);

    expect(getByText("先週の集まり")).toBeTruthy();
  });

  it("shows only top-level tag filters at first, revealing children once their parent is selected", async () => {
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null });
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: TAG_TREE, isLoading: false, error: null });
    (usePastEventsByTag as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByTestId, queryByTestId } = await render(<HistoryScreen />);

    expect(getByTestId("history-tag-filter-all")).toBeTruthy();
    expect(getByTestId("history-tag-filter-tag-1")).toBeTruthy();
    expect(queryByTestId("history-tag-filter-tag-2")).toBeNull();

    await fireEvent.press(getByTestId("history-tag-filter-tag-1"));

    expect(getByTestId("history-tag-filter-tag-2")).toBeTruthy();
  });

  it("requests past events filtered by the selected tag when a filter is pressed", async () => {
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null });
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: TAG_TREE, isLoading: false, error: null });
    (usePastEventsByTag as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByTestId } = await render(<HistoryScreen />);

    await fireEvent.press(getByTestId("history-tag-filter-tag-1"));
    await fireEvent.press(getByTestId("history-tag-filter-tag-2"));

    await waitFor(() => expect(usePastEventsByTag).toHaveBeenLastCalledWith("cal-1", "tag-2"));
  });

  it("shows an empty state message when no events match", async () => {
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null });
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: TAG_TREE, isLoading: false, error: null });
    (usePastEventsByTag as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByText } = await render(<HistoryScreen />);

    expect(getByText("該当する予定がありません")).toBeTruthy();
  });
});
