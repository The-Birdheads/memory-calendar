import { fireEvent, render } from "@testing-library/react-native";

import { RELEASE_NOTES } from "../../releases";
import { ReleaseNotesModal } from "../ReleaseNotesModal";

describe("ReleaseNotesModal", () => {
  it("lists every release with its version and each item's title and body", async () => {
    const { getByText, getByTestId } = await render(<ReleaseNotesModal visible onClose={jest.fn()} />);

    for (const note of RELEASE_NOTES) {
      expect(getByTestId(`release-notes-${note.version}`)).toBeTruthy();
      expect(getByText(`バージョン ${note.version}`)).toBeTruthy();
      for (const item of note.items) {
        expect(getByText(item.title)).toBeTruthy();
        expect(getByText(item.body)).toBeTruthy();
      }
    }
  });

  it("calls onClose from the close button", async () => {
    const onClose = jest.fn();
    const { getByTestId } = await render(<ReleaseNotesModal visible onClose={onClose} />);

    await fireEvent.press(getByTestId("release-notes-close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing visible when not visible", async () => {
    const { queryByTestId } = await render(<ReleaseNotesModal visible={false} onClose={jest.fn()} />);

    expect(queryByTestId("release-notes-close")).toBeNull();
  });
});
