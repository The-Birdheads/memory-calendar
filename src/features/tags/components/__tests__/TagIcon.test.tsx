import { render } from "@testing-library/react-native";

import { Icon } from "../../../../shared/components/Icon";
import { TagIcon } from "../TagIcon";

describe("TagIcon", () => {
  it("renders exactly the same image as the tag mark on event rows (<Icon name=\"tag\" />), so the app has a single tag glyph", async () => {
    const tagIcon = await render(<TagIcon size={18} color="#444" />);
    const rowMark = await render(<Icon name="tag" size={18} color="#444" />);

    expect(JSON.stringify(tagIcon.toJSON())).toBe(JSON.stringify(rowMark.toJSON()));
  });

  it("passes size and color through to the image", async () => {
    const { toJSON } = await render(<TagIcon size={22} color="#2f6fed" />);

    const json = JSON.stringify(toJSON());
    expect(json).toContain("#2f6fed");
    expect(json).toContain("22");
  });
});
