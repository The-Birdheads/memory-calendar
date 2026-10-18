import { fireEvent, render } from "@testing-library/react-native";

import { useAvatarUrls } from "../../../profile/avatarHooks";
import { AssigneePicker } from "../AssigneePicker";

jest.mock("../../../profile/avatarHooks", () => ({
  useAvatarUrls: jest.fn(),
}));

const MEMBERS = [
  { userId: "user-1", displayName: "たろう", avatarPath: null },
  { userId: "user-2", displayName: "はなこ", avatarPath: "user-2/1.jpg" },
  { userId: "user-3", displayName: null, avatarPath: null },
];

beforeEach(() => {
  (useAvatarUrls as jest.Mock).mockReturnValue({});
});
afterEach(() => jest.clearAllMocks());

describe("AssigneePicker", () => {
  it("labels the section as optional", async () => {
    const { getByText } = await render(
      <AssigneePicker testIDPrefix="assignee" members={MEMBERS} selectedIds={[]} currentUserId="user-1" onToggle={jest.fn()} />
    );

    expect(getByText("対象者(任意)")).toBeTruthy();
  });

  it("lists every member of the calendar with their name", async () => {
    const { getByText, getByTestId } = await render(
      <AssigneePicker testIDPrefix="assignee" members={MEMBERS} selectedIds={[]} currentUserId="user-1" onToggle={jest.fn()} />
    );

    expect(getByTestId("assignee-member-user-1")).toBeTruthy();
    expect(getByTestId("assignee-member-user-2")).toBeTruthy();
    expect(getByTestId("assignee-member-user-3")).toBeTruthy();
    expect(getByText("たろう")).toBeTruthy();
    expect(getByText("はなこ")).toBeTruthy();
  });

  it("names a member without a display name 'メンバー', or 自分 for the current user", async () => {
    const { getByText } = await render(
      <AssigneePicker
        testIDPrefix="assignee"
        members={[
          { userId: "user-1", displayName: null, avatarPath: null },
          { userId: "user-3", displayName: null, avatarPath: null },
        ]}
        selectedIds={[]}
        currentUserId="user-1"
        onToggle={jest.fn()}
      />
    );

    expect(getByText("自分")).toBeTruthy();
    expect(getByText("メンバー")).toBeTruthy();
  });

  it("marks the selected members and not the others", async () => {
    const { getByTestId, queryByTestId } = await render(
      <AssigneePicker testIDPrefix="assignee" members={MEMBERS} selectedIds={["user-2"]} currentUserId="user-1" onToggle={jest.fn()} />
    );

    expect(getByTestId("assignee-member-user-2-checked")).toBeTruthy();
    expect(queryByTestId("assignee-member-user-1-checked")).toBeNull();
  });

  it("calls onToggle with the tapped member's id", async () => {
    const onToggle = jest.fn();
    const { getByTestId } = await render(
      <AssigneePicker testIDPrefix="assignee" members={MEMBERS} selectedIds={[]} currentUserId="user-1" onToggle={onToggle} />
    );

    await fireEvent.press(getByTestId("assignee-member-user-2"));

    expect(onToggle).toHaveBeenCalledWith("user-2");
  });

  it("shows each member's registered image, or their initial", async () => {
    (useAvatarUrls as jest.Mock).mockReturnValue({ "user-2/1.jpg": "https://signed/hanako" });

    const { getByTestId, getByText } = await render(
      <AssigneePicker testIDPrefix="assignee" members={MEMBERS} selectedIds={[]} currentUserId="user-1" onToggle={jest.fn()} />
    );

    expect(getByTestId("assignee-member-user-2-avatar-image").props.source).toEqual({ uri: "https://signed/hanako" });
    // たろう: テキストは名前と頭文字の2か所に出る
    expect(getByText("た")).toBeTruthy();
  });
});
