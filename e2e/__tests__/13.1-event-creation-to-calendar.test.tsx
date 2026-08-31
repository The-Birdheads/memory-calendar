import { fireEvent, render, waitFor } from "@testing-library/react-native";

import CalendarScreen from "../../app/(tabs)/calendar";
import { useAuthSession } from "../../src/features/auth/hooks";
import {
  useCalendarMembers,
  useCreateCalendar,
  useCreateInvite,
  useJoinByInvite,
  useMyCalendars,
  useRemoveMember,
} from "../../src/features/calendars/hooks";
import { getSupabaseClient } from "../../src/shared/api/supabaseClient";
import { useAttachTagsToEvent, useCreateTag, useTagTree } from "../../src/features/tags/hooks";
import { createFakeSupabaseClient } from "../testUtils/fakeSupabaseClient";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: jest.fn().mockReturnValue({}),
}));

jest.mock("../../src/shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../../src/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
  useCalendarMembers: jest.fn(),
  useRemoveMember: jest.fn(),
  useCreateCalendar: jest.fn(),
  useCreateInvite: jest.fn(),
  useJoinByInvite: jest.fn(),
}));

jest.mock("../../src/features/tags/hooks", () => ({
  useTagTree: jest.fn(),
  useCreateTag: jest.fn(),
  useAttachTagsToEvent: jest.fn(),
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return function MockDateTimePicker({ testID, onChange }: any) {
    return React.createElement(TextInput, {
      testID,
      onChangeText: (text: string) => onChange({ type: "set" }, new Date(text)),
    });
  };
});

const CALENDARS = [{ id: "cal-1", name: "我が家", createdBy: "user-1", createdAt: "2026-08-01T00:00:00.000Z" }];

describe("13.1 予定作成からカレンダー月表示への反映", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-15T09:00:00.000Z"));

    (useAuthSession as jest.Mock).mockReturnValue({ session: { user: { id: "user-1" } } });
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null, refetch: jest.fn() });
    (useCalendarMembers as jest.Mock).mockReturnValue({
      members: [{ calendarId: "cal-1", userId: "user-1", role: "owner", joinedAt: "2026-08-01T00:00:00.000Z" }],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useRemoveMember as jest.Mock).mockReturnValue({ removeMember: jest.fn(), isSubmitting: false, error: null });
    (useCreateCalendar as jest.Mock).mockReturnValue({ createCalendar: jest.fn(), isSubmitting: false, error: null });
    (useCreateInvite as jest.Mock).mockReturnValue({ createInvite: jest.fn(), isSubmitting: false, error: null });
    (useJoinByInvite as jest.Mock).mockReturnValue({ joinByInvite: jest.fn(), isSubmitting: false, error: null });
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: [], isLoading: false, error: null, refetch: jest.fn() });
    (useCreateTag as jest.Mock).mockReturnValue({ createTag: jest.fn(), isSubmitting: false, error: null });
    (useAttachTagsToEvent as jest.Mock).mockReturnValue({
      attachTagsToEvent: jest.fn(),
      isSubmitting: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("reflects a newly created event in the calendar's month view without a page reload", async () => {
    const fakeClient = createFakeSupabaseClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(fakeClient);

    const { getByTestId, getByText, queryByText } = await render(<CalendarScreen />);

    expect(queryByText("誕生日会")).toBeNull();

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "誕生日会");

    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-09-15T10:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-end-button"));
    await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-09-15T12:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() => expect(getByText("誕生日会")).toBeTruthy());
    expect(fakeClient.getTable("events")).toHaveLength(1);
    expect(fakeClient.getTable("events")[0]).toMatchObject({ calendar_id: "cal-1", title: "誕生日会" });
  });
});
