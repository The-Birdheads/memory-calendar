import { fireEvent, render } from "@testing-library/react-native";

import { CATEGORY_COLORS, EventFormFields, type EventFormValue } from "../EventFormFields";

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
  categoryColor: CATEGORY_COLORS[0].hex,
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

    await fireEvent.changeText(getByTestId("event-create-location-input"), "自宅");
    await fireEvent.changeText(getByTestId("event-create-url-input"), "https://example.com");

    expect(onChange).toHaveBeenCalledWith({ location: "自宅" });
    expect(onChange).toHaveBeenCalledWith({ url: "https://example.com" });
  });

  it("calls onChange with the selected category color", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-create" value={BASE_VALUE} onChange={onChange} />
    );

    await fireEvent.press(getByTestId("event-create-color-green"));

    expect(onChange).toHaveBeenCalledWith({ categoryColor: "#43a047" });
  });

  it("uses the given testIDPrefix so create and edit forms don't collide", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <EventFormFields testIDPrefix="event-edit" value={BASE_VALUE} onChange={onChange} />
    );

    expect(getByTestId("event-edit-title-input")).toBeTruthy();
  });
});
