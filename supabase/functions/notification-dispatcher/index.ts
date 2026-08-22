// NotificationDispatcher: pg_cronから毎分起動され、期限到来したリマインダー(予定・ToDo)を
// 設定された対象者(event_reminder_targets、未設定時は全メンバー)へExpo Push経由で配信する。
// notification_log の一意制約により、再実行しても重複配信しない。

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { sendExpoPushNotifications } from "../_shared/expoPush.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// pg_cron(net.http_post)からの呼び出しを検証する簡易共有シークレット。
// ローカル開発用の既定値。本番では `supabase secrets set CRON_SECRET=...` で必ず上書きすること。
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "local-dev-cron-secret-change-me";

interface EventReminderRow {
  id: string;
  calendar_id: string;
  title: string;
}

interface TodoReminderRow {
  id: string;
  event_id: string;
  title: string;
}

async function resolveTargetUserIds(
  supabase: SupabaseClient,
  eventId: string,
  calendarId: string
): Promise<string[]> {
  const { data: targets } = await supabase
    .from("event_reminder_targets")
    .select("user_id")
    .eq("event_id", eventId);

  if (targets && targets.length > 0) {
    return (targets as { user_id: string }[]).map((t) => t.user_id);
  }

  const { data: members } = await supabase
    .from("calendar_members")
    .select("user_id")
    .eq("calendar_id", calendarId);

  return ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
}

interface SendReminderParams {
  notificationType: string;
  targetUserIds: string[];
  eventId?: string;
  todoId?: string;
  title: string;
  body: string;
}

async function sendReminderToTargets(supabase: SupabaseClient, params: SendReminderParams): Promise<void> {
  const keyColumn = params.todoId ? "todo_id" : "event_id";
  const keyValue = params.todoId ?? params.eventId;

  for (const userId of params.targetUserIds) {
    // notification_log への先行INSERTを冪等性の「予約」として使う。
    // 一意制約違反(既に配信済み)の場合はスキップし、再実行しても重複配信しない。
    const { error: reserveError } = await supabase.from("notification_log").insert({
      type: params.notificationType,
      target_user_id: userId,
      [keyColumn]: keyValue,
      status: "pending",
    });

    if (reserveError) {
      continue;
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", userId);

    const pushTokens = (tokens ?? []) as { expo_push_token: string }[];

    if (pushTokens.length === 0) {
      await supabase
        .from("notification_log")
        .update({ status: "failed" })
        .eq("type", params.notificationType)
        .eq("target_user_id", userId)
        .eq(keyColumn, keyValue as string);
      continue;
    }

    const sent = await sendExpoPushNotifications(
      pushTokens.map((t) => ({ to: t.expo_push_token, title: params.title, body: params.body }))
    );

    await supabase
      .from("notification_log")
      .update({
        status: sent ? "sent" : "failed",
        sent_at: sent ? new Date().toISOString() : null,
      })
      .eq("type", params.notificationType)
      .eq("target_user_id", userId)
      .eq(keyColumn, keyValue as string);
  }
}

async function dispatchEventReminders(supabase: SupabaseClient, now: string): Promise<void> {
  const { data: events } = await supabase
    .from("events")
    .select("id, calendar_id, title")
    .not("reminder_at", "is", null)
    .lte("reminder_at", now);

  for (const event of (events ?? []) as EventReminderRow[]) {
    const targetUserIds = await resolveTargetUserIds(supabase, event.id, event.calendar_id);
    await sendReminderToTargets(supabase, {
      notificationType: "event_reminder",
      targetUserIds,
      eventId: event.id,
      title: "予定のリマインドです",
      body: event.title,
    });
  }
}

async function dispatchTodoReminders(supabase: SupabaseClient, now: string): Promise<void> {
  const { data: todos } = await supabase
    .from("todos")
    .select("id, event_id, title")
    .not("reminder_at", "is", null)
    .lte("reminder_at", now)
    .eq("is_done", false);

  for (const todo of (todos ?? []) as TodoReminderRow[]) {
    // ToDoのリマインド配信対象は、紐づく予定のevent_reminder_targets設定を継承する
    const { data: event } = await supabase
      .from("events")
      .select("calendar_id")
      .eq("id", todo.event_id)
      .single();

    if (!event) {
      continue;
    }

    const targetUserIds = await resolveTargetUserIds(
      supabase,
      todo.event_id,
      (event as { calendar_id: string }).calendar_id
    );
    await sendReminderToTargets(supabase, {
      notificationType: "todo_reminder",
      targetUserIds,
      todoId: todo.id,
      title: "ToDoのリマインドです",
      body: todo.title,
    });
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = new Date().toISOString();

  await dispatchEventReminders(supabase, now);
  await dispatchTodoReminders(supabase, now);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
