// NotificationDispatcher: pg_cronから毎分起動され、期限到来したリマインダー(予定・ToDo)を配信する。
// 予定のリマインドはevent_reminders(各メンバーが自分で設定した個人単位のリマインド時刻)を
// そのまま配信対象とする(「対象者」概念は廃止。行が存在する = 本人がその時刻に通知してほしいという意思表示)。
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
  user_id: string;
  events: { title: string } | null;
}

interface TodoReminderRow {
  id: string;
  created_by: string;
  title: string;
}

interface SendReminderParams {
  notificationType: string;
  userId: string;
  idempotencyColumn: "event_reminder_id" | "todo_id";
  idempotencyValue: string;
  title: string;
  body: string;
}

async function sendReminder(supabase: SupabaseClient, params: SendReminderParams): Promise<void> {
  // notification_log への先行INSERTを冪等性の「予約」として使う。
  // 一意制約違反(既に配信済み)の場合はスキップし、再実行しても重複配信しない。
  const { error: reserveError } = await supabase.from("notification_log").insert({
    type: params.notificationType,
    target_user_id: params.userId,
    [params.idempotencyColumn]: params.idempotencyValue,
    status: "pending",
  });

  if (reserveError) {
    return;
  }

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .eq("user_id", params.userId);

  const pushTokens = (tokens ?? []) as { expo_push_token: string }[];

  if (pushTokens.length === 0) {
    await supabase
      .from("notification_log")
      .update({ status: "failed" })
      .eq("type", params.notificationType)
      .eq("target_user_id", params.userId)
      .eq(params.idempotencyColumn, params.idempotencyValue);
    return;
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
    .eq("target_user_id", params.userId)
    .eq(params.idempotencyColumn, params.idempotencyValue);
}

async function dispatchEventReminders(supabase: SupabaseClient, now: string): Promise<void> {
  const { data: reminders } = await supabase
    .from("event_reminders")
    .select("id, user_id, events(title)")
    .lte("remind_at", now);

  for (const reminder of (reminders ?? []) as EventReminderRow[]) {
    await sendReminder(supabase, {
      notificationType: "event_reminder",
      userId: reminder.user_id,
      idempotencyColumn: "event_reminder_id",
      idempotencyValue: reminder.id,
      title: "予定のリマインドです",
      body: reminder.events?.title ?? "",
    });
  }
}

async function dispatchTodoReminders(supabase: SupabaseClient, now: string): Promise<void> {
  const { data: todos } = await supabase
    .from("todos")
    .select("id, created_by, title")
    .not("reminder_at", "is", null)
    .lte("reminder_at", now)
    .eq("is_done", false);

  for (const todo of (todos ?? []) as TodoReminderRow[]) {
    // ToDoは非公開のため、配信対象は常に作成者本人のみ。
    await sendReminder(supabase, {
      notificationType: "todo_reminder",
      userId: todo.created_by,
      idempotencyColumn: "todo_id",
      idempotencyValue: todo.id,
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
