# Research & Design Decisions Template

## Summary
- **Feature**: `shared-calendar`(タグ/ToDoの個人所有化、個人用カレンダーの自動付与、予定削除時のToDo保持・復活、予定削除通知の追加)
- **Discovery Scope**: Extension(既存の共有カレンダー基盤に対する所有権モデルの変更)
- **Key Findings**:
  - `tags`は現状`calendar_id`所有、`todos`は`event_id`のみでカレンダーメンバー全員が閲覧可能なRLSになっており、いずれも「個人所有」要件と不整合だった
  - `handle_new_user()`トリガー(profiles自動作成)と同一パターンを流用すれば、個人用カレンダーの自動生成を追加コンポーネントなしに実現できる
  - `event-change-notifier`は現状`events`のINSERT/UPDATEのみ処理しており、DELETEイベントの通知は未実装だった(要件6.3の追加が必要)

## Research Log

### tags/todosの現行RLSと所有権モデル
- **Context**: タグ・ToDoを「カレンダー共有」から「ユーザー個人所有」に変更するにあたり、現行実装の正確な挙動を確認する必要があった
- **Sources Consulted**: `supabase/migrations/20260818030000_create_tags.sql`, `supabase/migrations/20260818040000_create_event_tags.sql`, `supabase/migrations/20260818090000_create_todos.sql`
- **Findings**:
  - `tags.calendar_id`は`not null references calendars`。RLSは`is_calendar_member(calendar_id, auth.uid())`のみで、カレンダーメンバー全員が閲覧・作成可能
  - `todos.event_id`は`on delete cascade`。RLSは`is_event_calendar_member(event_id, auth.uid())`のみで、`created_by`は記録されているが閲覧制限には使われていない
  - `event_tags(event_id, tag_id)`のRLSも`is_event_calendar_member`のみで、タグの所有者は考慮されていない
- **Implications**: 所有権モデルの変更はRLSポリシーの全面的な書き換えを伴う。`tags`は`calendar_id`列を`user_id`列に置き換え、`todos`は`event_id`を`nullable`にした上でRLSに`created_by = auth.uid()`条件を追加する

### 個人用カレンダー自動生成のトリガーパターン
- **Context**: サインアップ時に個人用カレンダーを自動生成する仕組みを、既存の実装パターンに沿って設計したい
- **Sources Consulted**: `supabase/migrations/20260817093453_create_profiles_and_rls_helper.sql`
- **Findings**: `auth.users`へのINSERTをトリガーに`handle_new_user()`(SECURITY DEFINER)が`profiles`行を自動作成する仕組みが既に存在する
- **Implications**: 同じトリガー関数(または追加のトリガー)を拡張し、`calendars(kind='personal')`と`calendar_members(role='owner')`を同一トランザクションで作成する。SECURITY DEFINERによりRLSをバイパスできるため、新規ユーザーがまだ`calendar_members`に所属していない時点でも書き込み可能

### event-change-notifierの通知対象イベント
- **Context**: 予定削除の通知(要件6.3)を既存のEdge Functionに追加できるか確認する
- **Sources Consulted**: `supabase/functions/event-change-notifier/index.ts`
- **Findings**: 現状`events`テーブルの`INSERT`/`UPDATE`、`event_comments`の`INSERT`、`event_series_creation_events`の`INSERT`のみを処理しており、`DELETE`は未処理
- **Implications**: 同一Functionに`events`テーブルの`DELETE`分岐を追加する。DB Webhookの`DELETE`ペイロードは`old_record`に削除前の行(`calendar_id`等)を含むため、削除後でも通知対象カレンダーを特定できる

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| ToDo孤立化(event_id: null) | 予定削除時にToDoを`on delete set null`で保持 | 個人データの所有権を尊重、既存の「予定+ToDo」構造を再利用できる | ToDo一覧画面に「未紐付け」セクションの追加実装が必要 | 採用 |
| ToDo孤立化なし(cascade維持) | 現状のまま予定と運命を共にする | 実装コスト最小 | 他人の非公開データを断りなく削除する問題が残る | 不採用(要件9.8で明示的に却下) |
| 予定削除をブロック/警告 | 他メンバーの未完了ToDo件数を匿名集計して警告 | プライバシーを保ったまま注意喚起できる | RLSを跨いだ集計ロジックが必要で複雑 | 不採用(過剰実装と判断) |

## Design Decisions

### Decision: タグ・ToDoをユーザー個人所有に変更する
- **Context**: 複数カレンダーに参加するユーザーが同じ概念のタグを重複登録してしまう問題、および共有予定のToDoが他メンバーにも見えてしまう問題
- **Alternatives Considered**:
  1. カレンダー単位のまま名寄せ機能を追加する — カレンダーを跨いだタグ統合の複雑なUIが必要になり過剰実装
  2. タグ・ToDoをユーザー個人所有に変更する(採用)
- **Selected Approach**: `tags.calendar_id`を`tags.user_id`に置き換え、`todos`のRLSに`created_by = auth.uid()`を追加してカレンダーメンバー間でも非公開にする
- **Rationale**: タグ・ToDoは「本人がどう分類・準備するか」という個人の視点に依存する情報であり、共有カレンダーの体験(予定・写真・コメント)とは性質が異なる
- **Trade-offs**: 予定に付いたタグを他メンバーが見られなくなる(コミュニケーション上の一覧性は下がる)が、振り返りの一貫性を優先する
- **Follow-up**: 献立タグ(`meal_tags`)は今回のスコープ外とし、据え置く(要件定義の対象外に明記)

### Decision: 個人用カレンダーをサインアップ時に自動生成し、手動作成を廃止する
- **Context**: 個人用カレンダーをユーザーが任意のタイミングで複数作成できると、タグ・ToDoの「個人設定」としての置き場所が曖昧になる
- **Alternatives Considered**:
  1. 個人用カレンダーの手動作成を維持し、ユーザーに1つに絞ってもらうよう促す — 運用でカバーする方式で確実性がない
  2. サインアップ時に自動生成し、以後の新規カレンダー作成は共有(グループ)カレンダーのみに限定する(採用)
- **Selected Approach**: `handle_new_user()`トリガーを拡張し、`calendars(kind='personal', name='Myカレンダー')`と対応する`calendar_members(role='owner')`を自動生成する。`calendars`への直接INSERTは`kind = 'group'`のみ許可するようRLSを制約する。既存ユーザー分は一度きりのデータ移行で対応する
- **Rationale**: 個人用カレンダーの単一性をDBレベルで保証し、UIから「種類を選ぶ」ステップ自体を除去できる
- **Trade-offs**: 移行が必要になる分、実装コストは増える。ただし現状は実質テスト用アカウントのみが対象のため影響は限定的
- **Follow-up**: `calendars(created_by) where kind = 'personal'`への部分ユニークインデックスで、1ユーザー1個人用カレンダーの不変条件をDBレベルでも保証する

### Decision: 予定削除時のToDoは孤立化させ、復活操作を提供する
- **Context**: 共有予定の削除者が、他メンバーの非公開ToDoを断りなく消してしまう問題
- **Alternatives Considered**: Architecture Pattern Evaluationを参照
- **Selected Approach**: `todos.event_id`を`nullable`にし`on delete set null`に変更。ToDo一覧画面に未紐付けセクションを設け、「既存の予定に追加」(任意の閲覧可能な予定への再紐付け)と「予定を新規作成」(個人用カレンダーに新規予定を作成して紐付け)の2つの復活操作を提供する
- **Rationale**: ToDoの所有権を尊重しつつ、既存の「予定+ToDo」の構造を変えずに済む
- **Trade-offs**: ToDo一覧画面の実装(未紐付けセクション、予定選択モード、新規予定作成フォームの簡易版)が増える
- **Follow-up**: 予定選択モードはカレンダー画面の月表示を流用し、選択専用モードを追加する形で実装する

### Decision: 予定削除通知をEventChangeNotifierに追加する
- **Context**: 予定削除がこれまで一切通知されておらず、ToDo孤立化と組み合わせると他メンバーが変化に気づけない
- **Alternatives Considered**:
  1. 新規のEdge Functionを追加する — 既存の通知ロジック(対象者解決、notification_log記録)を重複実装することになる
  2. 既存の`EventChangeNotifier`にDELETE分岐を追加する(採用)
- **Selected Approach**: `events`テーブルのDB Webhookペイロードに`DELETE`イベントを追加購読し、`old_record`から`calendar_id`を取得して対象カレンダーの他メンバーに通知する
- **Rationale**: 既存の通知対象者解決・冪等性(`notification_log`)の仕組みをそのまま再利用できる
- **Trade-offs**: なし
- **Follow-up**: なし

## Risks & Mitigations
- 既存の手動作成された個人用カレンダーが複数存在する場合の統合漏れ — 移行スクリプトは`created_by`ごとに最古の`personal`カレンダーを正とし、他を統合・削除する形で対応する
- `event_tags`のSELECT RLSがタグ所有者の条件を見落とすと、他人のタグ紐付けが閲覧できてしまう — 実装時にRLSポリシーのテストケースを必ず追加する
- ToDo一覧画面の「未紐付け」セクションが増えることによるUIの複雑化 — 既存の「過去のToDoを表示」トグルと同じ折りたたみパターンを踏襲し、一貫性を保つ

## References
- 既存マイグレーション: `supabase/migrations/20260818030000_create_tags.sql`, `20260818040000_create_event_tags.sql`, `20260818090000_create_todos.sql`, `20260817093453_create_profiles_and_rls_helper.sql`
- 既存Edge Function: `supabase/functions/event-change-notifier/index.ts`
