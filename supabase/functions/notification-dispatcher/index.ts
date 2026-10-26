// NotificationDispatcher: pg_cronから毎分起動され、期限到来したリマインダー(予定・ToDo)と、
// 各ユーザーが設定した時刻の献立の通知(朝食/昼食/夕食/間食)を配信する。
// 予定のリマインドはevent_reminders(各メンバーが自分で設定した個人単位のリマインド時刻)を
// そのまま配信対象とする(「対象者」概念は廃止。行が存在する = 本人がその時刻に通知してほしいという意思表示)。
// notification_log の一意制約により、再実行しても重複配信しない(配信済みのものは、そもそも対象から外す)。

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { chunk, excludeLogged, LOG_LOOKUP_CHUNK_SIZE, lookbackStart } from "../_shared/dueReminders.ts";
import { sendExpoPushNotifications } from "../_shared/expoPush.ts";
import {
  buildMealReminderMessage,
  dueMealSlots,
  jstClock,
  type MealNotificationSettingsRow,
  type MealSlot,
} from "../_shared/mealReminder.ts";

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
  /** notification_log の冪等性キー(列名 → 値)。例: { event_reminder_id: "..." } / { meal_date, meal_slot } */
  idempotency: Record<string, string>;
  title: string;
  body: string;
}

async function sendReminder(supabase: SupabaseClient, params: SendReminderParams): Promise<void> {
  // notification_log への先行INSERTを冪等性の「予約」として使う。
  // 一意制約違反(既に配信済み)の場合はスキップし、再実行しても重複配信しない。
  const { error: reserveError } = await supabase.from("notification_log").insert({
    type: params.notificationType,
    target_user_id: params.userId,
    ...params.idempotency,
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
      .match(params.idempotency);
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
    .match(params.idempotency);
}

/** すでに notification_log に行がある(配信済み・配信失敗済みの)リマインドのID。 */
async function loadLoggedIds(
  supabase: SupabaseClient,
  column: "event_reminder_id" | "todo_id",
  ids: string[]
): Promise<Set<string>> {
  const logged = new Set<string>();
  for (const group of chunk(ids, LOG_LOOKUP_CHUNK_SIZE)) {
    const { data } = await supabase.from("notification_log").select(column).in(column, group);
    for (const row of (data ?? []) as Record<string, string | null>[]) {
      const id = row[column];
      if (id) logged.add(id);
    }
  }
  return logged;
}

// 配信対象は「リマインド時刻が直近の一定期間にあり、まだ notification_log に行が無いもの」だけ。
// (期限が過ぎたもの全部を毎分たどると、配信済みのものにも毎回INSERTして一意制約違反が出続ける。)
async function dispatchEventReminders(supabase: SupabaseClient, now: Date): Promise<void> {
  const { data: reminders } = await supabase
    .from("event_reminders")
    .select("id, user_id, events(title)")
    .gte("remind_at", lookbackStart(now))
    .lte("remind_at", now.toISOString());

  const candidates = (reminders ?? []) as EventReminderRow[];
  const logged = await loadLoggedIds(
    supabase,
    "event_reminder_id",
    candidates.map((reminder) => reminder.id)
  );

  for (const reminder of excludeLogged(candidates, logged)) {
    await sendReminder(supabase, {
      notificationType: "event_reminder",
      userId: reminder.user_id,
      idempotency: { event_reminder_id: reminder.id },
      title: "予定のリマインドです",
      body: reminder.events?.title ?? "",
    });
  }
}

async function dispatchTodoReminders(supabase: SupabaseClient, now: Date): Promise<void> {
  const { data: todos } = await supabase
    .from("todos")
    .select("id, created_by, title")
    .not("reminder_at", "is", null)
    .gte("reminder_at", lookbackStart(now))
    .lte("reminder_at", now.toISOString())
    .eq("is_done", false);

  const candidates = (todos ?? []) as TodoReminderRow[];
  const logged = await loadLoggedIds(
    supabase,
    "todo_id",
    candidates.map((todo) => todo.id)
  );

  for (const todo of excludeLogged(candidates, logged)) {
    // ToDoは非公開のため、配信対象は常に作成者本人のみ。
    await sendReminder(supabase, {
      notificationType: "todo_reminder",
      userId: todo.created_by,
      idempotency: { todo_id: todo.id },
      title: "ToDoのリマインドです",
      body: todo.title,
    });
  }
}

// 設定した時刻になった献立の通知を配信する。その日のその時間帯に登録された献立が
// 1件もなければ通知しない(「予定に登録した献立」の通知のため)。
async function dispatchMealReminders(supabase: SupabaseClient, now: Date): Promise<void> {
  const { dateKey, minutes } = jstClock(now);

  const { data: settingsRows } = await supabase.from("meal_notification_settings").select("*").eq("enabled", true);

  for (const settings of (settingsRows ?? []) as MealNotificationSettingsRow[]) {
    for (const slot of dueMealSlots(settings, minutes)) {
      await dispatchMealReminder(supabase, settings.user_id, dateKey, slot);
    }
  }
}

async function dispatchMealReminder(
  supabase: SupabaseClient,
  userId: string,
  dateKey: string,
  slot: MealSlot
): Promise<void> {
  // 本人が参加しているカレンダー(個人用・共有とも)の、その日・その時間帯の献立。
  const { data: memberships } = await supabase.from("calendar_members").select("calendar_id").eq("user_id", userId);
  const calendarIds = ((memberships ?? []) as { calendar_id: string }[]).map((row) => row.calendar_id);
  if (calendarIds.length === 0) return;

  const { data: meals } = await supabase
    .from("meal_records")
    .select("title")
    .in("calendar_id", calendarIds)
    .eq("meal_date", dateKey)
    .eq("slot", slot)
    .order("created_at", { ascending: true });

  const titles = [...new Set(((meals ?? []) as { title: string }[]).map((meal) => meal.title.trim()).filter(Boolean))];
  if (titles.length === 0) return;

  await sendReminder(supabase, {
    notificationType: "meal_reminder",
    userId,
    idempotency: { meal_date: dateKey, meal_slot: slot },
    title: "献立のお知らせ",
    body: buildMealReminderMessage(slot, titles),
  });
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = new Date();

  await dispatchEventReminders(supabase, now);
  await dispatchTodoReminders(supabase, now);
  await dispatchMealReminders(supabase, now);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
