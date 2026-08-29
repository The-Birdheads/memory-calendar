import { subscribeToTableChanges } from "../realtime";

interface ChannelMock {
  on: jest.Mock;
  subscribe: jest.Mock;
  unsubscribe: jest.Mock;
}

function createChannelMock(): ChannelMock {
  const channel: ChannelMock = { on: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return channel;
}

describe("subscribeToTableChanges", () => {
  it("opens a channel and listens for postgres_changes on the given table", () => {
    const channel = createChannelMock();
    const client = { channel: jest.fn(() => channel) };
    const onChange = jest.fn();

    subscribeToTableChanges(client as never, "events-cal-1", "events", onChange);

    expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^events-cal-1-\d+-\d+$/));
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "events" },
      onChange
    );
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it("includes the filter when provided", () => {
    const channel = createChannelMock();
    const client = { channel: jest.fn(() => channel) };
    const onChange = jest.fn();

    subscribeToTableChanges(client as never, "tags-cal-1", "tags", onChange, "calendar_id=eq.cal-1");

    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "tags", filter: "calendar_id=eq.cal-1" },
      onChange
    );
  });

  it("returns a cleanup function that unsubscribes the channel", () => {
    const channel = createChannelMock();
    const client = { channel: jest.fn(() => channel) };

    const cleanup = subscribeToTableChanges(client as never, "todos", "todos", jest.fn());
    cleanup();

    expect(channel.unsubscribe).toHaveBeenCalled();
  });

  it("uses a distinct channel topic for each call with the same base name", () => {
    const channel = createChannelMock();
    const client = { channel: jest.fn((_topic: string) => channel) };

    subscribeToTableChanges(client as never, "tags-cal-1", "tags", jest.fn());
    subscribeToTableChanges(client as never, "tags-cal-1", "tags", jest.fn());

    const [firstTopic] = client.channel.mock.calls[0];
    const [secondTopic] = client.channel.mock.calls[1];
    expect(firstTopic).not.toBe(secondTopic);
  });

  it("does nothing and returns a no-op cleanup when the client has no channel method", () => {
    const client = {};

    const cleanup = subscribeToTableChanges(client as never, "todos", "todos", jest.fn());

    expect(() => cleanup()).not.toThrow();
  });
});
