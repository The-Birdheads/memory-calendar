import { fireEvent, render } from "@testing-library/react-native";

import { EventDetailModal } from "../EventDetailModal";

jest.mock("../EventDetailContent", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    EventDetailContent: ({
      eventId,
      onBack,
      onDeleted,
      showGoToCalendarButton,
    }: {
      eventId: string;
      onBack: () => void;
      onDeleted: () => void;
      showGoToCalendarButton?: boolean;
    }) => (
      <TouchableOpacity testID="mock-event-detail-content" onPress={onBack}>
        <Text>{eventId}</Text>
        <Text>{showGoToCalendarButton ? "go-to-calendar-shown" : "go-to-calendar-hidden"}</Text>
        <TouchableOpacity testID="mock-event-detail-deleted" onPress={onDeleted}>
          <Text>deleted</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    ),
  };
});

describe("EventDetailModal", () => {
  it("renders nothing when eventId is null", async () => {
    const { queryByTestId } = await render(<EventDetailModal eventId={null} onClose={jest.fn()} />);

    expect(queryByTestId("mock-event-detail-content")).toBeNull();
  });

  it("shows EventDetailContent for the given event, with the go-to-calendar button always shown (this is never the calendar screen itself)", async () => {
    const { getByTestId, getByText } = await render(
      <EventDetailModal eventId="event-1" onClose={jest.fn()} />
    );

    expect(getByTestId("mock-event-detail-content")).toBeTruthy();
    expect(getByText("event-1")).toBeTruthy();
    expect(getByText("go-to-calendar-shown")).toBeTruthy();
  });

  it("calls onClose when the content's back button is pressed", async () => {
    const onClose = jest.fn();
    const { getByTestId } = await render(<EventDetailModal eventId="event-1" onClose={onClose} />);

    await fireEvent.press(getByTestId("mock-event-detail-content"));

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the event is deleted", async () => {
    const onClose = jest.fn();
    const { getByTestId } = await render(<EventDetailModal eventId="event-1" onClose={onClose} />);

    await fireEvent.press(getByTestId("mock-event-detail-deleted"));

    expect(onClose).toHaveBeenCalled();
  });
});
