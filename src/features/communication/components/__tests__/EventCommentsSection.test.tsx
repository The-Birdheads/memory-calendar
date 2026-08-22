import { fireEvent, render } from "@testing-library/react-native";

import { EventCommentsSection } from "../EventCommentsSection";

const COMMENTS = [
  { id: "comment-1", eventId: "event-1", userId: "user-1", body: "楽しみですね", createdAt: "2026-08-18T00:00:00.000Z" },
];

describe("EventCommentsSection", () => {
  it("shows each comment's body, author, and posted time", async () => {
    const { getByText } = await render(
      <EventCommentsSection comments={COMMENTS} onSubmit={jest.fn()} />
    );

    expect(getByText("楽しみですね")).toBeTruthy();
    expect(getByText("user-1")).toBeTruthy();
    expect(getByText("2026-08-18T00:00:00.000Z")).toBeTruthy();
  });

  it("submits the entered text and clears the input", async () => {
    const onSubmit = jest.fn();
    const { getByTestId } = await render(
      <EventCommentsSection comments={[]} onSubmit={onSubmit} />
    );

    await fireEvent.changeText(getByTestId("event-comment-input"), "了解です");
    await fireEvent.press(getByTestId("event-comment-submit"));

    expect(onSubmit).toHaveBeenCalledWith("了解です");
    expect(getByTestId("event-comment-input").props.value).toBe("");
  });

  it("immediately reflects a newly posted comment when the comments prop updates", async () => {
    const { getByText, queryByText, rerender } = await render(
      <EventCommentsSection comments={COMMENTS} onSubmit={jest.fn()} />
    );

    expect(queryByText("追加のコメント")).toBeNull();

    const updatedComments = [
      ...COMMENTS,
      { id: "comment-2", eventId: "event-1", userId: "user-2", body: "追加のコメント", createdAt: "2026-08-18T01:00:00.000Z" },
    ];
    await rerender(<EventCommentsSection comments={updatedComments} onSubmit={jest.fn()} />);

    expect(getByText("追加のコメント")).toBeTruthy();
  });

  it("disables the submit button while submitting", async () => {
    const { getByTestId } = await render(
      <EventCommentsSection comments={[]} onSubmit={jest.fn()} isSubmitting />
    );

    expect(getByTestId("event-comment-submit").props.accessibilityState.disabled).toBe(true);
  });

  it("shows a delete button only for the current user's own comments", async () => {
    const comments = [
      ...COMMENTS,
      { id: "comment-2", eventId: "event-1", userId: "user-2", body: "了解です", createdAt: "2026-08-18T01:00:00.000Z" },
    ];
    const { getByTestId, queryByTestId } = await render(
      <EventCommentsSection comments={comments} onSubmit={jest.fn()} currentUserId="user-1" onDelete={jest.fn()} />
    );

    expect(getByTestId("event-comment-delete-comment-1")).toBeTruthy();
    expect(queryByTestId("event-comment-delete-comment-2")).toBeNull();
  });

  it("calls onDelete and removes the comment from the list when its delete button is pressed", async () => {
    const onDelete = jest.fn();
    const { getByTestId, queryByText, rerender } = await render(
      <EventCommentsSection comments={COMMENTS} onSubmit={jest.fn()} currentUserId="user-1" onDelete={onDelete} />
    );

    await fireEvent.press(getByTestId("event-comment-delete-comment-1"));

    expect(onDelete).toHaveBeenCalledWith("comment-1");

    await rerender(
      <EventCommentsSection comments={[]} onSubmit={jest.fn()} currentUserId="user-1" onDelete={onDelete} />
    );
    expect(queryByText("楽しみですね")).toBeNull();
  });
});
