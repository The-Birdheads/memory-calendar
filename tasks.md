# Habitas / memory-calendar DB統合 検討メモ

このドキュメントは、Habitas(実体: `~/Dev/life-os`)とmemory-calendarのSupabaseプロジェクト統合について検討した内容の途中経過をまとめたもの。正式なKiro spec(`/kiro:spec-init`)は未実施 — 再開時に必要ならそちらへ昇格させる。

## 背景・目的

- ログインを共通化したい(1アカウントで両アプリを使いたい)
- 一部データを連携したい: Habitasのタスクに、memory-calendarの予定に紐付くToDoを表示し、進捗を共通管理したい

## 現状の結論(決定事項)

1. **1つのSupabaseプロジェクトに統合する**方針で合意。Habitas側のテーブルをmemory-calendar側の既存プロジェクト(本番稼働中)に移行する(逆方向より影響範囲が小さいため)。
2. Habitas側のテーブルは`habitas`スキーマに分離して置く(テーブル名自体はpublicと衝突していないが、所属を明確にするため)。
3. **進捗の同期方式**: DBトリガーによる双方向自動同期(`todos.is_done` ⇔ `habitas.task_entries.status`)。アプリ側の実装は不要。
4. **認証移行方式**: (b) 次回ログイン時にメールアドレスで再紐付け方式を採用(Google OAuthなら自動、メール/パスワードは一度だけ再ログインが必要)。低リスクを優先。
5. ToDo連携(`linked_todo_id`)が意味を持つのは、Habitasの`task_type = 'oneoff'`(単発タスク)のみ。`habit`(日次反復)は対象外。

## 調査で判明した事実

- Habitasの実体は `~/Dev/life-os`(Capacitorアプリ、iOS/Android対応、オフラインファースト)
  - ローカルSQLiteが主ストア、Supabaseへbest-effort pushで同期(`src/lib/db/sqliteRepository.ts`)
  - SupabaseプロジェクトRef: `nxspggurjyguhbdkraog`(South Asia / Mumbai)
- Habitasの現行スキーマ(`~/Dev/life-os/supabase/migrations/`、ベーステーブルはダッシュボードで直接作成されたためマイグレーション履歴なし):
  - `tasks`(id, user_id, title, task_type: habit/oneoff, due_date, is_active, priority, volume, memo, remind_*)
  - `task_entries`(id, user_id, day, task_id, status: todo/doing/done) — **日ごと**の進捗
  - `actions` / `action_entries` / `daily_logs` / `notification_settings` / `user_profiles`(サブスク管理、memory-calendarの`profiles`とは別物)
  - 全テーブルRLSは`user_id = auth.uid()::text`のみ。カレンダー/共有の概念なし、完全に個人用
  - **注意**: 既存データの`user_id`は`uuid`ではなく`TEXT`型で保存されている
- memory-calendar側の`todos`テーブルは単一の完了フラグ(`is_done`)のみで、日ごとの概念がない

## 作成済みの成果物

- **`supabase/migrations/20260921000000_habitas_integration_schema.sql`**
  - `habitas`スキーマと6テーブルを作成(user_idはuuidに是正)
  - `habitas.tasks.linked_todo_id` → `public.todos.id`の外部キー
  - リンク時に`is_event_calendar_member`でアクセス権を検証するトリガー
  - `todos.is_done` ⇔ `task_entries.status`の双方向同期トリガー
  - **まだどこにも適用していない(ドラフト)**

## 未決定・要確認の事項

- [ ] **進捗同期の「対象日」の仮定**: 現在のトリガー設計は「`tasks.due_date`(無ければ当日)」をtodoとの同期対象日としている。この前提が実際のHabitasの使われ方(oneoffタスクに必ずdue_dateが入るか等)と合っているか要確認。**ここがズレるとトリガーロジックの作り直しが必要**。
- [ ] ステージング環境が未構築。手順は合意済みだが未実施:
  1. 新規Supabaseプロジェクトを作成(例: `habitas-migration-staging`)
  2. `npx supabase link` + `npx supabase db push`でmemory-calendarの全マイグレーション(統合スキーマ含む)を適用
  3. テストデータを用意(本番データは使わず、ダミーデータ or PII除去した部分ダンプ)
  4. 両アプリの`.env`を一時的にステージング向けに切り替えて動作確認
  - プロジェクト作成とDBパスワード入力を伴う操作はダッシュボード側での作業が必要
- [ ] Habitas本番データの移行スクリプト(`user_id::text` → `uuid`変換、メールアドレスによる新規auth.usersとの紐付け)は未着手
- [ ] Supabaseダッシュボードの Settings > API > Exposed schemas に `habitas` を追加する作業(SQLだけでは完結しない)
- [ ] life-os(Habitas)側のアプリコードを`habitas`スキーマ参照に書き換える作業(Supabase JSクライアントは`.schema("habitas").from("tasks")`のような呼び出しが必要)は未着手
- [ ] memory-calendar側にToDo連携用のUI(Habitasのタスク作成/編集画面で既存ToDoを選んでリンクする導線)は未設計
- [ ] 移行の実施タイミング: ネイティブアプリのため新バージョンのリリース(App Store審査+段階的ロールアウト)が必須。**ロールアウト中は旧バージョンのユーザーのために旧Supabaseプロジェクトを生かしておく必要がある** — 具体的な移行日程・並行稼働期間は未検討
- [ ] Habitas本番DBのバックアップ(`pg_dump`等)は未実施

## 再開時の次アクション

1. 「対象日」の仮定を確認・確定する
2. ステージングプロジェクトを作成し、`npx supabase db push`でスキーマを再現する
3. ステージング上で認証再紐付けフロー(方式b)を実際に試す

---

## 進捗(2026-10-24 更新)

### 追加で決まったこと
- **旧Habitasプロジェクト(`nxspggurjyguhbdkraog`)は、新バージョン公開から4週間残してから止める。** 旧バージョンの利用者は多くて6名。新バージョンでの案内表示 + サーバー側のデータ移行スクリプトで対応する(旧バイナリにはお知らせ機能が無いため、周知は新バージョン側に置く)。
- **アカウント削除はアプリ別にする。** 押したアプリのデータだけを削除し、もう片方のアプリも使っていればアカウントは残す。使っていなければアカウントごと削除する。
  - Appleのトークン取り消しは、削除を行うアプリの `client_id` で行う(Appleの取り消しはアプリ単位なので、アカウントが残る場合も、そのアプリ分は取り消してよい)。

### 完了
- `20260921000000_habitas_integration_schema.sql` を、Habitasの同期コードに合わせて修正(ローカルで適用・動作確認済み)
  - `deleted_at`(tasks / actions / action_entries)、`updated_at`(actions / action_entries)を追加
  - 一意制約を追加: `task_entries(user_id, day, task_id)`、`notification_settings(user_id)`
  - `daily_logs.fulfillment` を null 許容に変更(未記入の日を null で保存するため)
  - `habitas` スキーマのAPI用GRANTを追加
- 新規 `20260922000000_app_usage_and_per_app_account_deletion.sql`
  - `app_usage`(どのアプリを使っているかの記録)、`register_app_use(app)`、`get_account_usage()`、`delete_app_data(app)` を追加
  - `delete_own_account()` は、既存アプリ(v1.0.2)との互換のため残し、中身を `delete_app_data('memory_calendar')` に置き換え
  - 利用記録の登録漏れで誤ってアカウントごと消さないよう、予定・共有カレンダー・Habitasタスクの実データがあれば「使用中」とみなす保険を入れた
- 新規テスト `supabase/tests/database/051_per_app_account_deletion.test.sql`(25件)。既存テスト(044など)を含む全51ファイルが通る
- `supabase/config.toml` の `[api] schemas` に `habitas` を追加
- ローカルでREST経由の確認済み: `habitas` スキーマへの upsert(onConflict 指定、`deleted_at`、`fulfillment: null`)、`register_app_use` / `get_account_usage` / `delete_app_data`

### 未着手
- [ ] **Supabase Dashboard(Memory Calendar側)**: Exposed schemas に `habitas` を追加 / Redirect URLs に `com.morikuma.habitas://login-callback` を追加 / Googleの認可済みリダイレクトURIを追加 / Apple の Client IDs に両方のBundle IDを登録
- [ ] **Habitasアプリ(life-os)**: `.env` を新プロジェクトへ変更、`createClient` に `db: { schema: "habitas" }`、ログイン後に `supabase.schema("public").rpc("register_app_use", { p_app: "habitas" })`、アカウント削除を `supabase.schema("public").rpc("delete_app_data", { p_app: "habitas" })` に変更(旧 `delete_user` は使わない)、確認画面の文言を `get_account_usage()` で出し分け、移行案内の表示、端末内の旧クラウドユーザーIDのデータを新IDへ付け替える処理(要検証)
- [ ] **Memory Calendarアプリ**: ログイン後に `register_app_use("memory_calendar")` を呼ぶ、削除確認の文言を出し分ける、`revoke-apple-token` を `client_id` ごとに切り替える
- [ ] **データ移行スクリプト**: Googleはメール、Appleは旧 `auth.identities` の `sub` で突き合わせる(Appleで「メールを隠す」の人はメールでは一致しない)。`user_id` を text から uuid に変換し、`app_usage` に 'habitas' を登録する。実行前に、旧プロジェクトの `pg_dump --schema-only` で列の型を確認する
- [ ] ステージング環境での通し確認、旧DBのバックアップ
- [ ] 両アプリのプライバシーポリシーに、共通アカウントと削除の仕様を追記(メールで案内する場合は、利用目的に「サービス変更のお知らせ」も追記)
- [ ] 既存の課題: アバター画像・写真のStorageオブジェクトは、アカウント削除のSQLでは消えない(従来どおり。別途要検討)

---

## 進捗(2026-10-24 その2)

### 完了
- 本番DBへのマイグレーション適用(`20260921000000` / `20260922000000`、`--include-all`)と、ダッシュボード設定(Exposed schemas、Redirect URLs、Apple Client IDs)。`habitas` スキーマが外部から見える(42501)ことまで確認済み
- Habitas アプリ側(life-os のブランチ `feature/shared-auth-memory-calendar`、未コミット)
  - 接続先スキーマを `habitas` に、RPC は `schema("public")` で呼ぶ(`src/lib/supabase.ts`、`src/lib/accountApi.ts`)
  - ログイン後に `register_app_use`、アカウント削除は `delete_app_data`、確認画面の文言を `get_account_usage` で出し分け
  - 更新後の初回起動で、旧セッションのユーザーIDの端末内データをローカルIDへ付け替え、再ログインのお知らせを表示(`src/lib/legacyAuthMigration.ts`)
  - ローカルの Supabase に対して、Habitas の同期が送る形のデータ(SQLiteの `0/1` など)で、書き込み・読み取り・RLS・アプリ別削除を通しで確認済み

### 新たに分かった課題(未対応)
- [ ] **【重要】Memory Calendar の `signOut` を `scope: "local"` にする**(`src/features/auth/service.ts:192`、`PersonalSettingsPanel.tsx:98` の削除後のサインアウトも同様)。既定の global だと、ログアウトで Habitas を含む全端末・全アプリのログインが外れる。Habitas 側は対応済み。**Memory Calendar の更新を、Habitas の新バージョンより前、または同時に出すこと**(旧 v1.0.2 でログアウトすると、Habitas の新バージョンのログインも外れる)
- [ ] **データ移行スクリプトは、行ID(uuid)を変えずに移す**こと。端末内データのログイン後の統合(行IDで照合)で、重複を作らないため
- [ ] Habitas は、アカウント削除時の **Apple トークン取り消しが未実装**(Memory Calendar の `revoke-apple-token` は、`client_id` が Memory Calendar のものに固定)。`client_id` を受け取れるようにして、Habitas からも呼ぶ
- [ ] Habitas のアプリ表示名が Habitas、Google の同意画面のアプリ名は Memory Calendar 側の Google Cloud プロジェクトの設定になる。両アプリに通用する名前にするか確認
- [ ] ステージングでの実機通し確認(新規ユーザー、旧ユーザーの再ログイン、アカウント削除2パターン)

---

## 進捗(2026-10-24 その3: Memory Calendar 側の対応)

### 完了(ブランチ `feature/shared-account-integration`、未コミット)
- `signOut` を `scope: "local"` に変更(`src/features/auth/service.ts`)。ログアウトで Habitas のログインを巻き込まない
- ログイン後に `register_app_use("memory_calendar")` を呼ぶ(`registerAppUse`、`useAuthSession`)。ユーザーが変わるたびに1回、失敗は無視
- アカウント削除の確認画面の文言を、Habitas も使っているかで出し分け(`get_account_usage` を使う `isHabitasInUse`、`DeleteAccountConfirmModal`、`PersonalSettingsPanel`)。取得できないときは汎用の文言
- `revoke-apple-token` が `clientId` を受け取る(許可リスト: `com.thebirdseed.memorycalendar` と `com.morikuma.habitas`。未指定は従来どおり)。`resolveAppleClientId`(`_shared/appleAuth.ts`)
- 検証: Jest 全145ファイル(1788件)通過、型チェック通過。Edge Function はローカルで起動し、非Apple→400、Apple+許可リスト内→認証情報の設定チェックへ進む(ローカルは未設定のため500)、許可リスト外→400 を確認

### 本番に反映するときの作業(未実施)
- [ ] Edge Function のデプロイ: `supabase functions deploy revoke-apple-token`(本番プロジェクトにリンクした状態で)。これをデプロイしないと、Habitas から `clientId` を渡しても無視される(既定の Memory Calendar の client_id で失効しようとして失敗する)
- [ ] **Apple Developer の確認**: Habitas の client_id で認可コードを交換するとき、`APPLE_KEY_ID` のキーが Habitas の App ID でも使える必要がある。Sign in with Apple のキーは「プライマリ App ID」に紐づくため、Habitas の App ID をグループ化する(Identifiers → Habitas → Sign in with Apple → Edit)か要確認。ステージングで実際に失効できるか試す
- [ ] Memory Calendar の新バージョンのリリース(Habitas の新バージョンより前、または同時)

### Habitas 側の Apple 失効(完了、life-os のブランチ `feature/shared-auth-memory-calendar`、未コミット)
- アカウント削除の前に、Apple でログインした人は Apple の確認画面で認可コードを取得し、`revoke-apple-token` を `clientId: "com.morikuma.habitas"` で呼ぶ(`revokeAppleAuthorizationIfNeeded`、`src/lib/accountApi.ts`)
- 確認画面を閉じたら削除を中止。取り消しに失敗しても削除は続行。iOS 以外は取り消しをスキップ
- **実機(TestFlight)での確認が必要**: ① Edge Function を本番へデプロイ済みであること ② Apple のキーが Habitas の client_id でも使えること。Apple が `invalid_client` を返す場合は、Habitas の primary App ID に紐づくキーを追加発行し、`revoke-apple-token` を `clientId` ごとにキーを切り替える形に拡張する(Apple Developer の App ID のグループ化は不要。公開済みの Habitas の Apple ユーザーに影響する恐れがあるため変更しない)

---

## 進捗(2026-10-24 その4: 実機確認の結果と修正)

### 実機確認で分かったこと
- Habitas のアカウント削除で、Memory Calendar(v1.0.2)にログインしていたアカウントが「Habitas だけの利用者」と判定され、アカウントごと削除された。原因: v1.0.2 は `register_app_use` を呼ばない + 予定・共有カレンダーが無い、のため使用中と判定できなかった(テスト手順の不備でもあるが、実運用でも起こり得る)
- 通知設定(`notification_settings`)が、ローカル→クラウドへの付け替え(`migrate`)の対象外だった(旧バージョンのデータの引き継ぎ・ログイン時の統合の両方で、設定が引き継がれない)

### 修正(ブランチ未コミット)
- `20261024000000_app_in_use_more_memory_calendar_signals.sql`: `_app_in_use` の根拠に Push トークン・ToDo・タグを追加(+ pgTAP `052`)。**本番へ未適用**(`supabase db push --linked`)
- life-os: `migrate()` が `notification_settings` も付け替える(移行先に既にあれば移行先を優先)。旧データの引き継ぎ処理にログを追加

### 未解決・要確認
- [ ] シナリオ C: 同じ Apple ID が Habitas と Memory Calendar で同じユーザーになるか(前提の確認)。`auth.users` / `auth.identities` / `app_usage` を突き合わせて確認する
- [ ] シナリオ A: 上書きインストールで旧データが見えなかった原因(端末内のデータが引き継がれていない可能性)。Xcode のコンソールで `[legacy]` と `[initSqlite]` のログを確認する
- [ ] **Memory Calendar の新バージョン(`register_app_use` を呼ぶ版)を、Habitas より前にリリースする**(根本対策)

### 追記(シナリオ A の原因の見当、2026-10-24)
- 実機ログで、旧データの付け替え(`[legacy] adopted ...`)は動いたが、付け替える旧データが端末内に無かった。原因: **iOS は Web 版 SQLite(jeep-sqlite)を使っており、書き込みごとの保存(`saveToStore`)が web のときだけだった**。iOS では起動時のスナップショットしか IndexedDB に残らず、アプリを終了すると、その回の端末内の記録が失われていた(ログイン中はクラウドから復元されるため、気づかれにくい)
- 修正: `save()` を iOS でも行う(life-os、未コミット)。実機で、オフラインモードで記録 → アプリを終了 → 再起動して残っているかで確認する
- 結論: 既存ユーザーのデータは、端末内の付け替えより、**旧プロジェクトのサーバーにあるデータを移行スクリプトで新プロジェクトへ移す**ことが本命。移行スクリプトが無い現状では、旧データはログインしても戻らない(想定どおり)

---

## 進捗(2026-10-25: シミュレータ確認、Apple 失効、移行スクリプト)

- 実機で、Apple のトークン失効が成功(原因は CORS。`revoke-apple-token` が OPTIONS に応答していなかった)。関数は本番にデプロイ済み
- シミュレータ + ローカル Supabase で、ログイン・同期・削除の確認文言・アプリ別削除を確認(ディープリンクでセッションを注入)
- **データ移行スクリプト**を作成(life-os `scripts/migrate-legacy/`、手順は README.md)。ローカルで、ドライラン・書き込み・再実行(上書きしない)・Apple の sub での突き合わせ・ユーザーの作成を確認済み。管理 API の一覧は `identities` が null で返るため、個別取得で補っている
- 未実施: 旧プロジェクトのスキーマダンプでの列の型の確認、本番でのドライラン、`--create-missing-users` の自動連携の確認

### 追記(移行方式の決定)
- **方式B(先にユーザーを作ってから移行)で実施**。ユーザーに個別連絡できず、利用状況も不明なため
- `--create-missing-users` は、移行するデータが無いユーザーは作らない。新ユーザーには、旧版の Apple/Google の識別子を `auth.identities` に直接登録する SQL を書き出す(メールの自動連携に頼らない)。実行は `supabase db query --linked -f`
- 本番の一括実行の前に、新しいテスト用 Google アカウントで、旧版にログイン → 移行 → 新バージョンでログイン、を1人分、通しで確認する(識別子で、同じユーザーとしてログインできることの確認は、実際の Google/Apple でしかできない)
