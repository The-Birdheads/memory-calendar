import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { CalendarSettingsModal } from "../CalendarSettingsModal";
import {
  useCalendarMembers,
  useCreateCalendar,
  useCreateInvite,
  useRemoveMember,
  useUpdateCalendar,
} from "../../hooks";
import { useCreateTag, useDeleteTag, useTagTree, useUpdateTag } from "../../../tags/hooks";

jest.mock("../../hooks", () => ({
  useCalendarMembers: jest.fn(),
  useCreateCalendar: jest.fn(),
  useCreateInvite: jest.fn(),
  useRemoveMember: jest.fn(),
  useUpdateCalendar: jest.fn(),
}));

jest.mock("../../../tags/hooks", () => ({
  useTagTree: jest.fn(),
  useCreateTag: jest.fn(),
  useUpdateTag: jest.fn(),
  useDeleteTag: jest.fn(),
}));

const CALENDARS = [
  { id: "cal-1", name: "我が家", kind: "group" as const, createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
  { id: "cal-2", name: "自分用", kind: "personal" as const, createdBy: "user-1", createdAt: "2026-08-17T01:00:00.000Z" },
];

const MEMBERS_CAL_1 = [
  { calendarId: "cal-1", userId: "user-1", role: "owner", joinedAt: "2026-08-17T00:00:00.000Z", displayName: "たろう" },
  { calendarId: "cal-1", userId: "user-2", role: "viewer", joinedAt: "2026-08-17T00:00:00.000Z", displayName: null },
];

function mockCommonHooks(members: typeof MEMBERS_CAL_1 = MEMBERS_CAL_1, refetchMembers = jest.fn()) {
  (useCalendarMembers as jest.Mock).mockReturnValue({
    members,
    isLoading: false,
    error: null,
    refetch: refetchMembers,
  });
  (useCreateCalendar as jest.Mock).mockReturnValue({ createCalendar: jest.fn(), isSubmitting: false, error: null });
  (useUpdateCalendar as jest.Mock).mockReturnValue({ updateCalendar: jest.fn(), isSubmitting: false, error: null });
  (useRemoveMember as jest.Mock).mockReturnValue({ removeMember: jest.fn(), isSubmitting: false, error: null });
  (useCreateInvite as jest.Mock).mockReturnValue({ createInvite: jest.fn(), isSubmitting: false, error: null });
  (useTagTree as jest.Mock).mockReturnValue({ tagTree: [], isLoading: false, error: null, refetch: jest.fn() });
  (useCreateTag as jest.Mock).mockReturnValue({ createTag: jest.fn(), isSubmitting: false, error: null });
  (useUpdateTag as jest.Mock).mockReturnValue({ updateTag: jest.fn(), isSubmitting: false, error: null });
  (useDeleteTag as jest.Mock).mockReturnValue({ deleteTag: jest.fn(), isSubmitting: false, error: null });
}

describe("CalendarSettingsModal", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("lists every calendar with its kind label", async () => {
    mockCommonHooks();

    const { getByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />
    );

    expect(getByTestId("calendar-settings-calendar-cal-1")).toBeTruthy();
    expect(getByTestId("calendar-settings-calendar-cal-2")).toBeTruthy();
  });

  it("opens a calendar's edit view, pre-filled with its name, when tapped", async () => {
    mockCommonHooks();

    const { getByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));

    expect(getByTestId("calendar-settings-name-input").props.value).toBe("我が家");
    expect(useCalendarMembers).toHaveBeenLastCalledWith("cal-1");
  });

  it("saves the renamed calendar and notifies the caller to refetch", async () => {
    mockCommonHooks();
    const updateCalendarMock = jest.fn().mockResolvedValue(true);
    (useUpdateCalendar as jest.Mock).mockReturnValue({
      updateCalendar: updateCalendarMock,
      isSubmitting: false,
      error: null,
    });
    const onChange = jest.fn();

    const { getByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} onChange={onChange} />
    );

    await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
    await fireEvent.changeText(getByTestId("calendar-settings-name-input"), "改名後の我が家");
    await fireEvent.press(getByTestId("calendar-settings-save-name"));

    await waitFor(() => expect(updateCalendarMock).toHaveBeenCalledWith("cal-1", { name: "改名後の我が家" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("shows a remove button for non-owner members only when the caller is the owner", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));

    expect(getByTestId("calendar-settings-remove-member-user-2")).toBeTruthy();
    expect(queryByTestId("calendar-settings-remove-member-user-1")).toBeNull();
  });

  it("hides remove buttons entirely when the caller is not the owner", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-2" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));

    expect(queryByTestId("calendar-settings-remove-member-user-2")).toBeNull();
  });

  it("removes a member and refetches the member list", async () => {
    const refetchMembers = jest.fn();
    mockCommonHooks(MEMBERS_CAL_1, refetchMembers);
    const removeMemberMock = jest.fn().mockResolvedValue(true);
    (useRemoveMember as jest.Mock).mockReturnValue({
      removeMember: removeMemberMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
    await fireEvent.press(getByTestId("calendar-settings-remove-member-user-2"));

    await waitFor(() => expect(removeMemberMock).toHaveBeenCalledWith("cal-1", "user-2"));
    await waitFor(() => expect(refetchMembers).toHaveBeenCalled());
  });

  it("generates and shows an invite code", async () => {
    mockCommonHooks();
    (useCreateInvite as jest.Mock).mockReturnValue({
      createInvite: jest.fn().mockResolvedValue({
        id: "invite-1",
        calendarId: "cal-1",
        code: "ABC123",
        expiresAt: "2026-09-01T00:00:00.000Z",
        createdBy: "user-1",
        createdAt: "2026-08-22T00:00:00.000Z",
      }),
      isSubmitting: false,
      error: null,
    });

    const { getByTestId, getByText } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
    await fireEvent.press(getByTestId("calendar-settings-invite-button"));

    await waitFor(() => expect(getByText("ABC123")).toBeTruthy());
  });

  it("opens the tag management modal scoped to the selected calendar", async () => {
    mockCommonHooks();

    const { getByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
    await fireEvent.press(getByTestId("calendar-settings-manage-tags"));

    expect(useTagTree).toHaveBeenLastCalledWith("cal-1");
    expect(getByTestId("tag-management-close")).toBeTruthy();
  });

  it("starts a blank creation form, defaulting to グループ, from the new-calendar button", async () => {
    mockCommonHooks();

    const { getByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("calendar-settings-new-button"));

    expect(getByTestId("calendar-settings-name-input").props.value).toBe("");
  });

  it("creates a personal calendar and moves straight into its edit view", async () => {
    mockCommonHooks();
    const createCalendarMock = jest.fn().mockResolvedValue({
      id: "cal-3",
      name: "新しい個人用",
      kind: "personal",
      createdBy: "user-1",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    (useCreateCalendar as jest.Mock).mockReturnValue({
      createCalendar: createCalendarMock,
      isSubmitting: false,
      error: null,
    });
    const onChange = jest.fn();

    const { getByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} onChange={onChange} />
    );

    await fireEvent.press(getByTestId("calendar-settings-new-button"));
    await fireEvent.changeText(getByTestId("calendar-settings-name-input"), "新しい個人用");
    await fireEvent.press(getByTestId("calendar-settings-kind-personal"));
    await fireEvent.press(getByTestId("calendar-settings-create-submit"));

    await waitFor(() =>
      expect(createCalendarMock).toHaveBeenCalledWith({ name: "新しい個人用", kind: "personal" })
    );
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    await waitFor(() => expect(getByTestId("calendar-settings-save-name")).toBeTruthy());
  });

  it("returns to the list from the edit view via '一覧に戻る'", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />
    );

    await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
    expect(queryByTestId("calendar-settings-name-input")).toBeTruthy();

    await fireEvent.press(getByTestId("calendar-settings-back-to-list"));

    expect(queryByTestId("calendar-settings-name-input")).toBeNull();
    expect(getByTestId("calendar-settings-calendar-cal-1")).toBeTruthy();
  });

  it("calls onClose from the close button", async () => {
    mockCommonHooks();
    const onClose = jest.fn();

    const { getByTestId } = await render(
      <CalendarSettingsModal calendars={CALENDARS} currentUserId="user-1" onClose={onClose} />
    );

    await fireEvent.press(getByTestId("calendar-settings-close"));

    expect(onClose).toHaveBeenCalled();
  });
});
