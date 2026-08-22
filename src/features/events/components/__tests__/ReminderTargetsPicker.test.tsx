import { fireEvent, render } from "@testing-library/react-native";

import { ReminderTargetsPicker } from "../ReminderTargetsPicker";

const MEMBER_USER_IDS = ["user-1", "user-2"];

describe("ReminderTargetsPicker", () => {
  it("shows the all-members option as checked when value is 'all'", async () => {
    const { getByTestId } = await render(
      <ReminderTargetsPicker memberUserIds={MEMBER_USER_IDS} value="all" onChange={jest.fn()} />
    );

    expect(getByTestId("reminder-target-all-checked")).toBeTruthy();
  });

  it("shows only the selected members as checked when value is a member id list", async () => {
    const { getByTestId, queryByTestId } = await render(
      <ReminderTargetsPicker memberUserIds={MEMBER_USER_IDS} value={["user-2"]} onChange={jest.fn()} />
    );

    expect(getByTestId("reminder-target-member-user-2-checked")).toBeTruthy();
    expect(queryByTestId("reminder-target-member-user-1-checked")).toBeNull();
    expect(queryByTestId("reminder-target-all-checked")).toBeNull();
  });

  it("calls onChange with 'all' when the all-members option is pressed", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <ReminderTargetsPicker memberUserIds={MEMBER_USER_IDS} value={["user-1"]} onChange={onChange} />
    );

    await fireEvent.press(getByTestId("reminder-target-all"));

    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("switches from 'all' to a single member when a member is pressed", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <ReminderTargetsPicker memberUserIds={MEMBER_USER_IDS} value="all" onChange={onChange} />
    );

    await fireEvent.press(getByTestId("reminder-target-member-user-1"));

    expect(onChange).toHaveBeenCalledWith(["user-1"]);
  });

  it("adds a member to the current selection when pressed", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <ReminderTargetsPicker memberUserIds={MEMBER_USER_IDS} value={["user-1"]} onChange={onChange} />
    );

    await fireEvent.press(getByTestId("reminder-target-member-user-2"));

    expect(onChange).toHaveBeenCalledWith(["user-1", "user-2"]);
  });

  it("removes a member from the current selection when pressed again", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <ReminderTargetsPicker
        memberUserIds={MEMBER_USER_IDS}
        value={["user-1", "user-2"]}
        onChange={onChange}
      />
    );

    await fireEvent.press(getByTestId("reminder-target-member-user-1"));

    expect(onChange).toHaveBeenCalledWith(["user-2"]);
  });
});
