import { Keyboard } from "react-native";
import { fireEvent, render, within } from "@testing-library/react-native";

import { EventFormFields, type EventFormValue } from "../EventFormFields";

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return function MockDateTimePicker({ testID, onChange, locale, mode }: any) {
    return React.createElement(TextInput, {
      testID,
      locale,
      mode,
      onChangeText: (text: string) => onChange({ type: "set" }, new Date(text)),
    });
  };
});

const BASE_VALUE: EventFormValue = {
  title: "",
  isAllDay: false,
  start: new Date("2026-09-01T09:00:00.000Z"),
  end: new Date("2026-09-01T10:00:00.000Z"),
  location: "",
  url: "",
  memo: "",
};

describe("EventFormFields", () => {
  it("calls onChange with the new title when the title input changes", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
    );

    await fireEvent.changeText(getByTestId("event-create-title-input"), "誕生日会");

    expect(onChange).toHaveBeenCalledWith({ title: "誕生日会" });
  });

  it("calls onChange with the toggled all-day flag", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
    );

    await fireEvent.press(getByTestId("event-create-allday-toggle"));

    expect(onChange).toHaveBeenCalledWith({ isAllDay: true });
  });

  function flattenStyle(style: unknown): Record<string, unknown> {
    return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
  }

  it("shows the all-day toggle as an off switch when isAllDay is false", async () => {
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
    );

    const flattened = flattenStyle(getByTestId("event-create-allday-switch").props.style);
    expect(flattened.backgroundColor).toBe("#d8d8dc");
  });

  it("shows the all-day toggle as an on switch when isAllDay is true", async () => {
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={{ ...BASE_VALUE, isAllDay: true }} onChange={jest.fn()} />
    );

    const flattened = flattenStyle(getByTestId("event-create-allday-switch").props.style);
    expect(flattened.backgroundColor).toBe("#2f6fed");
  });

  it("shows the start/end date and time in separate boxes when not all-day", async () => {
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
    );

    expect(within(getByTestId("event-create-start-button")).getByText("2026/09/01")).toBeTruthy();
    expect(within(getByTestId("event-create-start-time-button")).getByText("18:00")).toBeTruthy();
    expect(within(getByTestId("event-create-end-button")).getByText("2026/09/01")).toBeTruthy();
    expect(within(getByTestId("event-create-end-time-button")).getByText("19:00")).toBeTruthy();
  });

  it("has no time boxes when all-day", async () => {
    const { queryByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={{ ...BASE_VALUE, isAllDay: true }} onChange={jest.fn()} />
    );

    expect(queryByTestId("event-create-start-time-button")).toBeNull();
    expect(queryByTestId("event-create-end-time-button")).toBeNull();
  });

  it("shows the start/end labels without a time when all-day, and uses a date-only picker", async () => {
    const allDayValue: EventFormValue = {
      ...BASE_VALUE,
      isAllDay: true,
      end: new Date("2026-09-03T10:00:00.000Z"),
    };
    const { getByText, getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={allDayValue} onChange={jest.fn()} />
    );

    expect(getByText("2026/09/01")).toBeTruthy();
    expect(getByText("2026/09/03")).toBeTruthy();

    await fireEvent.press(getByTestId("event-create-start-button"));
    expect(getByTestId("event-create-start-picker")).toBeTruthy();
  });

  it("shows the picker and calls onChange with the new start date when picked", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
    );

    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-08-30T10:00:00.000Z");

    expect(onChange).toHaveBeenCalledWith({ start: new Date("2026-08-30T10:00:00.000Z") });
  });

  it("renders the native picker in Japanese so the month and weekday labels aren't English", async () => {
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
    );

    await fireEvent.press(getByTestId("event-create-start-button"));

    expect(getByTestId("event-create-start-picker").props.locale).toBe("ja-JP");
  });

  describe("編集中の日時フィールドの強調", () => {
    function borderColorOf(node: { props: { style?: unknown } }): unknown {
      return flattenStyle(node.props.style).borderColor;
    }

    it("does not highlight either field while no picker is open", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      expect(borderColorOf(getByTestId("event-create-start-button"))).toBe("#ccc");
      expect(borderColorOf(getByTestId("event-create-end-button"))).toBe("#ccc");
    });

    it("highlights only the 開始 field while its picker is open", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));

      expect(borderColorOf(getByTestId("event-create-start-button"))).toBe("#2f6fed");
      expect(borderColorOf(getByTestId("event-create-end-button"))).toBe("#ccc");
    });

    it("moves the highlight to the 終了 field when it is opened instead", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));
      await fireEvent.press(getByTestId("event-create-end-button"));

      expect(borderColorOf(getByTestId("event-create-start-button"))).toBe("#ccc");
      expect(borderColorOf(getByTestId("event-create-end-button"))).toBe("#2f6fed");
    });

    it("clears the highlight after 完了", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-end-button"));
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(borderColorOf(getByTestId("event-create-end-button"))).toBe("#ccc");
    });
  });

  it("calls onChange with the new location and url", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
    );

    await fireEvent.press(getByTestId("event-create-location-add"));
    await fireEvent.changeText(getByTestId("event-create-location-input"), "自宅");
    await fireEvent.press(getByTestId("event-create-url-add"));
    await fireEvent.changeText(getByTestId("event-create-url-input"), "https://example.com");

    expect(onChange).toHaveBeenCalledWith({ location: "自宅" });
    expect(onChange).toHaveBeenCalledWith({ url: "https://example.com" });
  });

  it("hides the location/url add buttons and shows the inputs directly when a value is already set", async () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <EventFormFields
        testIDPrefix="event-edit"
        value={{ ...BASE_VALUE, location: "渋谷", url: "https://example.com" }}
        onChange={onChange}
      />
    );

    expect(queryByTestId("event-edit-location-add")).toBeNull();
    expect(queryByTestId("event-edit-url-add")).toBeNull();
    expect(getByTestId("event-edit-location-input").props.value).toBe("渋谷");
    expect(getByTestId("event-edit-url-input").props.value).toBe("https://example.com");
  });

  it("calls onChange with the new memo, folded into a '+ メモを追加' button until touched, like location/url", async () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
    );

    expect(queryByTestId("event-create-memo-input")).toBeNull();

    await fireEvent.press(getByTestId("event-create-memo-add"));
    await fireEvent.changeText(getByTestId("event-create-memo-input"), "駅前で待ち合わせ");

    expect(onChange).toHaveBeenCalledWith({ memo: "駅前で待ち合わせ" });
  });

  it("shows the memo input directly (no add button) when a value is already set", async () => {
    const { getByTestId, queryByTestId } = await render(
      <EventFormFields testIDPrefix="event-edit" value={{ ...BASE_VALUE, memo: "持ち物: 名刺" }} onChange={jest.fn()} />
    );

    expect(queryByTestId("event-edit-memo-add")).toBeNull();
    expect(getByTestId("event-edit-memo-input").props.value).toBe("持ち物: 名刺");
  });

  it("uses the given testIDPrefix so create and edit forms don't collide", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-edit" value={BASE_VALUE} onChange={onChange} />
    );

    expect(getByTestId("event-edit-title-input")).toBeTruthy();
  });

  describe("日付と時刻を別々に開く", () => {
    it("opens a date-only picker when the date box is tapped", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));

      expect(getByTestId("event-create-start-picker").props.mode).toBe("date");
      expect(queryByTestId("event-create-start-time-picker")).toBeNull();
    });

    it("opens a time-only picker directly when the time box is tapped (no second tap)", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));

      expect(getByTestId("event-create-end-time-picker").props.mode).toBe("time");
      expect(queryByTestId("event-create-end-picker")).toBeNull();
    });

    it("passes the Japanese locale to the time picker too", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));

      expect(getByTestId("event-create-start-time-picker").props.locale).toBe("ja-JP");
    });

    it("highlights only the tapped box (time vs. date of the same row)", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));

      const border = (id: string) => flattenStyle(getByTestId(id).props.style).borderColor;
      expect(border("event-create-start-time-button")).toBe("#2f6fed");
      expect(border("event-create-start-button")).toBe("#ccc");
      expect(border("event-create-end-time-button")).toBe("#ccc");
    });

    it("switches from the date picker to the time picker of the same row with one tap", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));
      await fireEvent.press(getByTestId("event-create-start-time-button"));

      expect(queryByTestId("event-create-start-picker")).toBeNull();
      expect(getByTestId("event-create-start-time-picker")).toBeTruthy();
    });

    it("closes the picker after 完了", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(queryByTestId("event-create-start-time-picker")).toBeNull();
    });

    it("calls onChange with the new end time when the end time picker changes", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.changeText(getByTestId("event-create-end-time-picker"), "2026-09-01T11:00:00.000Z");
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledWith({ end: new Date("2026-09-01T11:00:00.000Z") });
    });
  });

  describe("キーボードとピッカーの排他", () => {
    it("dismisses the keyboard when a date box is tapped", async () => {
      const dismiss = jest.spyOn(Keyboard, "dismiss");
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));

      expect(dismiss).toHaveBeenCalled();
      dismiss.mockRestore();
    });

    it("dismisses the keyboard when a time box is tapped", async () => {
      const dismiss = jest.spyOn(Keyboard, "dismiss");
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));

      expect(dismiss).toHaveBeenCalled();
      dismiss.mockRestore();
    });

    it("closes the open picker when the title input is focused", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));
      await fireEvent(getByTestId("event-create-title-input"), "focus");

      expect(queryByTestId("event-create-start-picker")).toBeNull();
    });

    it("closes the open picker when the location, url or memo input is focused", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields
          testIDPrefix="event-edit"
          value={{ ...BASE_VALUE, location: "渋谷", url: "https://example.com", memo: "メモ" }}
          onChange={jest.fn()}
        />
      );

      for (const field of ["location", "url", "memo"]) {
        await fireEvent.press(getByTestId("event-edit-end-time-button"));
        expect(getByTestId("event-edit-end-time-picker")).toBeTruthy();

        await fireEvent(getByTestId(`event-edit-${field}-input`), "focus");

        expect(queryByTestId("event-edit-end-time-picker")).toBeNull();
      }
    });

    it("closes the open picker when a field is revealed with its add button (it autofocuses)", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));
      await fireEvent.press(getByTestId("event-create-location-add"));
      await fireEvent(getByTestId("event-create-location-input"), "focus");

      expect(queryByTestId("event-create-start-picker")).toBeNull();
    });
  });

  describe("終了日時の自動補正", () => {
    it("also moves the end to the start's day when the start date is moved past the end date", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));
      await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-09-05T09:00:00.000Z");

      expect(onChange).toHaveBeenCalledWith({
        start: new Date("2026-09-05T09:00:00.000Z"),
        end: new Date("2026-09-05T10:00:00.000Z"),
      });
    });

    it("sets the end to one hour after the start when the start time passes the end time on the same day", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await fireEvent.changeText(getByTestId("event-create-start-time-picker"), "2026-09-01T13:00:00.000Z");
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledWith({
        start: new Date("2026-09-01T13:00:00.000Z"),
        end: new Date("2026-09-01T14:00:00.000Z"),
      });
    });

    it("changes only the start when it stays before the end", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await fireEvent.changeText(getByTestId("event-create-start-time-picker"), "2026-09-01T09:30:00.000Z");
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledWith({ start: new Date("2026-09-01T09:30:00.000Z") });
    });

    it("moves an all-day end to the start day when the start day passes it", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields
          testIDPrefix="event-create"
          value={{ ...BASE_VALUE, isAllDay: true, start: new Date("2026-09-01T00:00:00.000Z"), end: new Date("2026-09-02T00:00:00.000Z") }}
          onChange={onChange}
        />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));
      await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-09-08T00:00:00.000Z");

      expect(onChange).toHaveBeenCalledWith({
        start: new Date("2026-09-08T00:00:00.000Z"),
        end: new Date("2026-09-08T00:00:00.000Z"),
      });
    });

    it("does not touch the start when the end is edited", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-button"));
      await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-08-30T10:00:00.000Z");

      expect(onChange).toHaveBeenCalledWith({ end: new Date("2026-08-30T10:00:00.000Z") });
    });
  });

  describe("時刻は完了を押してから反映する", () => {
    it("does not call onChange while the time picker is being spun, only after 完了", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.changeText(getByTestId("event-create-end-time-picker"), "2026-09-01T11:00:00.000Z");

      expect(onChange).not.toHaveBeenCalled();

      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ end: new Date("2026-09-01T11:00:00.000Z") });
    });

    it("commits only the last spun time on 完了", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.changeText(getByTestId("event-create-end-time-picker"), "2026-09-01T11:00:00.000Z");
      await fireEvent.changeText(getByTestId("event-create-end-time-picker"), "2026-09-01T12:30:00.000Z");
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ end: new Date("2026-09-01T12:30:00.000Z") });
    });

    it("does not call onChange on 完了 when the time was not spun", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("discards a spun-but-not-confirmed time when another box is tapped instead of 完了", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.changeText(getByTestId("event-create-end-time-picker"), "2026-09-01T11:00:00.000Z");
      await fireEvent.press(getByTestId("event-create-start-button"));
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("still applies a picked date immediately (the date calendar has no 完了 requirement)", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-button"));
      await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-09-02T10:00:00.000Z");

      expect(onChange).toHaveBeenCalledWith({ end: new Date("2026-09-02T10:00:00.000Z") });
    });
  });
});
