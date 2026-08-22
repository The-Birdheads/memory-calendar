import { render } from "@testing-library/react-native";

import { EventTagBadges } from "../EventTagBadges";

const TAGS = [
  { id: "tag-1", calendarId: "cal-1", parentId: null, level: "major" as const, name: "行事", color: "#ff0000", createdAt: "2026-08-18T00:00:00.000Z" },
  { id: "tag-2", calendarId: "cal-1", parentId: "tag-1", level: "mid" as const, name: "誕生日", color: "#00ff00", createdAt: "2026-08-18T00:01:00.000Z" },
];

describe("EventTagBadges", () => {
  it("renders a badge for every attached tag, in its own color", async () => {
    const { getByTestId, getByText } = await render(<EventTagBadges tags={TAGS} />);

    expect(getByText("行事")).toBeTruthy();
    expect(getByText("誕生日")).toBeTruthy();
    expect(getByTestId("event-tag-badge-tag-1").props.style).toContainEqual(
      expect.objectContaining({ backgroundColor: "#ff0000" })
    );
    expect(getByTestId("event-tag-badge-tag-2").props.style).toContainEqual(
      expect.objectContaining({ backgroundColor: "#00ff00" })
    );
  });

  it("renders nothing when no tags are attached", async () => {
    const { queryByTestId } = await render(<EventTagBadges tags={[]} />);

    expect(queryByTestId(/event-tag-badge-/)).toBeNull();
  });

  it("immediately reflects a newly attached tag when the tags prop updates", async () => {
    const { getByText, queryByText, rerender } = await render(<EventTagBadges tags={TAGS} />);

    expect(queryByText("旅行")).toBeNull();

    const updatedTags = [
      ...TAGS,
      { id: "tag-3", calendarId: "cal-1", parentId: null, level: "major" as const, name: "旅行", color: "#0000ff", createdAt: "2026-08-18T00:02:00.000Z" },
    ];
    await rerender(<EventTagBadges tags={updatedTags} />);

    expect(getByText("旅行")).toBeTruthy();
  });
});
