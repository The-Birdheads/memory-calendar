import { fireEvent, render } from "@testing-library/react-native";

import { EventReactionsBar } from "../EventReactionsBar";

const REACTIONS = [
  { id: "reaction-1", eventId: "event-1", userId: "user-1", stampType: "👍", createdAt: "2026-08-18T00:00:00.000Z" },
  { id: "reaction-2", eventId: "event-1", userId: "user-2", stampType: "❤️", createdAt: "2026-08-18T02:00:00.000Z" },
];

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
}

describe("EventReactionsBar", () => {
  it("shows a count for each distinct stamp type", async () => {
    const { getByTestId } = await render(
      <EventReactionsBar reactions={REACTIONS} onToggleReaction={jest.fn()} />
    );

    expect(getByTestId("event-reaction-summary-👍").props.children).toContain(1);
    expect(getByTestId("event-reaction-summary-❤️").props.children).toContain(1);
  });

  it("calls onToggleReaction with the pressed stamp type", async () => {
    const onToggleReaction = jest.fn();
    const { getByTestId } = await render(
      <EventReactionsBar reactions={[]} onToggleReaction={onToggleReaction} />
    );

    await fireEvent.press(getByTestId("event-reaction-add-👍"));

    expect(onToggleReaction).toHaveBeenCalledWith("👍");
  });

  it("immediately reflects a newly added reaction when the reactions prop updates", async () => {
    const { getByTestId, queryByTestId, rerender } = await render(
      <EventReactionsBar reactions={[]} onToggleReaction={jest.fn()} />
    );

    expect(queryByTestId("event-reaction-summary-😮")).toBeNull();

    await rerender(
      <EventReactionsBar
        reactions={[{ id: "reaction-4", eventId: "event-1", userId: "user-1", stampType: "😮", createdAt: "2026-08-18T03:00:00.000Z" }]}
        onToggleReaction={jest.fn()}
      />
    );

    expect(getByTestId("event-reaction-summary-😮")).toBeTruthy();
  });

  it("highlights the stamp matching the current user's own reaction", async () => {
    const { getByTestId } = await render(
      <EventReactionsBar reactions={REACTIONS} currentUserId="user-1" onToggleReaction={jest.fn()} />
    );

    const mine = flattenStyle(getByTestId("event-reaction-add-👍").props.style);
    expect(mine.borderColor).toBe("#2f6fed");

    const notMine = flattenStyle(getByTestId("event-reaction-add-❤️").props.style);
    expect(notMine.borderColor).toBe("transparent");
  });

  it("highlights nothing when the current user has no reaction", async () => {
    const { getByTestId } = await render(
      <EventReactionsBar reactions={REACTIONS} currentUserId="user-3" onToggleReaction={jest.fn()} />
    );

    for (const stampType of ["👍", "❤️", "😂", "😮", "😢"]) {
      const style = flattenStyle(getByTestId(`event-reaction-add-${stampType}`).props.style);
      expect(style.borderColor).toBe("transparent");
    }
  });
});
