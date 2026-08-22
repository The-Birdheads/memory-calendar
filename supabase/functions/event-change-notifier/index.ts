// EventChangeNotifier: 予定の追加・変更・コメント投稿・繰り返しシリーズ作成を起点に、
// 操作者本人を除くカレンダーメンバーへ即時プッシュ通知を送るEdge Function。
// DB Webhook(events INSERT/UPDATE `series_id IS NULL`のみ / event_comments INSERT /
// event_series_creation_events INSERT)から呼び出される。
// notification_log の部分一意インデックスにより、再送(at-least-once配信)されても重複通知しない。

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { sendExpoPushNotifications } from "../_shared/expoPush.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// DB Webhook(supabase_functions.http_request、JWTを持たない)からの呼び出しを検証する共有シークレット。
// 本番では `supabase secrets set WEBHOOK_SECRET=...` で必ず上書きすること。
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "local-dev-webhook-secret-change-me";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

interface EventRecord {
  id: string;
  calendar_id: string;
  series_id: string | null;
  title: string;
  created_by: string;
  updated_by: string;
}

interface CommentRecord {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
}

interface SeriesCreationRecord {
  id: string;
  series_id: string;
  calendar_id: string;
  created_by: string;
  event_count: number;
}

interface DispatchParams {
  notificationType: string;
  calendarId: string;
  // event_idまたはseries_idのいずれか一方をnotification_logの冪等性キーとして使う
  eventId?: string;
  seriesId?: string;
  actingUserId: string;
  title: string;
  body: string;
}

async function dispatchToOtherMembers(supabase: SupabaseClient, params: DispatchParams): Promise<void> {
  const { data: members } = await supabase
    .from("calendar_members")
    .select("user_id")
    .eq("calendar_id", params.calendarId)
    .neq("user_id", params.actingUserId);

  if (!members || members.length === 0) {
    return;
  }

  const keyColumn = params.seriesId ? "series_id" : "event_id";
  const keyValue = params.seriesId ?? params.eventId;

  for (const member of members as { user_id: string }[]) {
    // notification_log への先行INSERTを冪等性の「予約」として使う。
    // 一意制約違反(重複配信)の場合はスキップする。
    const { error: reserveError } = await supabase.from("notification_log").insert({
      type: params.notificationType,
      target_user_id: member.user_id,
      [keyColumn]: keyValue,
      status: "pending",
    });

    if (reserveError) {
      continue;
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", member.user_id);

    const pushTokens = (tokens ?? []) as { expo_push_token: string }[];

    if (pushTokens.length === 0) {
      await supabase
        .from("notification_log")
        .update({ status: "failed" })
        .eq("type", params.notificationType)
        .eq("target_user_id", member.user_id)
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
      .eq("target_user_id", member.user_id)
      .eq(keyColumn, keyValue as string);
  }
}

async function handleEventInsert(supabase: SupabaseClient, event: EventRecord): Promise<void> {
  if (event.series_id !== null) {
    // トリガーのWHEN句で除外済みだが、念のための二重チェック(繰り返しシリーズは集約通知する)
    return;
  }

  await dispatchToOtherMembers(supabase, {
    notificationType: "event_created",
    calendarId: event.calendar_id,
    eventId: event.id,
    actingUserId: event.created_by,
    title: "新しい予定が追加されました",
    body: event.title,
  });
}

async function handleEventUpdate(supabase: SupabaseClient, event: EventRecord): Promise<void> {
  if (event.series_id !== null) {
    // トリガーのWHEN句で除外済みだが、念のための二重チェック
    return;
  }

  await dispatchToOtherMembers(supabase, {
    notificationType: "event_updated",
    calendarId: event.calendar_id,
    eventId: event.id,
    actingUserId: event.updated_by,
    title: "予定が更新されました",
    body: event.title,
  });
}

async function handleCommentInsert(supabase: SupabaseClient, comment: CommentRecord): Promise<void> {
  const { data: event } = await supabase
    .from("events")
    .select("calendar_id")
    .eq("id", comment.event_id)
    .single();

  if (!event) {
    return;
  }

  await dispatchToOtherMembers(supabase, {
    notificationType: "comment_posted",
    calendarId: (event as { calendar_id: string }).calendar_id,
    eventId: comment.event_id,
    actingUserId: comment.user_id,
    title: "新しいコメントがあります",
    body: comment.body,
  });
}

async function handleSeriesCreation(supabase: SupabaseClient, series: SeriesCreationRecord): Promise<void> {
  await dispatchToOtherMembers(supabase, {
    notificationType: "series_created",
    calendarId: series.calendar_id,
    seriesId: series.series_id,
    actingUserId: series.created_by,
    title: "繰り返しの予定が追加されました",
    body: `${series.event_count}件の予定が追加されました`,
  });
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  if (payload.table === "events" && payload.type === "INSERT" && payload.record) {
    await handleEventInsert(supabase, payload.record as unknown as EventRecord);
  } else if (payload.table === "events" && payload.type === "UPDATE" && payload.record) {
    await handleEventUpdate(supabase, payload.record as unknown as EventRecord);
  } else if (payload.table === "event_comments" && payload.type === "INSERT" && payload.record) {
    await handleCommentInsert(supabase, payload.record as unknown as CommentRecord);
  } else if (payload.table === "event_series_creation_events" && payload.type === "INSERT" && payload.record) {
    await handleSeriesCreation(supabase, payload.record as unknown as SeriesCreationRecord);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
