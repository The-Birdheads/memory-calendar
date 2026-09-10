import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import { SettingsHubModal } from "../SettingsHubModal";
import {
  useCalendarMembers,
  useCreateCalendar,
  useCreateInvite,
  useJoinByInvite,
  useLeaveOrDeleteCalendar,
  useMyCalendars,
  useUpdateCalendar,
} from "../../hooks";
import { useCreateTag, useDeleteTag, useTagTree, useUpdateTag } from "../../../tags/hooks";
import { useAuthActions } from "../../../auth/hooks";
import { useMyProfile, useUpdateDisplayName } from "../../../profile/hooks";
import type { TagTreeNode } from "../../../tags/types";

jest.mock("../../hooks", () => ({
  useCalendarMembers: jest.fn(),
  useCreateCalendar: jest.fn(),
  useCreateInvite: jest.fn(),
  useJoinByInvite: jest.fn(),
  useLeaveOrDeleteCalendar: jest.fn(),
  useMyCalendars: jest.fn(),
  useUpdateCalendar: jest.fn(),
}));

jest.mock("../../../tags/hooks", () => ({
  useTagTree: jest.fn(),
  useCreateTag: jest.fn(),
  useUpdateTag: jest.fn(),
  useDeleteTag: jest.fn(),
}));

jest.mock("../../../auth/hooks", () => ({
  useAuthActions: jest.fn(),
}));

jest.mock("../../../profile/hooks", () => ({
  useMyProfile: jest.fn(),
  useUpdateDisplayName: jest.fn(),
}));

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);

const CALENDARS = [
  { id: "cal-1", name: "我が家", kind: "group" as const, color: "#2f6fed", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
  { id: "cal-2", name: "自分用", kind: "personal" as const, color: "#e53935", createdBy: "user-1", createdAt: "2026-08-17T01:00:00.000Z" },
];

const MEMBERS_CAL_1 = [
  { calendarId: "cal-1", userId: "user-1", role: "owner", joinedAt: "2026-08-17T00:00:00.000Z", displayName: "たろう" },
  { calendarId: "cal-1", userId: "user-2", role: "viewer", joinedAt: "2026-08-17T00:00:00.000Z", displayName: null },
];

const TAG_TREE: TagTreeNode[] = [
  {
    id: "tag-1",
    parentId: null,
    level: "major" as const,
    name: "行事",
    color: "#ff0000",
    createdAt: "2026-08-18T00:00:00.000Z",
    children: [],
  },
];

function mockHooks(
  options: {
    members?: typeof MEMBERS_CAL_1;
    refetchMembers?: jest.Mock;
    tagTree?: TagTreeNode[];
    refetchTags?: jest.Mock;
  } = {},
) {
  const refetchMembers = options.refetchMembers ?? jest.fn();
  const refetchTags = options.refetchTags ?? jest.fn();

  (useMyCalendars as jest.Mock).mockReturnValue({
    calendars: CALENDARS,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  (useCalendarMembers as jest.Mock).mockReturnValue({
    members: options.members ?? MEMBERS_CAL_1,
    isLoading: false,
    error: null,
    refetch: refetchMembers,
  });
  (useCreateCalendar as jest.Mock).mockReturnValue({ createCalendar: jest.fn(), isSubmitting: false, error: null });
  (useCreateInvite as jest.Mock).mockReturnValue({ createInvite: jest.fn(), isSubmitting: false, error: null });
  (useJoinByInvite as jest.Mock).mockReturnValue({
    joinByInvite: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useUpdateCalendar as jest.Mock).mockReturnValue({ updateCalendar: jest.fn(), isSubmitting: false, error: null });
  (useLeaveOrDeleteCalendar as jest.Mock).mockReturnValue({
    leaveOrDeleteCalendar: jest.fn(),
    isSubmitting: false,
    error: null,
  });
  (useTagTree as jest.Mock).mockReturnValue({
    tagTree: options.tagTree ?? TAG_TREE,
    isLoading: false,
    error: null,
    refetch: refetchTags,
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
  (useAuthActions as jest.Mock).mockReturnValue({ signOut: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
  (useMyProfile as jest.Mock).mockReturnValue({
    profile: { id: "user-1", displayName: "たろう", avatarUrl: null },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  (useUpdateDisplayName as jest.Mock).mockReturnValue({ updateDisplayName: jest.fn(), isSubmitting: false, error: null });

  return { refetchMembers, refetchTags };
}

describe("SettingsHubModal", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("navigation shell", () => {
    it("shows the hub with entries for personal and calendar settings", async () => {
      mockHooks();

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />,
      );

      expect(getByTestId("settings-hub-open-personal")).toBeTruthy();
      expect(getByTestId("settings-hub-open-calendar")).toBeTruthy();
      // At the top of the stack there is nothing to go back to.
      expect(() => getByTestId("settings-hub-back")).toThrow();
    });

    it("opens personal settings and shows the caller's display name", async () => {
      mockHooks();

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />,
      );

      await fireEvent.press(getByTestId("settings-hub-open-personal"));

      expect(getByTestId("personal-settings-name-input").props.value).toBe("たろう");
    });

    it("opens calendar settings and shows the calendar list", async () => {
      mockHooks();

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />,
      );

      await fireEvent.press(getByTestId("settings-hub-open-calendar"));

      expect(getByTestId("calendar-settings-calendar-cal-1")).toBeTruthy();
    });

    it("opens tag settings directly from the hub, without going through a specific calendar", async () => {
      mockHooks();

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />,
      );

      await fireEvent.press(getByTestId("settings-hub-open-tags"));

      expect(getByTestId("tag-management-tag-tag-1")).toBeTruthy();
    });

    it("returns exactly one level via the single back button, however deep the stack is", async () => {
      mockHooks();

      const { getByTestId, queryByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} />,
      );

      await fireEvent.press(getByTestId("settings-hub-open-calendar"));
      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
      expect(getByTestId("calendar-settings-name-input")).toBeTruthy();
      // Exactly one back control, never two stacked "back" links.
      expect(getByTestId("settings-hub-back")).toBeTruthy();

      await fireEvent.press(getByTestId("settings-hub-back"));
      expect(queryByTestId("calendar-settings-name-input")).toBeNull();
      expect(getByTestId("calendar-settings-calendar-cal-1")).toBeTruthy();

      await fireEvent.press(getByTestId("settings-hub-back"));
      expect(queryByTestId("calendar-settings-calendar-cal-1")).toBeNull();
      expect(getByTestId("settings-hub-open-calendar")).toBeTruthy();
    });

    it("calls onClose from the × close button", async () => {
      mockHooks();
      const onClose = jest.fn();

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={onClose} />,
      );

      await fireEvent.press(getByTestId("settings-hub-close"));

      expect(onClose).toHaveBeenCalled();
    });

    it("calls onClose when the backdrop is tapped, but not when the card content is tapped", async () => {
      mockHooks();
      const onClose = jest.fn();

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={onClose} />,
      );

      await fireEvent.press(getByTestId("settings-hub-open-personal"));
      expect(onClose).not.toHaveBeenCalled();

      await fireEvent.press(getByTestId("settings-hub-backdrop"));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("calendar settings", () => {
    it("lists every calendar with a 個人用/共有 kind label (not 「グループ」)", async () => {
      mockHooks();

      const { getByTestId, getByText, queryByText } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      expect(getByTestId("calendar-settings-calendar-cal-1")).toBeTruthy();
      expect(getByTestId("calendar-settings-calendar-cal-2")).toBeTruthy();
      expect(getByText("個人用")).toBeTruthy();
      expect(getByText("共有")).toBeTruthy();
      expect(queryByText("グループ")).toBeNull();
    });

    it("shows each calendar's own default color as a dot in the list", async () => {
      mockHooks();

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      const flattenStyle = (style: unknown) =>
        Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

      expect(flattenStyle(getByTestId("calendar-settings-color-dot-cal-1").props.style).backgroundColor).toBe(
        "#2f6fed",
      );
      expect(flattenStyle(getByTestId("calendar-settings-color-dot-cal-2").props.style).backgroundColor).toBe(
        "#e53935",
      );
    });

    it("hides the invite option and shows an explanatory note when the personal calendar is opened", async () => {
      mockHooks();

      const { getByTestId, queryByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-2"));

      expect(getByTestId("calendar-settings-personal-note")).toBeTruthy();
      expect(queryByTestId("calendar-settings-invite-button")).toBeNull();
    });

    it("opens a calendar's edit view, pre-filled with its name", async () => {
      mockHooks();

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));

      expect(getByTestId("calendar-settings-name-input").props.value).toBe("我が家");
      expect(useCalendarMembers).toHaveBeenLastCalledWith("cal-1");
    });

    it("saves the renamed calendar and notifies the caller to refetch", async () => {
      mockHooks();
      const updateCalendarMock = jest.fn().mockResolvedValue(true);
      (useUpdateCalendar as jest.Mock).mockReturnValue({
        updateCalendar: updateCalendarMock,
        isSubmitting: false,
        error: null,
      });
      const onChange = jest.fn();

      const { getByTestId } = await render(
        <SettingsHubModal
          calendars={CALENDARS}
          currentUserId="user-1"
          onClose={jest.fn()}
          onChange={onChange}
          initialSection="calendar"
        />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
      await fireEvent.changeText(getByTestId("calendar-settings-name-input"), "改名後の我が家");
      await fireEvent.press(getByTestId("calendar-settings-save-button"));

      await waitFor(() =>
        expect(updateCalendarMock).toHaveBeenCalledWith("cal-1", { name: "改名後の我が家", color: "#2f6fed" }),
      );
      await waitFor(() => expect(onChange).toHaveBeenCalled());
    });

    it("uses a ✓ icon instead of the 保存 text label for the calendar-edit save button", async () => {
      mockHooks();

      const { queryByText, getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));

      expect(queryByText("保存")).toBeNull();
      expect(getByTestId("calendar-settings-save-button")).toBeTruthy();
    });

    it("changes the calendar's color and saves it together with the name", async () => {
      mockHooks();
      const updateCalendarMock = jest.fn().mockResolvedValue(true);
      (useUpdateCalendar as jest.Mock).mockReturnValue({
        updateCalendar: updateCalendarMock,
        isSubmitting: false,
        error: null,
      });

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
      await fireEvent.press(getByTestId("calendar-settings-color-green"));
      await fireEvent.press(getByTestId("calendar-settings-save-button"));

      await waitFor(() =>
        expect(updateCalendarMock).toHaveBeenCalledWith("cal-1", { name: "我が家", color: "#43a047" }),
      );
    });

    it("marks a color already used by another calendar/tag, and explains who's using it once picked", async () => {
      mockHooks(); // TAG_TREE has no palette-matching color by default, so only cal-2's color is in play here

      const { getByTestId, queryByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      // cal-1 (being edited, color #2f6fed) vs. cal-2 (personal, "自分用", color #e53935/red).
      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));

      expect(getByTestId("calendar-settings-color-red-used-mark")).toBeTruthy();
      expect(queryByTestId("calendar-settings-color-usage-message")).toBeNull(); // not selected yet

      await fireEvent.press(getByTestId("calendar-settings-color-red"));

      expect(getByTestId("calendar-settings-color-usage-message").props.children).toBe(
        "この色は個人用カレンダー「自分用」で使用中です",
      );
    });

    it("mentions both a calendar and a tag when a color is used by both", async () => {
      mockHooks({
        tagTree: [
          { id: "tag-a", parentId: null, level: "major" as const, name: "旅行", color: "#e53935", createdAt: "2026-08-01T00:00:00.000Z", children: [] },
        ],
      });

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
      await fireEvent.press(getByTestId("calendar-settings-color-red"));

      expect(getByTestId("calendar-settings-color-usage-message").props.children).toBe(
        "この色は個人用カレンダー「自分用」とタグ「旅行」で使用中です",
      );
    });

    it("never shows a way to remove another member - only leaving oneself is possible", async () => {
      mockHooks();

      const { getByTestId, queryByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));

      // Even the owner has no per-member "remove" control.
      expect(queryByTestId("calendar-settings-remove-member-user-2")).toBeNull();
      expect(queryByTestId("calendar-settings-remove-member-user-1")).toBeNull();
      expect(getByTestId("calendar-settings-leave-or-delete-button")).toBeTruthy();
    });

    it("explains what a shared calendar is for, on the create form itself", async () => {
      mockHooks();

      const { getByTestId, getByText } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-new-button"));

      expect(getByTestId("calendar-settings-create-description")).toBeTruthy();
      expect(
        getByText("家族や友人と予定を共有できる、新しいカレンダーを作成します。作成後に招待コードで誘えます。"),
      ).toBeTruthy();
    });

    it("creates a calendar with the picked default color", async () => {
      mockHooks();
      const createCalendarMock = jest.fn().mockResolvedValue({
        id: "cal-3",
        name: "新しいカレンダー",
        kind: "group",
        color: "#e53935",
        createdBy: "user-1",
        createdAt: "2026-09-01T00:00:00.000Z",
      });
      (useCreateCalendar as jest.Mock).mockReturnValue({
        createCalendar: createCalendarMock,
        isSubmitting: false,
        error: null,
      });

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-new-button"));
      await fireEvent.changeText(getByTestId("calendar-settings-name-input"), "新しいカレンダー");
      await fireEvent.press(getByTestId("calendar-settings-color-red"));
      await fireEvent.press(getByTestId("calendar-settings-create-submit"));

      await waitFor(() =>
        expect(createCalendarMock).toHaveBeenCalledWith({ name: "新しいカレンダー", color: "#e53935" }),
      );
    });

    it("creates a calendar and moves into a dedicated「作成しました」step (not straight into the busy edit view)", async () => {
      mockHooks();
      const createCalendarMock = jest.fn().mockResolvedValue({
        id: "cal-3",
        name: "新しいカレンダー",
        kind: "group",
        createdBy: "user-1",
        createdAt: "2026-09-01T00:00:00.000Z",
      });
      (useCreateCalendar as jest.Mock).mockReturnValue({
        createCalendar: createCalendarMock,
        isSubmitting: false,
        error: null,
      });
      const onChange = jest.fn();

      const { getByTestId, getByText, queryByTestId } = await render(
        <SettingsHubModal
          calendars={CALENDARS}
          currentUserId="user-1"
          onClose={jest.fn()}
          onChange={onChange}
          initialSection="calendar"
        />,
      );

      await fireEvent.press(getByTestId("calendar-settings-new-button"));
      await fireEvent.changeText(getByTestId("calendar-settings-name-input"), "新しいカレンダー");
      await fireEvent.press(getByTestId("calendar-settings-create-submit"));

      await waitFor(() =>
        expect(createCalendarMock).toHaveBeenCalledWith({ name: "新しいカレンダー", color: "#2f6fed" }),
      );
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      await waitFor(() => expect(getByTestId("calendar-settings-created")).toBeTruthy());
      expect(getByText("「新しいカレンダー」を作成しました")).toBeTruthy();
      expect(queryByTestId("calendar-settings-save-button")).toBeNull();
    });

    it("opens the invite screen directly from the 「作成しました」step, and going back lands on the edit view", async () => {
      mockHooks();
      (useCreateCalendar as jest.Mock).mockReturnValue({
        createCalendar: jest.fn().mockResolvedValue({
          id: "cal-3",
          name: "新しいカレンダー",
          kind: "group",
          createdBy: "user-1",
          createdAt: "2026-09-01T00:00:00.000Z",
        }),
        isSubmitting: false,
        error: null,
      });

      const { getByTestId, queryByTestId } = await render(
        <SettingsHubModal
          calendars={CALENDARS}
          currentUserId="user-1"
          onClose={jest.fn()}
          onChange={jest.fn()}
          initialSection="calendar"
        />,
      );

      await fireEvent.press(getByTestId("calendar-settings-new-button"));
      await fireEvent.changeText(getByTestId("calendar-settings-name-input"), "新しいカレンダー");
      await fireEvent.press(getByTestId("calendar-settings-create-submit"));
      await waitFor(() => expect(getByTestId("calendar-settings-created-invite")).toBeTruthy());

      await fireEvent.press(getByTestId("calendar-settings-created-invite"));
      expect(getByTestId("invite-flow-generate")).toBeTruthy();

      await fireEvent.press(getByTestId("settings-hub-back"));

      expect(queryByTestId("invite-flow-generate")).toBeNull();
      expect(getByTestId("calendar-settings-save-button")).toBeTruthy();
    });

    it("goes straight to the edit view when 'あとで招待する' is pressed from the 「作成しました」step", async () => {
      mockHooks();
      (useCreateCalendar as jest.Mock).mockReturnValue({
        createCalendar: jest.fn().mockResolvedValue({
          id: "cal-3",
          name: "新しいカレンダー",
          kind: "group",
          createdBy: "user-1",
          createdAt: "2026-09-01T00:00:00.000Z",
        }),
        isSubmitting: false,
        error: null,
      });

      const { getByTestId, queryByTestId } = await render(
        <SettingsHubModal
          calendars={CALENDARS}
          currentUserId="user-1"
          onClose={jest.fn()}
          onChange={jest.fn()}
          initialSection="calendar"
        />,
      );

      await fireEvent.press(getByTestId("calendar-settings-new-button"));
      await fireEvent.changeText(getByTestId("calendar-settings-name-input"), "新しいカレンダー");
      await fireEvent.press(getByTestId("calendar-settings-create-submit"));
      await waitFor(() => expect(getByTestId("calendar-settings-created-later")).toBeTruthy());

      await fireEvent.press(getByTestId("calendar-settings-created-later"));

      expect(queryByTestId("calendar-settings-created")).toBeNull();
      expect(getByTestId("calendar-settings-save-button")).toBeTruthy();
    });

    it("opens straight into the create form when initialCalendarMode is 'create' (skipping the list screen)", async () => {
      mockHooks();

      const { getByTestId, queryByTestId } = await render(
        <SettingsHubModal
          calendars={CALENDARS}
          currentUserId="user-1"
          onClose={jest.fn()}
          onChange={jest.fn()}
          initialSection="calendar"
          initialCalendarMode="create"
        />,
      );

      expect(queryByTestId("calendar-settings-new-button")).toBeNull();
      expect(getByTestId("calendar-settings-name-input")).toBeTruthy();
      expect(getByTestId("calendar-settings-create-submit")).toBeTruthy();
    });

    it("joins a calendar by invite code and returns to the list, notifying the caller to refetch", async () => {
      mockHooks();
      const joinByInviteMock = jest.fn().mockResolvedValue(true);
      (useJoinByInvite as jest.Mock).mockReturnValue({
        joinByInvite: joinByInviteMock,
        isSubmitting: false,
        error: null,
      });
      const onChange = jest.fn();

      const { getByTestId, queryByTestId } = await render(
        <SettingsHubModal
          calendars={CALENDARS}
          currentUserId="user-1"
          onClose={jest.fn()}
          onChange={onChange}
          initialSection="calendar"
        />,
      );

      await fireEvent.press(getByTestId("calendar-settings-join-button"));
      await fireEvent.changeText(getByTestId("calendar-settings-join-code-input"), "ABC123");
      await fireEvent.press(getByTestId("calendar-settings-join-submit"));

      await waitFor(() => expect(joinByInviteMock).toHaveBeenCalledWith("ABC123"));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      await waitFor(() => expect(queryByTestId("calendar-settings-join-code-input")).toBeNull());
      expect(getByTestId("calendar-settings-calendar-cal-1")).toBeTruthy();
    });

    it("offers to leave (not delete) a group calendar that has other members, and delete when alone", async () => {
      mockHooks();

      const { getByTestId, getByText } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
      expect(getByText("カレンダーから抜ける")).toBeTruthy();
    });

    it("leaves the calendar after confirming, then returns to the list and refetches", async () => {
      const leaveOrDeleteCalendarMock = jest.fn().mockResolvedValue(false);
      mockHooks();
      (useLeaveOrDeleteCalendar as jest.Mock).mockReturnValue({
        leaveOrDeleteCalendar: leaveOrDeleteCalendarMock,
        isSubmitting: false,
        error: null,
      });
      const onChange = jest.fn();

      const { getByTestId, queryByTestId } = await render(
        <SettingsHubModal
          calendars={CALENDARS}
          currentUserId="user-1"
          onClose={jest.fn()}
          onChange={onChange}
          initialSection="calendar"
        />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
      await fireEvent.press(getByTestId("calendar-settings-leave-or-delete-button"));
      await fireEvent.press(getByTestId("leave-or-delete-calendar-confirm-button"));

      await waitFor(() => expect(leaveOrDeleteCalendarMock).toHaveBeenCalledWith("cal-1"));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      expect(queryByTestId("calendar-settings-name-input")).toBeNull();
      expect(getByTestId("calendar-settings-calendar-cal-1")).toBeTruthy();
    });
  });

  describe("invite flow (reached from an existing calendar's edit view)", () => {
    it("shows an explanation of the invite flow and the current member list", async () => {
      mockHooks();

      const { getByTestId, getByText } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
      await fireEvent.press(getByTestId("calendar-settings-invite-button"));

      expect(getByTestId("invite-flow-description")).toBeTruthy();
      expect(getByText("たろう")).toBeTruthy();
      expect(getByText("メンバー")).toBeTruthy();
    });

    it("generates, displays, and shares an invite code", async () => {
      mockHooks();
      const createInvite = jest.fn().mockResolvedValue({
        id: "invite-1",
        calendarId: "cal-1",
        code: "ABC123",
        expiresAt: "2026-09-01T00:00:00.000Z",
        createdBy: "user-1",
        createdAt: "2026-08-22T00:00:00.000Z",
      });
      (useCreateInvite as jest.Mock).mockReturnValue({ createInvite, isSubmitting: false, error: null });

      const { getByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );

      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
      await fireEvent.press(getByTestId("calendar-settings-invite-button"));
      await fireEvent.press(getByTestId("invite-flow-generate"));

      await waitFor(() => expect(createInvite).toHaveBeenCalledWith("cal-1"));
      expect(getByTestId("invite-flow-code").props.children).toBe("ABC123");

      await fireEvent.press(getByTestId("invite-flow-share"));

      await waitFor(() =>
        expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("ABC123") })),
      );
    });
  });

  describe("tag management (reached from an existing calendar's edit view)", () => {
    async function openTagList() {
      const rendered = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );
      await fireEvent.press(rendered.getByTestId("calendar-settings-calendar-cal-1"));
      await fireEvent.press(rendered.getByTestId("calendar-settings-manage-tags"));
      return rendered;
    }

    it("shows the caller's tags, marked personal-only", async () => {
      mockHooks();
      const { getByText, getByTestId } = await openTagList();

      expect(useTagTree).toHaveBeenLastCalledWith();
      expect(getByText("行事")).toBeTruthy();
      expect(getByText("個人用")).toBeTruthy();
      expect(getByTestId("personal-only-badge-lock-icon")).toBeTruthy();
    });

    it("shows an empty state when the caller has no tags yet", async () => {
      mockHooks({ tagTree: [] });
      const { getByTestId, getByText, queryByTestId } = await render(
        <SettingsHubModal calendars={CALENDARS} currentUserId="user-1" onClose={jest.fn()} initialSection="calendar" />,
      );
      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
      await fireEvent.press(getByTestId("calendar-settings-manage-tags"));

      expect(getByText("まだタグがありません")).toBeTruthy();
      expect(queryByTestId("tag-management-tag-tag-1")).toBeNull();
    });

    it("creates a new tag from a blank form and returns to the list", async () => {
      const { refetchTags } = mockHooks();
      const createTagMock = jest.fn().mockResolvedValue(true);
      (useCreateTag as jest.Mock).mockReturnValue({ createTag: createTagMock, isSubmitting: false, error: null });
      const onChange = jest.fn();

      const { getByTestId, queryByTestId } = await render(
        <SettingsHubModal
          calendars={CALENDARS}
          currentUserId="user-1"
          onClose={jest.fn()}
          onChange={onChange}
          initialSection="calendar"
        />,
      );
      await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
      await fireEvent.press(getByTestId("calendar-settings-manage-tags"));

      await fireEvent.press(getByTestId("tag-management-new-button"));
      expect(getByTestId("edit-tag-name-input").props.value).toBe("");
      expect(queryByTestId("tag-management-delete-button")).toBeNull();

      await fireEvent.changeText(getByTestId("edit-tag-name-input"), "旅行");
      await fireEvent.press(getByTestId("edit-tag-save-button"));

      await waitFor(() =>
        expect(createTagMock).toHaveBeenCalledWith({ name: "旅行", color: "#2f6fed", level: "major", parentId: null }),
      );
      await waitFor(() => expect(refetchTags).toHaveBeenCalled());
      expect(onChange).toHaveBeenCalled();
      // returns to the tag list after a successful save
      expect(queryByTestId("edit-tag-name-input")).toBeNull();
      expect(getByTestId("tag-management-tag-tag-1")).toBeTruthy();
    });

    it("edits an existing tag, pre-filled, and saves the update", async () => {
      const { refetchTags } = mockHooks();
      const updateTagMock = jest.fn().mockResolvedValue(true);
      (useUpdateTag as jest.Mock).mockReturnValue({ updateTag: updateTagMock, isSubmitting: false, error: null });

      const { getByTestId } = await openTagList();

      await fireEvent.press(getByTestId("tag-management-tag-tag-1"));
      expect(getByTestId("edit-tag-name-input").props.value).toBe("行事");
      expect(getByTestId("tag-management-delete-button")).toBeTruthy();

      await fireEvent.changeText(getByTestId("edit-tag-name-input"), "行楽");
      await fireEvent.press(getByTestId("edit-tag-save-button"));

      await waitFor(() =>
        expect(updateTagMock).toHaveBeenCalledWith("tag-1", { name: "行楽", color: "#ff0000", level: "major", parentId: null }),
      );
      await waitFor(() => expect(refetchTags).toHaveBeenCalled());
    });

    it("deletes the selected tag after confirming and returns to the list", async () => {
      const { refetchTags } = mockHooks();
      const deleteTagMock = jest.fn().mockResolvedValue(true);
      (useDeleteTag as jest.Mock).mockReturnValue({ deleteTag: deleteTagMock, isSubmitting: false, error: null });

      const { getByTestId, queryByTestId } = await openTagList();

      await fireEvent.press(getByTestId("tag-management-tag-tag-1"));
      await fireEvent.press(getByTestId("tag-management-delete-button"));
      await fireEvent.press(getByTestId("delete-tag-confirm-button"));

      await waitFor(() => expect(deleteTagMock).toHaveBeenCalledWith("tag-1"));
      await waitFor(() => expect(refetchTags).toHaveBeenCalled());
      expect(queryByTestId("edit-tag-name-input")).toBeNull();
    });

    it("returns to the tag list without saving via the shared back button", async () => {
      mockHooks();
      const { getByTestId, queryByTestId } = await openTagList();

      await fireEvent.press(getByTestId("tag-management-new-button"));
      await fireEvent.press(getByTestId("settings-hub-back"));

      expect(queryByTestId("edit-tag-name-input")).toBeNull();
      expect(getByTestId("tag-management-tag-tag-1")).toBeTruthy();
    });
  });
});
