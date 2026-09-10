import { fireEvent, render } from "@testing-library/react-native";

import { EventPhotosGallery } from "../EventPhotosGallery";

const PHOTOS = [
  {
    id: "photo-1",
    eventId: "event-1",
    storagePath: "event-1/a.jpg",
    uploadedBy: "user-1",
    isThumbnail: false,
    createdAt: "2026-08-18T00:00:00.000Z",
    url: "https://example.com/signed/a.jpg",
  },
];

describe("EventPhotosGallery", () => {
  it("renders an image for each photo with a resolved url", async () => {
    const { getByTestId } = await render(<EventPhotosGallery photos={PHOTOS} />);

    expect(getByTestId("event-photo-photo-1-image").props.source).toEqual({
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

  it("shows a thumbnail badge only on the photo currently marked as the thumbnail", async () => {
    const photos = [PHOTOS[0], { ...PHOTOS[0], id: "photo-2", isThumbnail: true }];
    const { getByTestId, queryByTestId } = await render(<EventPhotosGallery photos={photos} />);

    expect(queryByTestId("event-photo-photo-1-thumbnail-badge")).toBeNull();
    expect(getByTestId("event-photo-photo-2-thumbnail-badge")).toBeTruthy();
  });

  it("calls onSelectThumbnail with the photo when it is pressed", async () => {
    const onSelectThumbnail = jest.fn();
    const { getByTestId } = await render(
      <EventPhotosGallery photos={PHOTOS} onSelectThumbnail={onSelectThumbnail} />
    );

    await fireEvent.press(getByTestId("event-photo-photo-1"));

    expect(onSelectThumbnail).toHaveBeenCalledWith(PHOTOS[0]);
  });

  it("shows a delete button only on the current user's own photo, and calls onDeleteOwnPhoto when pressed", async () => {
    const onDeleteOwnPhoto = jest.fn();
    const photos = [PHOTOS[0], { ...PHOTOS[0], id: "photo-2", uploadedBy: "user-2" }];
    const { getByTestId, queryByTestId } = await render(
      <EventPhotosGallery photos={photos} currentUserId="user-1" onDeleteOwnPhoto={onDeleteOwnPhoto} />
    );

    expect(getByTestId("event-photo-photo-1-delete")).toBeTruthy();
    expect(queryByTestId("event-photo-photo-2-delete")).toBeNull();

    await fireEvent.press(getByTestId("event-photo-photo-1-delete"));

    expect(onDeleteOwnPhoto).toHaveBeenCalledWith(photos[0]);
  });

  it("shows no delete button for anyone's photo when onDeleteOwnPhoto is not provided", async () => {
    const { queryByTestId } = await render(<EventPhotosGallery photos={PHOTOS} currentUserId="user-1" />);

    expect(queryByTestId("event-photo-photo-1-delete")).toBeNull();
  });
});
