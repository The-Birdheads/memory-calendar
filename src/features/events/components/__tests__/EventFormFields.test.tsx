import { fireEvent, render } from "@testing-library/react-native";

import { EventFormFields, type EventFormValue } from "../EventFormFields";

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

const BASE_VALUE: EventFormValue = {
  title: "",
  isAllDay: false,
  start: new Date("2026-09-01T09:00:00.000Z"),
  end: new Date("2026-09-01T10:00:00.000Z"),
  location: "",
  url: "",
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

  it("shows the start/end labels with a time when not all-day", async () => {
    const { getByText } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={jest.fn()} />
    );

    expect(getByText("2026/09/01 18:00")).toBeTruthy();
    expect(getByText("2026/09/01 19:00")).toBeTruthy();
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
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-09-05T10:00:00.000Z");

    expect(onChange).toHaveBeenCalledWith({ start: new Date("2026-09-05T10:00:00.000Z") });
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

  it("uses the given testIDPrefix so create and edit forms don't collide", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-edit" value={BASE_VALUE} onChange={onChange} />
    );

    expect(getByTestId("event-edit-title-input")).toBeTruthy();
  });
});
