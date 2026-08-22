import { fireEvent, render } from "@testing-library/react-native";

import { EventReactionsBar } from "../EventReactionsBar";

const REACTIONS = [
  { id: "reaction-1", eventId: "event-1", userId: "user-1", stampType: "👍", createdAt: "2026-08-18T00:00:00.000Z" },
  { id: "reaction-2", eventId: "event-1", userId: "user-2", stampType: "👍", createdAt: "2026-08-18T01:00:00.000Z" },
  { id: "reaction-3", eventId: "event-1", userId: "user-2", stampType: "❤️", createdAt: "2026-08-18T02:00:00.000Z" },
];

describe("EventReactionsBar", () => {
  it("shows a count for each distinct stamp type", async () => {
    const { getByTestId } = await render(
      <EventReactionsBar reactions={REACTIONS} onAddReaction={jest.fn()} />
    );

    expect(getByTestId("event-reaction-summary-👍").props.children).toContain(2);
    expect(getByTestId("event-reaction-summary-❤️").props.children).toContain(1);
  });

  it("calls onAddReaction with the pressed stamp type", async () => {
    const onAddReaction = jest.fn();
    const { getByTestId } = await render(
      <EventReactionsBar reactions={[]} onAddReaction={onAddReaction} />
    );

    await fireEvent.press(getByTestId("event-reaction-add-👍"));

    expect(onAddReaction).toHaveBeenCalledWith("👍");
  });

  it("immediately reflects a newly added reaction when the reactions prop updates", async () => {
    const { getByTestId, queryByTestId, rerender } = await render(
      <EventReactionsBar reactions={[]} onAddReaction={jest.fn()} />
    );

    expect(queryByTestId("event-reaction-summary-😮")).toBeNull();

    await rerender(
      <EventReactionsBar
        reactions={[{ id: "reaction-4", eventId: "event-1", userId: "user-1", stampType: "😮", createdAt: "2026-08-18T03:00:00.000Z" }]}
        onAddReaction={jest.fn()}
      />
    );

    expect(getByTestId("event-reaction-summary-😮")).toBeTruthy();
  });
});
