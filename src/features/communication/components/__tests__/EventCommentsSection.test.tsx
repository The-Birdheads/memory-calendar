import { fireEvent, render } from "@testing-library/react-native";

import { EventCommentsSection } from "../EventCommentsSection";
import type { EventComment } from "../../types";

const COMMENTS: EventComment[] = [
  { id: "comment-1", eventId: "event-1", userId: "user-1", body: "楽しみ！", createdAt: "2026-08-18T00:00:00.000Z" },
];

describe("EventCommentsSection", () => {
  it("shows the comment list, with the author and delete button only on the caller's own comment", async () => {
    const { getByTestId, getByText } = await render(
      <EventCommentsSection
        comments={COMMENTS}
        currentUserId="user-1"
        onSubmitComment={jest.fn()}
        resolveAuthorName={(id) => (id === "user-1" ? "たろう" : id)}
      />
    );

    expect(getByTestId("event-comment-comment-1")).toBeTruthy();
    expect(getByText("楽しみ！")).toBeTruthy();
    expect(getByText("たろう")).toBeTruthy();
    expect(getByTestId("event-comment-delete-comment-1")).toBeTruthy();
  });

  it("uses a trash icon instead of the 削除 text label for the comment delete button", async () => {
    const { queryByText, getByTestId } = await render(
      <EventCommentsSection
        comments={COMMENTS}
        currentUserId="user-1"
        onSubmitComment={jest.fn()}
        resolveAuthorName={(id) => (id === "user-1" ? "たろう" : id)}
      />
    );

    expect(queryByText("削除")).toBeNull();
    expect(getByTestId("event-comment-delete-comment-1")).toBeTruthy();
  });

  it("hides the delete button on a comment that isn't the caller's own", async () => {
    const { queryByTestId } = await render(
      <EventCommentsSection comments={COMMENTS} currentUserId="someone-else" onSubmitComment={jest.fn()} />
    );

    expect(queryByTestId("event-comment-delete-comment-1")).toBeNull();
  });

  it("posts a comment from the input row and clears the input", async () => {
    const onSubmitComment = jest.fn();
    const { getByTestId } = await render(
      <EventCommentsSection comments={[]} onSubmitComment={onSubmitComment} />
    );

    await fireEvent.changeText(getByTestId("event-comment-input"), "コメントです");
    await fireEvent.press(getByTestId("event-comment-submit"));

    expect(onSubmitComment).toHaveBeenCalledWith("コメントです");
    expect(getByTestId("event-comment-input").props.value).toBe("");
  });

  it("shows no stamp/reaction UI at all (the feature was removed - comments only)", async () => {
    const { queryByTestId, queryByText } = await render(
      <EventCommentsSection comments={[]} onSubmitComment={jest.fn()} />
    );

    expect(queryByTestId("event-stamp-toggle")).toBeNull();
    expect(queryByTestId(/event-reaction/)).toBeNull();
    expect(queryByText("🙂")).toBeNull();
  });
});
