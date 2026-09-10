import { fireEvent, render, waitFor } from "@testing-library/react-native";

import TodosScreen from "../../app/(tabs)/todos";
import { getSupabaseClient } from "../../src/shared/api/supabaseClient";
import { createFakeSupabaseClient } from "../testUtils/fakeSupabaseClient";

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: { push: jest.fn() },
    Tabs: {
      Screen: ({ options }: any) => React.createElement(React.Fragment, null, options?.headerTitle?.()),
    },
    // Treats "focus" as "mount" for testing purposes, since there's no real
    // navigation container here to fire actual focus events.
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

jest.mock("../../src/shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

// calendars/hooks, events/hooks and todos/hooks are intentionally left un-mocked
// so the real hook -> service -> Supabase client chain is exercised end-to-end,
// covering the orphaned-todo recovery paths from task 16 (9.7-9.10).

describe("19.1 予定削除→ToDo孤立化→復活フローの検証", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows an orphaned todo in its own section, then reattaches it to an existing event and it disappears from that section (要件9.8, 9.9)", async () => {
    const fakeClient = createFakeSupabaseClient({
      calendars: [{ id: "cal-1", name: "我が家", kind: "group", created_by: "user-1" }],
      events: [
        {
          id: "event-target",
          calendar_id: "cal-1",
          title: "既存の予定",
          start_at: "2026-09-20T10:00:00.000Z",
          end_at: "2026-09-20T11:00:00.000Z",
          is_all_day: false,
        },
      ],
      todos: [
        {
          id: "todo-orphan",
          event_id: null,
          title: "宛名を書く",
          is_done: false,
          completed_at: null,
          reminder_at: null,
          created_by: "user-1",
        },
      ],
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(fakeClient);

    const { getByTestId, getByText, queryByTestId } = await render(<TodosScreen />);

    // 予定削除で紐付けが解除されたToDoが、専用セクションに表示され続ける(要件9.8)
    await waitFor(() => expect(getByTestId("orphaned-todos-section")).toBeTruthy());
    expect(getByText("宛名を書く")).toBeTruthy();

    // 既存の予定への再紐付け操作(要件9.9)
    await fireEvent.press(getByTestId("orphaned-todo-reattach-todo-orphan"));
    await waitFor(() => expect(getByTestId("reattach-todo-event-event-target")).toBeTruthy());
    await fireEvent.press(getByTestId("reattach-todo-event-event-target"));

    await waitFor(() => {
      const todo = fakeClient.getTable("todos").find((row) => row.id === "todo-orphan");
      expect(todo?.event_id).toBe("event-target");
    });

    // 紐付く予定に紐づく通常のToDoとして扱われ、孤立ToDoセクションから消える
    await waitFor(() => expect(queryByTestId("orphaned-todos-section")).toBeNull());
  });

  it("creates a new event in the personal calendar and reattaches an orphaned todo to it (要件9.10)", async () => {
    const fakeClient = createFakeSupabaseClient({
      calendars: [{ id: "cal-personal", name: "Myカレンダー", kind: "personal", created_by: "user-1" }],
      todos: [
        {
          id: "todo-orphan-2",
          event_id: null,
          title: "出発準備",
          is_done: false,
          completed_at: null,
          reminder_at: null,
          created_by: "user-1",
        },
      ],
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(fakeClient);

    // reattach_todo_to_new_personal_event RPCは実DBのSECURITY DEFINER関数(タスク16.5, pgTAPで別途検証済み)。
    // ここではその効果(個人用カレンダーへの予定作成+ToDoのevent_id更新)をフェイククライアント上で再現する。
    fakeClient.rpc = jest.fn((fnName: string, params: Record<string, unknown>) => ({
      single: async () => {
        if (fnName !== "reattach_todo_to_new_personal_event") {
          return { data: null, error: { message: `unexpected rpc: ${fnName}` } };
        }
        const events = fakeClient.getTable("events");
        const newEvent = {
          id: "event-new-personal",
          calendar_id: "cal-personal",
          title: params.p_title as string,
          start_at: `${params.p_date}T00:00:00.000Z`,
          end_at: `${params.p_date}T00:00:00.000Z`,
          is_all_day: true,
          created_by: "user-1",
        };
        events.push(newEvent);

        const todo = fakeClient
          .getTable("todos")
          .find((row) => row.id === params.p_todo_id);
        if (todo) {
          todo.event_id = newEvent.id;
        }

        return { data: todo ? { ...todo } : null, error: null };
      },
    })) as unknown as typeof fakeClient.rpc;

    const { getByTestId } = await render(<TodosScreen />);

    await waitFor(() => expect(getByTestId("orphaned-todo-reattach-todo-orphan-2")).toBeTruthy());
    await fireEvent.press(getByTestId("orphaned-todo-reattach-todo-orphan-2"));

    await fireEvent.press(getByTestId("reattach-todo-mode-new"));
    await fireEvent.changeText(getByTestId("reattach-todo-new-date-input"), "2026-10-10");
    await fireEvent.press(getByTestId("reattach-todo-new-submit"));

    await waitFor(() => expect(fakeClient.getTable("events")).toHaveLength(1));
    const createdEvent = fakeClient.getTable("events")[0];
    expect(createdEvent).toMatchObject({ calendar_id: "cal-personal", is_all_day: true });

    await waitFor(() => {
      const todo = fakeClient.getTable("todos").find((row) => row.id === "todo-orphan-2");
      expect(todo?.event_id).toBe(createdEvent.id);
    });
  });
});
