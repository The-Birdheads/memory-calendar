import { render } from "@testing-library/react-native";

import { useAvatarUrls } from "../../../profile/avatarHooks";
import { AssigneeAvatars } from "../AssigneeAvatars";

jest.mock("../../../profile/avatarHooks", () => ({
  useAvatarUrls: jest.fn(),
}));

const TARO = { userId: "user-1", displayName: "たろう", avatarPath: null };
const HANAKO = { userId: "user-2", displayName: "はなこ", avatarPath: "user-2/1.jpg" };

beforeEach(() => {
  (useAvatarUrls as jest.Mock).mockReturnValue({});
});
afterEach(() => jest.clearAllMocks());

describe("AssigneeAvatars", () => {
  it("renders nothing when nobody is assigned", async () => {
    const { queryByTestId } = await render(<AssigneeAvatars testID="assignees" assignees={[]} />);

    expect(queryByTestId("assignees")).toBeNull();
  });

  it("shows the initial icon for someone without an image", async () => {
    const { getByText, getByTestId } = await render(<AssigneeAvatars testID="assignees" assignees={[TARO]} />);

    expect(getByTestId("assignees")).toBeTruthy();
    expect(getByText("た")).toBeTruthy();
  });

  it("shows the registered image for someone who has one", async () => {
    (useAvatarUrls as jest.Mock).mockReturnValue({ "user-2/1.jpg": "https://signed/hanako" });

    const { getByTestId } = await render(<AssigneeAvatars testID="assignees" assignees={[HANAKO]} />);

    expect(getByTestId("assignees-user-2-image").props.source).toEqual({ uri: "https://signed/hanako" });
  });

  it("falls back to the initial while the image url is not resolved yet", async () => {
    const { getByText, queryByTestId } = await render(<AssigneeAvatars testID="assignees" assignees={[HANAKO]} />);

    expect(getByText("は")).toBeTruthy();
    expect(queryByTestId("assignees-user-2-image")).toBeNull();
  });

  it("asks for the urls of the assignees' images only", async () => {
    await render(<AssigneeAvatars testID="assignees" assignees={[TARO, HANAKO]} />);

    expect(useAvatarUrls).toHaveBeenCalledWith(["user-2/1.jpg"]);
  });

  it("shows up to 3 icons and a +N for the rest", async () => {
    const many = [1, 2, 3, 4, 5].map((n) => ({ userId: `user-${n}`, displayName: `名前${n}`, avatarPath: null }));

    const { getByTestId, queryByTestId, getByText } = await render(<AssigneeAvatars testID="assignees" assignees={many} />);

    expect(getByTestId("assignees-user-1")).toBeTruthy();
    expect(getByTestId("assignees-user-3")).toBeTruthy();
    expect(queryByTestId("assignees-user-4")).toBeNull();
    expect(getByText("+2")).toBeTruthy();
  });
});
