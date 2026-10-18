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

  it("shows the date and the typed-in time in separate boxes (date above time) for both start and end when not all-day", async () => {
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
    );

    expect(within(getByTestId("event-create-start-button")).getByText("2026/09/01")).toBeTruthy();
    expect(getByTestId("event-create-start-time-hour-text").props.children).toBe("18");
    expect(getByTestId("event-create-start-time-minute-text").props.children).toBe("00");
    expect(within(getByTestId("event-create-end-button")).getByText("2026/09/01")).toBeTruthy();
    expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("19");
    expect(getByTestId("event-create-end-time-minute-text").props.children).toBe("00");
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

  // テンキーで数字を順に押す。which/field は、入力する欄(時/分)を先に選ぶために使う。
  async function typeDigits(
    getByTestId: (id: string) => unknown,
    which: "start" | "end",
    field: "hour" | "minute",
    digits: string
  ) {
    await fireEvent.press(getByTestId(`event-create-${which}-time-${field}`) as never);
    for (const digit of digits) {
      await fireEvent.press(getByTestId(`event-create-keypad-key-${digit}`) as never);
    }
  }

  describe("日付と時刻を別々に開く", () => {
    it("opens a date-only picker when the date box is tapped", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));

      expect(getByTestId("event-create-start-picker").props.mode).toBe("date");
    });

    it("starts time editing straight from the time box (no calendar), with the app's own keypad below", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));

      expect(queryByTestId("event-create-end-picker")).toBeNull();
      expect(getByTestId("event-create-keypad-key-7")).toBeTruthy();
      expect(getByTestId("event-create-keypad-key-00")).toBeTruthy();
      expect(getByTestId("event-create-keypad-key-30")).toBeTruthy();
      expect(getByTestId("event-create-picker-done")).toBeTruthy();
    });

    it("also starts time editing when the hour or minute itself is pressed", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-minute"));

      expect(getByTestId("event-create-picker-done")).toBeTruthy();
    });

    it("highlights only the tapped box (time vs. date of the same column)", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));

      const border = (id: string) => flattenStyle(getByTestId(id).props.style).borderColor;
      expect(border("event-create-start-time-button")).toBe("#2f6fed");
      expect(border("event-create-start-button")).toBe("#ccc");
      expect(border("event-create-end-time-button")).toBe("#ccc");
    });

    it("switches from the date calendar to time editing of the same column with one tap", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));
      await fireEvent.press(getByTestId("event-create-start-time-button"));

      expect(queryByTestId("event-create-start-picker")).toBeNull();
    });

    it("closes the editing state after 完了", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(queryByTestId("event-create-picker-done")).toBeNull();
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

    it("dismisses the system keyboard when a time box is tapped (the app's own keypad is used instead)", async () => {
      const dismiss = jest.spyOn(Keyboard, "dismiss");
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));

      expect(dismiss).toHaveBeenCalled();
      dismiss.mockRestore();
    });

    it("closes the open calendar when the title input is focused", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-button"));
      await fireEvent(getByTestId("event-create-title-input"), "focus");

      expect(queryByTestId("event-create-start-picker")).toBeNull();
    });

    it("ends time editing when the title input is focused", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await fireEvent(getByTestId("event-create-title-input"), "focus");

      expect(queryByTestId("event-create-picker-done")).toBeNull();
    });

    it("closes the open calendar when the location, url or memo input is focused", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields
          testIDPrefix="event-edit"
          value={{ ...BASE_VALUE, location: "渋谷", url: "https://example.com", memo: "メモ" }}
          onChange={jest.fn()}
        />
      );

      for (const field of ["location", "url", "memo"]) {
        await fireEvent.press(getByTestId("event-edit-end-button"));
        expect(getByTestId("event-edit-end-picker")).toBeTruthy();

        await fireEvent(getByTestId(`event-edit-${field}-input`), "focus");

        expect(queryByTestId("event-edit-end-picker")).toBeNull();
      }
    });

    it("closes the open calendar when a field is revealed with its add button (it autofocuses)", async () => {
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

    it("sets the end to one hour after the start when the typed start time passes the end time on the same day", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      // 開始 18:00 -> 22:30(JST)。終了は 19:00 のまま同じ日なので、開始の1時間後(23:30)になる。
      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await typeDigits(getByTestId, "start", "hour", "22");
      await typeDigits(getByTestId, "start", "minute", "30");
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledWith({
        start: new Date("2026-09-01T13:30:00.000Z"),
        end: new Date("2026-09-01T14:30:00.000Z"),
      });
    });

    it("changes only the start when the typed start time stays before the end", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      // 開始 18:00 -> 17:30(JST)
      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await typeDigits(getByTestId, "start", "hour", "17");
      await typeDigits(getByTestId, "start", "minute", "30");
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledWith({ start: new Date("2026-09-01T08:30:00.000Z") });
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

  describe("時刻のテンキー入力と、完了での反映", () => {
    it("shows the typed digits right away in the time box, but does not call onChange until 完了", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await typeDigits(getByTestId, "end", "hour", "21");

      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("21");
      expect(onChange).not.toHaveBeenCalled();

      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ end: new Date("2026-09-01T12:00:00.000Z") });
    });

    it("applies hour and minute typed together as one change on 完了", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await typeDigits(getByTestId, "end", "hour", "20");
      await typeDigits(getByTestId, "end", "minute", "45");
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ end: new Date("2026-09-01T11:45:00.000Z") });
    });

    it("does not call onChange on 完了 when nothing was typed", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps the typed hour while selecting the minute of the same time field", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await typeDigits(getByTestId, "end", "hour", "21");
      await fireEvent.press(getByTestId("event-create-end-time-minute"));

      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("21");
    });

    it("keeps typed-but-not-confirmed digits when the date calendar is opened, and applies them on that panel's 完了", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await typeDigits(getByTestId, "end", "hour", "21");
      await fireEvent.press(getByTestId("event-create-start-button"));

      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("21");
      expect(onChange).not.toHaveBeenCalled();

      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledWith({ end: new Date("2026-09-01T12:00:00.000Z") });
    });

    it("treats a 3 for the hour as 03 and moves on to the minutes, so the next digits go to the minutes", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.press(getByTestId("event-create-keypad-key-3"));
      await fireEvent.press(getByTestId("event-create-keypad-key-4"));
      await fireEvent.press(getByTestId("event-create-keypad-key-5"));

      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("03");
      expect(getByTestId("event-create-end-time-minute-text").props.children).toBe("45");
    });

    it("moves on to the minutes after two hour digits, so the following digits edit the minutes", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      for (const digit of ["2", "1", "5", "0"]) {
        await fireEvent.press(getByTestId(`event-create-keypad-key-${digit}`));
      }

      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("21");
      expect(getByTestId("event-create-end-time-minute-text").props.children).toBe("50");
    });

    it("ignores a second hour digit that would make the hour exceed 23", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.press(getByTestId("event-create-keypad-key-2"));
      await fireEvent.press(getByTestId("event-create-keypad-key-5"));

      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("02");
    });

    it("sets the minutes with the 30 key (after typing the hour), and applies both on 完了", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.press(getByTestId("event-create-keypad-key-2"));
      await fireEvent.press(getByTestId("event-create-keypad-key-0"));
      await fireEvent.press(getByTestId("event-create-keypad-key-30"));
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledWith({ end: new Date("2026-09-01T11:30:00.000Z") });
    });

    it("sets the minutes to 00 with the 00 key while the minute is the selected field", async () => {
      const { getByTestId } = await render(
        <EventFormFields
          testIDPrefix="event-create"
          value={{ ...BASE_VALUE, end: new Date("2026-09-01T10:45:00.000Z") }}
          onChange={jest.fn()}
        />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.press(getByTestId("event-create-end-time-minute"));
      await fireEvent.press(getByTestId("event-create-keypad-key-00"));

      expect(getByTestId("event-create-end-time-minute-text").props.children).toBe("00");
    });

    it("puts 00 into the hour (00 exists) when the hour is the selected field, and moves on to the minutes", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.press(getByTestId("event-create-keypad-key-00"));

      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("00");
      // 続けて押した数字は分に入る(分の欄へ移っている)。
      await fireEvent.press(getByTestId("event-create-keypad-key-4"));
      expect(getByTestId("event-create-end-time-minute-text").props.children).toBe("04");
    });

    it("ignores the 30 key while the hour is the selected field: nothing changes and the field does not move", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await fireEvent.press(getByTestId("event-create-keypad-key-30"));

      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("19");
      expect(getByTestId("event-create-end-time-minute-text").props.children).toBe("00");
      // まだ時の欄: 次の数字は時に入る。
      await fireEvent.press(getByTestId("event-create-keypad-key-2"));
      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("02");
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

  describe("開始から終了へ進む入力と、まとめての確定・キャンセル", () => {
    async function pressKeys(getByTestId: (id: string) => unknown, keys: string[]) {
      for (const key of keys) {
        await fireEvent.press(getByTestId(`event-create-keypad-key-${key}`) as never);
      }
    }

    it("moves on to the end time's hour automatically once the start minutes are entered", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      // 開始 20:15 を入力し終えたら、続く数字は終了の時に入る。
      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await pressKeys(getByTestId, ["2", "0", "1", "5", "2", "1"]);

      expect(getByTestId("event-create-start-time-hour-text").props.children).toBe("20");
      expect(getByTestId("event-create-start-time-minute-text").props.children).toBe("15");
      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("21");
    });

    it("also moves on to the end time after the 00 or 30 shortcut on the start time", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await pressKeys(getByTestId, ["2", "0", "30", "2", "2"]);

      expect(getByTestId("event-create-start-time-minute-text").props.children).toBe("30");
      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("22");
    });

    it("highlights the end time box once it has been moved on to", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await pressKeys(getByTestId, ["2", "0", "00"]);

      const border = (id: string) => flattenStyle(getByTestId(id).props.style).borderColor;
      expect(border("event-create-end-time-button")).toBe("#2f6fed");
      expect(border("event-create-start-time-button")).toBe("#ccc");
    });

    it("stays on the end minutes after they are entered (nothing comes after the end time)", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await pressKeys(getByTestId, ["2", "1", "4", "5"]);

      const border = (id: string) => flattenStyle(getByTestId(id).props.style).borderColor;
      expect(border("event-create-end-time-button")).toBe("#2f6fed");
      expect(getByTestId("event-create-end-time-minute-text").props.children).toBe("45");
    });

    it("applies the start and the end time together in one change on 完了", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      // 開始 20:15 / 終了 21:45
      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await pressKeys(getByTestId, ["2", "0", "1", "5", "2", "1", "4", "5"]);
      expect(onChange).not.toHaveBeenCalled();
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        start: new Date("2026-09-01T11:15:00.000Z"),
        end: new Date("2026-09-01T12:45:00.000Z"),
      });
    });

    it("keeps the typed start time when the end time is selected afterwards, instead of discarding it", async () => {
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await pressKeys(getByTestId, ["2", "0", "00"]);
      await fireEvent.press(getByTestId("event-create-end-time-minute"));

      expect(getByTestId("event-create-start-time-hour-text").props.children).toBe("20");
    });

    it("corrects the end when both are typed and the end ends up before the start", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      // 開始 22:00 / 終了 21:00(同じ日)-> 終了は開始の1時間後(23:00)に補正される。
      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await pressKeys(getByTestId, ["2", "2", "00", "2", "1", "00"]);
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledWith({
        start: new Date("2026-09-01T13:00:00.000Z"),
        end: new Date("2026-09-01T14:00:00.000Z"),
      });
    });

    it("discards everything typed (start and end) with キャンセル, and closes the keypad", async () => {
      const onChange = jest.fn();
      const { getByTestId, queryByTestId } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-start-time-button"));
      await pressKeys(getByTestId, ["2", "0", "00", "2", "1"]);
      await fireEvent.press(getByTestId("event-create-picker-cancel"));

      expect(onChange).not.toHaveBeenCalled();
      expect(queryByTestId("event-create-picker-done")).toBeNull();
      expect(getByTestId("event-create-start-time-hour-text").props.children).toBe("18");
      expect(getByTestId("event-create-end-time-hour-text").props.children).toBe("19");
    });

    it("applies the typed time to the current date even when the date is changed meanwhile", async () => {
      const onChange = jest.fn();
      const { getByTestId, rerender } = await render(
        <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
      );

      await fireEvent.press(getByTestId("event-create-end-time-button"));
      await pressKeys(getByTestId, ["2", "1", "00"]);
      await rerender(
        <EventFormFields
          testIDPrefix="event-create"
          value={{ ...BASE_VALUE, end: new Date("2026-09-03T10:00:00.000Z") }}
          onChange={onChange}
        />
      );
      await fireEvent.press(getByTestId("event-create-picker-done"));

      expect(onChange).toHaveBeenCalledWith({ end: new Date("2026-09-03T12:00:00.000Z") });
    });
  });
});
