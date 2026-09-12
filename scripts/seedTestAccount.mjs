#!/usr/bin/env node
/**
 * test.birdhead@gmail.com 用の実機テスト/スクリーンショット/App Store提出用
 * テストデータを作り直すスクリプト。何度でも安全に再実行できる(毎回まず
 * test.birdhead所有のデータを削除してから作り直す)。
 *
 * 対象は常に test.birdhead@gmail.com のデータのみ(メールアドレスで検索して
 * 対象IDを特定する)。他のユーザーのデータには一切触れない。
 *
 * 使い方:
 *   node scripts/seedTestAccount.mjs [--date=YYYY-MM-DD]
 *
 * 事前準備:
 *   - Supabase CLIがログイン済み、または SUPABASE_ACCESS_TOKEN 環境変数が
 *     設定済みであること(本番プロジェクトに `supabase db query --linked`
 *     で接続するため)。
 *   - TEST_BIRDHEAD_PASSWORD 環境変数に test.birdhead@gmail.com の
 *     パスワードを設定しておくこと(写真アップロードのため、本人としてログ
 *     インする)。
 *   - testuser1@example.com / testuser2@example.com がダミーの共有メンバー
 *     として事前にSupabaseダッシュボードから作成済みであること。
 *
 * --date で「基準日」(今日とみなす日、JST)を指定できる。省略時は実行日。
 * 予定・ToDo・献立はすべてこの基準日からの相対位置(過去2ヶ月〜翌月)で
 * 生成されるので、常に「基準日を中心に程よく過去・未来がある」状態になる。
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const scratchDir = path.join(projectRoot, ".seed-scratch");
mkdirSync(scratchDir, { recursive: true });

const BIRDHEAD_EMAIL = "test.birdhead@gmail.com";
const DUMMY_EMAILS = ["testuser1@example.com", "testuser2@example.com"];
const FAMILY_CALENDAR_NAME = "家族(テスト用)";

function parseArgs() {
  const dateArg = process.argv.find((a) => a.startsWith("--date="));
  const referenceDate = dateArg ? dateArg.slice("--date=".length) : null;
  if (referenceDate && !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    throw new Error(`--date は YYYY-MM-DD 形式で指定してください(受け取った値: ${referenceDate})`);
  }
  return { referenceDate };
}

function todayDateKey() {
  // このマシンのローカル日付ではなく、常にJSTの「今日」を基準にする。
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jstNow.toISOString().slice(0, 10);
}

function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toAllDayTimestamp(dateKey) {
  return `${dateKey}T00:00:00.000Z`;
}

function toTimedTimestamp(dateKey, hh, mm) {
  return `${dateKey}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`;
}

function sqlStr(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function loadEnvFile() {
  const envPath = path.join(projectRoot, ".env");
  const content = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

function runManagementSql(sqlText, label) {
  const filePath = path.join(scratchDir, `${label}.sql`);
  writeFileSync(filePath, sqlText);
  const output = execFileSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--file", filePath, "--output-format", "json"],
    { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
  );
  return JSON.parse(output);
}

function resolveIds() {
  const result = runManagementSql(
    `select id, email from auth.users where email in (${[BIRDHEAD_EMAIL, ...DUMMY_EMAILS].map(sqlStr).join(",")});`,
    "01-resolve-users"
  );
  const byEmail = Object.fromEntries(result.rows.map((r) => [r.email, r.id]));
  for (const email of [BIRDHEAD_EMAIL, ...DUMMY_EMAILS]) {
    if (!byEmail[email]) {
      throw new Error(`ユーザーが見つかりません: ${email}(先にSupabaseダッシュボードで作成してください)`);
    }
  }

  const calResult = runManagementSql(
    `select id from public.calendars where kind = 'personal' and created_by = ${sqlStr(byEmail[BIRDHEAD_EMAIL])};`,
    "02-resolve-personal-calendar"
  );
  if (calResult.rows.length === 0) {
    throw new Error(`test.birdheadの個人用カレンダーが見つかりません(id=${byEmail[BIRDHEAD_EMAIL]})`);
  }

  return {
    birdheadId: byEmail[BIRDHEAD_EMAIL],
    dummy1Id: byEmail[DUMMY_EMAILS[0]],
    dummy2Id: byEmail[DUMMY_EMAILS[1]],
    personalCalendarId: calResult.rows[0].id,
  };
}

function fetchOldPhotoPaths(ids) {
  const result = runManagementSql(
    `select ep.storage_path
     from public.event_photos ep
     join public.events e on e.id = ep.event_id
     where e.calendar_id = ${sqlStr(ids.personalCalendarId)}
        or e.calendar_id in (
          select id from public.calendars
          where kind = 'group' and created_by = ${sqlStr(ids.birdheadId)} and name = ${sqlStr(FAMILY_CALENDAR_NAME)}
        );`,
    "03-old-photo-paths"
  );
  return result.rows.map((r) => r.storage_path);
}

function buildSeedSql(ids, referenceDate) {
  const today = referenceDate;
  const { birdheadId, dummy1Id, dummy2Id, personalCalendarId } = ids;
  const familyCalendarId = randomUUID();

  const lines = [];
  lines.push("begin;");
  lines.push("");
  lines.push("-- ===== クリーンアップ(test.birdhead所有分のみ) =====");
  lines.push(
    `delete from public.events where calendar_id = ${sqlStr(personalCalendarId)} or calendar_id in (select id from public.calendars where kind = 'group' and created_by = ${sqlStr(birdheadId)} and name = ${sqlStr(FAMILY_CALENDAR_NAME)});`
  );
  lines.push(
    `delete from public.meal_records where calendar_id = ${sqlStr(personalCalendarId)} or calendar_id in (select id from public.calendars where kind = 'group' and created_by = ${sqlStr(birdheadId)} and name = ${sqlStr(FAMILY_CALENDAR_NAME)});`
  );
  lines.push(`delete from public.tags where user_id = ${sqlStr(birdheadId)};`);
  lines.push(
    `delete from public.calendars where kind = 'group' and created_by = ${sqlStr(birdheadId)} and name = ${sqlStr(FAMILY_CALENDAR_NAME)};`
  );
  lines.push("");

  lines.push("-- ===== タグ(大→中) =====");
  const tagEvent = { id: randomUUID(), name: "行事", color: "#e53935" };
  const tagHobby = { id: randomUUID(), name: "趣味", color: "#43a047" };
  const tagHousework = { id: randomUUID(), name: "家事", color: "#fb8c00" };
  const tagHobbyMusic = { id: randomUUID(), name: "音楽", color: "#85c187", parent: tagHobby.id };
  const tagEventBirthday = { id: randomUUID(), name: "誕生日", color: "#ef8886", parent: tagEvent.id };
  lines.push("insert into public.tags (id, user_id, level, name, color, parent_id) values");
  lines.push(
    [
      `  (${sqlStr(tagEvent.id)}, ${sqlStr(birdheadId)}, 'major', ${sqlStr(tagEvent.name)}, ${sqlStr(tagEvent.color)}, NULL)`,
      `  (${sqlStr(tagHobby.id)}, ${sqlStr(birdheadId)}, 'major', ${sqlStr(tagHobby.name)}, ${sqlStr(tagHobby.color)}, NULL)`,
      `  (${sqlStr(tagHousework.id)}, ${sqlStr(birdheadId)}, 'major', ${sqlStr(tagHousework.name)}, ${sqlStr(tagHousework.color)}, NULL)`,
      `  (${sqlStr(tagHobbyMusic.id)}, ${sqlStr(birdheadId)}, 'mid', ${sqlStr(tagHobbyMusic.name)}, ${sqlStr(tagHobbyMusic.color)}, ${sqlStr(tagHobby.id)})`,
      `  (${sqlStr(tagEventBirthday.id)}, ${sqlStr(birdheadId)}, 'mid', ${sqlStr(tagEventBirthday.name)}, ${sqlStr(tagEventBirthday.color)}, ${sqlStr(tagEvent.id)})`,
    ].join(",\n") + ";"
  );
  lines.push("");

  lines.push("-- ===== 共有カレンダー「家族」(ダミーメンバー2名) =====");
  lines.push(
    `insert into public.calendars (id, name, kind, color, created_by) values (${sqlStr(familyCalendarId)}, ${sqlStr(FAMILY_CALENDAR_NAME)}, 'group', '#8e24aa', ${sqlStr(birdheadId)});`
  );
  // on_calendar_createdトリガーがcreated_by(birdhead)をownerとしてcalendar_membersに
  // 自動挿入するため、ここではダミーメンバー2名分だけ追加する。
  lines.push(
    `insert into public.calendar_members (calendar_id, user_id, role) values (${sqlStr(familyCalendarId)}, ${sqlStr(dummy1Id)}, 'editor');`
  );
  lines.push(
    `insert into public.calendar_members (calendar_id, user_id, role) values (${sqlStr(familyCalendarId)}, ${sqlStr(dummy2Id)}, 'viewer');`
  );
  lines.push("");

  // ---- 個人用カレンダーの予定(過去2ヶ月〜翌月) ----
  const events = [];
  const addEvent = (opts) => {
    const id = randomUUID();
    events.push({ id, ...opts });
    return id;
  };

  const personalEventDefs = [
    { offset: -58, title: "歯医者(定期検診)", allDay: false, hh: 10, mm: 0, durationH: 1, location: "みらい歯科クリニック" },
    { offset: -50, title: "花火大会", allDay: true, tag: tagEvent.id },
    { offset: -45, title: "祖母の誕生日", allDay: true, tag: tagEventBirthday.id },
    { offset: -40, title: "ギターレッスン", allDay: false, hh: 19, mm: 0, durationH: 1, tag: tagHobbyMusic.id },
    { offset: -33, title: "大掃除", allDay: false, hh: 9, mm: 0, durationH: 3, tag: tagHousework.id },
    { offset: -25, title: "friendと食事", allDay: false, hh: 18, mm: 30, durationH: 2, location: "駅前イタリアン" },
    { offset: -20, title: "健康診断", allDay: false, hh: 9, mm: 30, durationH: 2 },
    { offset: -12, title: "美容院", allDay: false, hh: 14, mm: 0, durationH: 1 },
    { offset: -5, title: "ギターレッスン", allDay: false, hh: 19, mm: 0, durationH: 1, tag: tagHobbyMusic.id },
    { offset: -1, title: "資源ごみ出し", allDay: false, hh: 8, mm: 0, durationH: 0, tag: tagHousework.id },
    { offset: 0, title: "在宅ワーク", allDay: false, hh: 9, mm: 0, durationH: 8 },
    { offset: 2, title: "歯医者(治療)", allDay: false, hh: 11, mm: 0, durationH: 1, location: "みらい歯科クリニック" },
    { offset: 6, title: "友人の結婚式", allDay: true, tag: tagEvent.id, location: "アニヴェルセル" },
    { offset: 14, title: "ライブ鑑賞", allDay: false, hh: 18, mm: 0, durationH: 3, tag: tagHobbyMusic.id, url: "https://example.com/live" },
    { offset: 21, title: "確定申告の準備", allDay: false, hh: 10, mm: 0, durationH: 2 },
    { offset: 30, title: "旅行(温泉)", allDay: true, tag: tagEvent.id },
  ];

  for (const def of personalEventDefs) {
    const dateKey = addDays(today, def.offset);
    const start = def.allDay ? toAllDayTimestamp(dateKey) : toTimedTimestamp(dateKey, def.hh, def.mm);
    const end = def.allDay
      ? toAllDayTimestamp(dateKey)
      : toTimedTimestamp(dateKey, def.hh + (def.durationH ?? 1), def.mm);
    addEvent({
      calendarId: personalCalendarId,
      title: def.title,
      startAt: start,
      endAt: end,
      isAllDay: def.allDay,
      location: def.location ?? null,
      url: def.url ?? null,
      tagId: def.tag ?? null,
      isPersonal: true,
    });
  }

  const familyEventDefs = [
    { offset: -40, title: "家族でバーベキュー", allDay: true },
    { offset: -22, title: "実家に帰省", allDay: true },
    { offset: -10, title: "子供の発表会", allDay: false, hh: 13, mm: 0, durationH: 2, tag: tagEvent.id },
    { offset: 3, title: "家族会議", allDay: false, hh: 20, mm: 0, durationH: 1 },
    { offset: 10, title: "運動会", allDay: false, hh: 9, mm: 0, durationH: 4, tag: tagEvent.id },
    { offset: 25, title: "家族旅行(海)", allDay: true, tag: tagEvent.id },
  ];
  for (const def of familyEventDefs) {
    const dateKey = addDays(today, def.offset);
    const start = def.allDay ? toAllDayTimestamp(dateKey) : toTimedTimestamp(dateKey, def.hh, def.mm);
    const end = def.allDay
      ? toAllDayTimestamp(dateKey)
      : toTimedTimestamp(dateKey, def.hh + (def.durationH ?? 1), def.mm);
    addEvent({
      calendarId: familyCalendarId,
      title: def.title,
      startAt: start,
      endAt: end,
      isAllDay: def.allDay,
      location: null,
      url: null,
      tagId: def.tag ?? null,
      isPersonal: false,
    });
  }

  lines.push("-- ===== 予定(個人用" + personalEventDefs.length + "件 + 家族" + familyEventDefs.length + "件) =====");
  lines.push(
    "insert into public.events (id, calendar_id, title, location, url, start_at, end_at, is_all_day, created_by, updated_by) values"
  );
  lines.push(
    events
      .map(
        (e) =>
          `  (${sqlStr(e.id)}, ${sqlStr(e.calendarId)}, ${sqlStr(e.title)}, ${sqlStr(e.location)}, ${sqlStr(e.url)}, ${sqlStr(e.startAt)}, ${sqlStr(e.endAt)}, ${e.isAllDay}, ${sqlStr(birdheadId)}, ${sqlStr(birdheadId)})`
      )
      .join(",\n") + ";"
  );
  lines.push("");

  const eventTagRows = events.filter((e) => e.tagId);
  if (eventTagRows.length > 0) {
    lines.push("-- ===== タグの紐付け =====");
    lines.push("insert into public.event_tags (event_id, tag_id) values");
    lines.push(eventTagRows.map((e) => `  (${sqlStr(e.id)}, ${sqlStr(e.tagId)})`).join(",\n") + ";");
    lines.push("");
  }

  // ---- ToDo(個人用カレンダーの予定の一部に紐付け) ----
  const findEvent = (title, offset) => events.find((e) => e.title === title && e.startAt.startsWith(addDays(today, offset)));
  const todoDefs = [
    { eventTitle: "歯医者(定期検診)", offset: -58, title: "保険証を持っていく", isDone: true },
    { eventTitle: "友人の結婚式", offset: 6, title: "ご祝儀を用意する", isDone: false, reminderOffsetDays: -2 },
    { eventTitle: "友人の結婚式", offset: 6, title: "スーツをクリーニングに出す", isDone: false },
    { eventTitle: "ライブ鑑賞", offset: 14, title: "チケットを印刷する", isDone: false, reminderOffsetDays: -1 },
    { eventTitle: "旅行(温泉)", offset: 30, title: "宿を予約する", isDone: false },
    { eventTitle: "旅行(温泉)", offset: 30, title: "着替えを準備する", isDone: false },
    { eventTitle: "健康診断", offset: -20, title: "問診票を書く", isDone: true },
    { eventTitle: "確定申告の準備", offset: 21, title: "領収書をまとめる", isDone: false },
  ];
  lines.push("-- ===== ToDo =====");
  lines.push("insert into public.todos (event_id, title, is_done, completed_at, created_by, reminder_at) values");
  const todoValues = todoDefs.map((def) => {
    const event = findEvent(def.eventTitle, def.offset);
    if (!event) throw new Error(`ToDo紐付け先の予定が見つかりません: ${def.eventTitle} (offset ${def.offset})`);
    const completedAt = def.isDone ? toTimedTimestamp(addDays(today, def.offset - 1), 12, 0) : null;
    const reminderAt =
      def.reminderOffsetDays !== undefined ? toTimedTimestamp(addDays(today, def.offset + def.reminderOffsetDays), 9, 0) : null;
    return `  (${sqlStr(event.id)}, ${sqlStr(def.title)}, ${def.isDone}, ${sqlStr(completedAt)}, ${sqlStr(birdheadId)}, ${sqlStr(reminderAt)})`;
  });
  lines.push(todoValues.join(",\n") + ";");
  lines.push("");

  // ---- 献立記録 ----
  const mealDefs = [
    { calendarId: personalCalendarId, offset: -20, slot: "breakfast", title: "トースト・ヨーグルト", rating: 3 },
    { calendarId: personalCalendarId, offset: -18, slot: "dinner", title: "カレーライス", rating: 4, memo: "スパイスから手作り" },
    { calendarId: personalCalendarId, offset: -15, slot: "lunch", title: "駅前のラーメン屋", rating: 5, url: "https://example.com/ramen" },
    { calendarId: personalCalendarId, offset: -10, slot: "dinner", title: "餃子", rating: 4 },
    { calendarId: personalCalendarId, offset: -7, slot: "dinner", title: "鍋", rating: 5 },
    { calendarId: personalCalendarId, offset: -3, slot: "breakfast", title: "パンケーキ", rating: null },
    { calendarId: personalCalendarId, offset: -1, slot: "dinner", title: "唐揚げ", rating: 4 },
    { calendarId: personalCalendarId, offset: 1, slot: "dinner", title: "麻婆豆腐", rating: null },
    { calendarId: personalCalendarId, offset: 4, slot: "dinner", title: "焼肉", rating: null },
    { calendarId: familyCalendarId, offset: -22, slot: "dinner", title: "バーベキュー", rating: 5 },
    { calendarId: familyCalendarId, offset: -5, slot: "lunch", title: "手巻き寿司", rating: 4 },
  ];
  lines.push("-- ===== 献立記録 =====");
  lines.push("insert into public.meal_records (calendar_id, meal_date, slot, title, rating, url, memo, created_by) values");
  lines.push(
    mealDefs
      .map(
        (m) =>
          `  (${sqlStr(m.calendarId)}, ${sqlStr(addDays(today, m.offset))}, ${sqlStr(m.slot)}, ${sqlStr(m.title)}, ${m.rating ?? "NULL"}, ${sqlStr(m.url ?? null)}, ${sqlStr(m.memo ?? null)}, ${sqlStr(birdheadId)})`
      )
      .join(",\n") + ";"
  );
  lines.push("");

  lines.push("commit;");

  // 写真を付けたい予定のidを後続ステップに渡すためのメモ情報
  const photoTargets = [
    { title: "友人の結婚式", offset: 6, calendarId: personalCalendarId },
    { title: "花火大会", offset: -50, calendarId: personalCalendarId },
    { title: "ライブ鑑賞", offset: 14, calendarId: personalCalendarId },
    { title: "家族でバーベキュー", offset: -40, calendarId: familyCalendarId },
  ]
    .map((t) => events.find((e) => e.title === t.title && e.calendarId === t.calendarId))
    .filter(Boolean)
    .map((e) => e.id);

  return { sql: lines.join("\n") + "\n", photoTargets, familyCalendarId };
}

const SAMPLE_IMAGE_SEEDS = [101, 102, 103, 104];

async function ensureSampleImages() {
  const paths = [];
  for (const seed of SAMPLE_IMAGE_SEEDS) {
    const filePath = path.join(scratchDir, `sample-${seed}.jpg`);
    if (!existsSync(filePath)) {
      const res = await fetch(`https://picsum.photos/id/${seed}/1200/900.jpg`);
      if (!res.ok) throw new Error(`サンプル画像のダウンロードに失敗しました(id=${seed}): ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(filePath, buf);
    }
    paths.push(filePath);
  }
  return paths;
}

async function seedPhotos({ birdheadId, photoTargets, oldPhotoPaths }) {
  const env = loadEnvFile();
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const password = process.env.TEST_BIRDHEAD_PASSWORD;
  if (!password) {
    console.warn("TEST_BIRDHEAD_PASSWORD が未設定のため、写真の登録をスキップします。");
    return;
  }

  const client = createClient(supabaseUrl, anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({
    email: BIRDHEAD_EMAIL,
    password,
  });
  if (signInError) {
    console.warn(`test.birdheadへのログインに失敗したため、写真の登録をスキップします: ${signInError.message}`);
    return;
  }

  if (oldPhotoPaths.length > 0) {
    const { error } = await client.storage.from("event-photos").remove(oldPhotoPaths);
    if (error) console.warn(`古い写真の削除に失敗しました(続行します): ${error.message}`);
  }

  const imagePaths = await ensureSampleImages();

  for (let i = 0; i < photoTargets.length; i += 1) {
    const eventId = photoTargets[i];
    const imagePath = imagePaths[i % imagePaths.length];
    const fileName = path.basename(imagePath);
    const storagePath = `${eventId}/${Date.now()}_${fileName}`;
    const fileBuffer = readFileSync(imagePath);

    const { error: uploadError } = await client.storage
      .from("event-photos")
      .upload(storagePath, fileBuffer, { contentType: "image/jpeg" });
    if (uploadError) {
      console.warn(`写真のアップロードに失敗しました(event ${eventId}): ${uploadError.message}`);
      continue;
    }

    const { error: insertError } = await client
      .from("event_photos")
      .insert({ event_id: eventId, storage_path: storagePath, uploaded_by: birdheadId, is_thumbnail: true });
    if (insertError) {
      console.warn(`event_photosの登録に失敗しました(event ${eventId}): ${insertError.message}`);
    }
  }

  await client.auth.signOut();
}

async function main() {
  const { referenceDate } = parseArgs();
  const today = referenceDate ?? todayDateKey();
  console.log(`基準日: ${today}`);

  console.log("対象ユーザーを確認しています...");
  const ids = resolveIds();

  console.log("既存の写真を確認しています...");
  const oldPhotoPaths = fetchOldPhotoPaths(ids);

  console.log("カレンダーデータを作り直しています(既存データは削除されます)...");
  const { sql, photoTargets } = buildSeedSql(ids, today);
  runManagementSql(sql, "04-seed");

  console.log("写真を登録しています...");
  await seedPhotos({ birdheadId: ids.birdheadId, photoTargets, oldPhotoPaths });

  console.log("完了しました。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
