import { buildCalendarSwitchWarningMessages } from "../calendarSwitchWarning";

describe("buildCalendarSwitchWarningMessages", () => {
  it("personal -> group: explains what becomes shared, and does not mention losing access", () => {
    const messages = buildCalendarSwitchWarningMessages({
      fromKind: "personal",
      fromName: "Myカレンダー",
      toKind: "group",
      toName: "我が家",
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("「我が家」");
    expect(messages[0]).toContain("共有されます");
    expect(messages[0]).toContain("タグ・ToDo・リマインドはこれまで通り");
  });

  it("group -> personal: explains that the original calendar's members lose access, and does not mention sharing", () => {
    const messages = buildCalendarSwitchWarningMessages({
      fromKind: "group",
      fromName: "我が家",
      toKind: "personal",
      toName: "Myカレンダー",
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("「我が家」");
    expect(messages[0]).toContain("見られなくなります");
  });

  it("group -> a different group: shows both warnings (old members lose access, new members gain it)", () => {
    const messages = buildCalendarSwitchWarningMessages({
      fromKind: "group",
      fromName: "我が家",
      toKind: "group",
      toName: "友人グループ",
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("「友人グループ」");
    expect(messages[0]).toContain("共有されます");
    expect(messages[1]).toContain("「我が家」");
    expect(messages[1]).toContain("見られなくなります");
  });

  it("falls back to a generic message in the (practically unreachable) personal -> personal case", () => {
    const messages = buildCalendarSwitchWarningMessages({
      fromKind: "personal",
      fromName: "Myカレンダー",
      toKind: "personal",
      toName: "Myカレンダー",
    });

    expect(messages).toEqual(["この予定の所属カレンダーが変更されます。"]);
  });
});
