import { listComments, postComment } from "../../src/features/communication/service";
import { createRecurringSeries } from "../../src/features/events/service";
import { attachPhoto, listPhotosForEvent } from "../../src/features/memories/service";
import { createFakeSupabaseClient } from "../testUtils/fakeSupabaseClient";

describe("13.2 繰り返し予定の思い出粒度の検証", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2020-09-01T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("attaching a photo/comment to one occurrence does not affect the others", async () => {
    const fakeClient = createFakeSupabaseClient();

    const occurrence1 = {
      id: "event-1",
      calendar_id: "cal-1",
      series_id: "series-1",
      title: "花火大会",
      location: null,
      memo: null,
      category_color: null,
      start_at: "2020-08-01T10:00:00.000Z",
      end_at: "2020-08-01T12:00:00.000Z",
      is_all_day: false,
      reminder_at: null,
      created_by: "user-1",
      updated_by: "user-1",
    };
    const occurrence2 = { ...occurrence1, id: "event-2", start_at: "2020-08-08T10:00:00.000Z", end_at: "2020-08-08T12:00:00.000Z" };

    fakeClient.rpc.mockImplementation(async (fn: string) => {
      if (fn === "create_recurring_series") {
        fakeClient.getTable("events").push(occurrence1, occurrence2);
        return { data: [occurrence1, occurrence2], error: null };
      }
      return { data: null, error: null };
    });

    const seriesResult = await createRecurringSeries(fakeClient as never, {
      calendarId: "cal-1",
      title: "花火大会",
      startAt: "2020-08-01T10:00:00.000Z",
      endAt: "2020-08-01T12:00:00.000Z",
      recurrenceRule: "weekly",
      recurrenceEndAt: "2020-08-08T12:00:00.000Z",
    });
    expect(seriesResult.ok).toBe(true);

    const photoResult = await attachPhoto(fakeClient as never, "event-1", {
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      data: "fake-binary",
    });
    expect(photoResult.ok).toBe(true);

    const commentResult = await postComment(fakeClient as never, "event-1", "楽しかった！");
    expect(commentResult.ok).toBe(true);

    const photosForEvent1 = await listPhotosForEvent(fakeClient as never, "event-1");
    const photosForEvent2 = await listPhotosForEvent(fakeClient as never, "event-2");
    const commentsForEvent1 = await listComments(fakeClient as never, "event-1");
    const commentsForEvent2 = await listComments(fakeClient as never, "event-2");

    expect(photosForEvent1.ok && photosForEvent1.value).toHaveLength(1);
    expect(photosForEvent2.ok && photosForEvent2.value).toHaveLength(0);
    expect(commentsForEvent1.ok && commentsForEvent1.value).toHaveLength(1);
    expect(commentsForEvent2.ok && commentsForEvent2.value).toHaveLength(0);
  });
});
