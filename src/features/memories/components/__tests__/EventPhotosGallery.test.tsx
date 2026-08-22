import { render } from "@testing-library/react-native";

import { EventPhotosGallery } from "../EventPhotosGallery";

const PHOTOS = [
  {
    id: "photo-1",
    eventId: "event-1",
    storagePath: "event-1/a.jpg",
    uploadedBy: "user-1",
    createdAt: "2026-08-18T00:00:00.000Z",
    url: "https://example.com/signed/a.jpg",
  },
];

describe("EventPhotosGallery", () => {
  it("renders an image for each photo with a resolved url", async () => {
    const { getByTestId } = await render(<EventPhotosGallery photos={PHOTOS} />);

    expect(getByTestId("event-photo-photo-1").props.source).toEqual({
      uri: "https://example.com/signed/a.jpg",
    });
  });

  it("skips photos whose signed url failed to resolve", async () => {
    const { queryByTestId } = await render(
      <EventPhotosGallery photos={[{ ...PHOTOS[0], url: null }]} />
    );

    expect(queryByTestId("event-photo-photo-1")).toBeNull();
  });

  it("shows an empty state message when there are no photos", async () => {
    const { getByText } = await render(<EventPhotosGallery photos={[]} />);

    expect(getByText("写真はまだありません")).toBeTruthy();
  });

  it("immediately reflects a newly attached photo when the photos prop updates", async () => {
    const { getByTestId, queryByTestId, rerender } = await render(<EventPhotosGallery photos={[]} />);

    expect(queryByTestId("event-photo-photo-1")).toBeNull();

    await rerender(<EventPhotosGallery photos={PHOTOS} />);

    expect(getByTestId("event-photo-photo-1")).toBeTruthy();
  });
});
