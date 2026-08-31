import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { TagManagementModal } from "../TagManagementModal";
import { useCreateTag, useDeleteTag, useTagTree, useUpdateTag } from "../../hooks";
import type { TagTreeNode } from "../../types";

jest.mock("../../hooks", () => ({
  useTagTree: jest.fn(),
  useCreateTag: jest.fn(),
  useUpdateTag: jest.fn(),
  useDeleteTag: jest.fn(),
}));

const CALENDARS = [
  { id: "cal-1", name: "我が家" },
  { id: "cal-2", name: "友人グループ" },
];

const TAG_TREE: TagTreeNode[] = [
  {
    id: "tag-1",
    calendarId: "cal-1",
    parentId: null,
    level: "major" as const,
    name: "行事",
    color: "#ff0000",
    createdAt: "2026-08-18T00:00:00.000Z",
    children: [],
  },
];

function mockHooks(overrides: { tagTree?: TagTreeNode[]; refetch?: jest.Mock } = {}) {
  const refetch = overrides.refetch ?? jest.fn();
  (useTagTree as jest.Mock).mockReturnValue({
    tagTree: overrides.tagTree ?? TAG_TREE,
    isLoading: false,
    error: null,
    refetch,
  });
  (useCreateTag as jest.Mock).mockReturnValue({
    createTag: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useUpdateTag as jest.Mock).mockReturnValue({
    updateTag: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useDeleteTag as jest.Mock).mockReturnValue({
    deleteTag: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  return { refetch };
}

describe("TagManagementModal", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows the calendar switcher and the initial calendar's existing tags", async () => {
    mockHooks();

    const { getByTestId, getByText } = await render(
      <TagManagementModal calendars={CALENDARS} initialCalendarId="cal-1" onClose={jest.fn()} />
    );

    expect(getByTestId("tag-management-calendar-cal-1")).toBeTruthy();
    expect(getByTestId("tag-management-calendar-cal-2")).toBeTruthy();
    expect(getByText("行事")).toBeTruthy();
  });

  it("shows a distinct shape icon per tag level in the list", async () => {
    mockHooks({
      tagTree: [
        {
          ...TAG_TREE[0],
          children: [
            {
              id: "tag-mid",
              calendarId: "cal-1",
              parentId: "tag-1",
              level: "mid" as const,
              name: "誕生日",
              color: "#00ff00",
              createdAt: "2026-08-18T00:00:00.000Z",
              children: [],
            },
          ],
        },
      ],
    });

    const { getByTestId } = await render(
      <TagManagementModal calendars={CALENDARS} initialCalendarId="cal-1" onClose={jest.fn()} />
    );

    const majorIconStyle = getByTestId("tag-management-tag-icon-tag-1").props.style;
    const midIconStyle = getByTestId("tag-management-tag-icon-tag-mid").props.style;
    expect(majorIconStyle).not.toEqual(midIconStyle);
  });

  it("re-queries the tag tree for the newly selected calendar when switched", async () => {
    mockHooks();

    const { getByTestId } = await render(
      <TagManagementModal calendars={CALENDARS} initialCalendarId="cal-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("tag-management-calendar-cal-2"));

    expect(useTagTree).toHaveBeenLastCalledWith("cal-2");
  });

  it("shows an empty state when the selected calendar has no tags yet", async () => {
    mockHooks({ tagTree: [] });

    const { getByText, queryByTestId } = await render(
      <TagManagementModal calendars={CALENDARS} initialCalendarId="cal-1" onClose={jest.fn()} />
    );

    expect(getByText("まだタグがありません")).toBeTruthy();
    expect(queryByTestId("tag-management-tag-tag-1")).toBeNull();
  });

  it("shows the create form pre-filled with defaults when '新規' is pressed, and creates the tag", async () => {
    const { refetch } = mockHooks();
    const createTagMock = jest.fn().mockResolvedValue(true);
    (useCreateTag as jest.Mock).mockReturnValue({ createTag: createTagMock, isSubmitting: false, error: null });
    const onChange = jest.fn();

    const { getByTestId, queryByTestId } = await render(
      <TagManagementModal calendars={CALENDARS} initialCalendarId="cal-1" onClose={jest.fn()} onChange={onChange} />
    );

    await fireEvent.press(getByTestId("tag-management-new-button"));
    expect(queryByTestId("tag-management-delete-button")).toBeNull();

    await fireEvent.changeText(getByTestId("edit-tag-name-input"), "旅行");
    await fireEvent.press(getByTestId("edit-tag-save-button"));

    await waitFor(() =>
      expect(createTagMock).toHaveBeenCalledWith({
        calendarId: "cal-1",
        name: "旅行",
        color: "#2f6fed",
        level: "major",
        parentId: null,
      })
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(onChange).toHaveBeenCalled();
    // returns to the list after a successful save
    expect(queryByTestId("edit-tag-name-input")).toBeNull();
  });

  it("shows the edit form pre-filled when an existing tag is selected, and saves the update", async () => {
    const { refetch } = mockHooks();
    const updateTagMock = jest.fn().mockResolvedValue(true);
    (useUpdateTag as jest.Mock).mockReturnValue({ updateTag: updateTagMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(
      <TagManagementModal calendars={CALENDARS} initialCalendarId="cal-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("tag-management-tag-tag-1"));

    expect(getByTestId("edit-tag-name-input").props.value).toBe("行事");
    expect(getByTestId("tag-management-delete-button")).toBeTruthy();

    await fireEvent.changeText(getByTestId("edit-tag-name-input"), "行楽");
    await fireEvent.press(getByTestId("edit-tag-save-button"));

    await waitFor(() =>
      expect(updateTagMock).toHaveBeenCalledWith("tag-1", {
        name: "行楽",
        color: "#ff0000",
        level: "major",
        parentId: null,
      })
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("deletes the selected tag after confirming and returns to the list", async () => {
    const { refetch } = mockHooks();
    const deleteTagMock = jest.fn().mockResolvedValue(true);
    (useDeleteTag as jest.Mock).mockReturnValue({ deleteTag: deleteTagMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(
      <TagManagementModal calendars={CALENDARS} initialCalendarId="cal-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("tag-management-tag-tag-1"));
    await fireEvent.press(getByTestId("tag-management-delete-button"));
    await fireEvent.press(getByTestId("delete-tag-confirm-button"));

    await waitFor(() => expect(deleteTagMock).toHaveBeenCalledWith("tag-1"));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(queryByTestId("edit-tag-name-input")).toBeNull();
  });

  it("returns to the list without saving when '一覧に戻る' is pressed from the create form", async () => {
    mockHooks();

    const { getByTestId, queryByTestId } = await render(
      <TagManagementModal calendars={CALENDARS} initialCalendarId="cal-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("tag-management-new-button"));
    await fireEvent.press(getByTestId("tag-management-back-to-list"));

    expect(queryByTestId("edit-tag-name-input")).toBeNull();
    expect(getByTestId("tag-management-tag-tag-1")).toBeTruthy();
  });

  it("calls onClose when the close button is pressed", async () => {
    mockHooks();
    const onClose = jest.fn();

    const { getByTestId } = await render(
      <TagManagementModal calendars={CALENDARS} initialCalendarId="cal-1" onClose={onClose} />
    );

    await fireEvent.press(getByTestId("tag-management-close"));

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is tapped, but not when the card content is tapped", async () => {
    mockHooks();
    const onClose = jest.fn();

    const { getByTestId } = await render(
      <TagManagementModal calendars={CALENDARS} initialCalendarId="cal-1" onClose={onClose} />
    );

    await fireEvent.press(getByTestId("tag-management-tag-tag-1"));
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId("tag-management-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });
});
