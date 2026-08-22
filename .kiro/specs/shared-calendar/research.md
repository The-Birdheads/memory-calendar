# 調査・設計判断ログ

## 概要
- **機能名**: `shared-calendar`
- **調査範囲**: 新規機能(グリーンフィールドの新規プロダクト全体)
- **主要な発見**:
  - Supabase(Postgres + Auth + Storage + Realtime + Edge Functions)は、共有カレンダーのようなマルチユーザー権限管理をRow Level Security(RLS)でデータベース層に強制でき、個別バックエンドサーバーを自前実装するより開発速度と安全性を両立できる。
  - RLSでの再帰的な権限チェック(カレンダーメンバーか否かの判定)は`SECURITY DEFINER`ヘルパー関数で行うのが、素朴なEXISTSサブクエリより行毎コストが低くスケールする。
  - リマインダー通知はデバイスローカル通知(expo-notifications)だけでは「共有データの変更を他メンバーへ通知する」要件(6.1-6.3)を満たせないため、サーバー起点のプッシュ配信(Expo Push Service + Supabase Edge Functions)を採用する。
  - タグの階層(大分類・中分類・小分類)は固定3階層であり、ltree(materialized path)ほどの汎用ツリー構造は過剰。自己参照(parent_id)によるadjacency listで十分にシンプルかつ要件を満たす。
  - 設計レビュー(design-review)で指摘された繰り返し予定の思い出粒度の問題を受け、各回の予定を個別データとして事前生成する方式に変更した(下記Design Decisions参照)。
  - 2回目の設計レビューでは、事前生成方式が引き起こす副作用(リマインダー時刻列の欠落、予定削除時のカスケード未定義、シリーズ一括生成による通知スパム)を特定し、`events.reminder_at`列の追加・カスケード削除+UI確認・`event_series_creation_events`による通知集約で解消した。

## 調査ログ

### Supabaseによるマルチユーザー権限管理(カレンダー共有)
- **背景**: 複数人でカレンダーを共有し、メンバーのみが予定・ToDo・タグ・献立記録を閲覧・編集できるようにする必要がある(要件2, 3, 9-12)。
- **参照した情報源**:
  - [Row-Level Security in Supabase: Multi-Tenant SaaS from Day One](https://dev.to/issuecapture/row-level-security-in-supabase-multi-tenant-saas-from-day-one-4lon)
  - [Authorization via Row Level Security | Supabase Features](https://supabase.com/features/row-level-security)
  - [Supabase RLS Best Practices: Production Patterns for Secure Multi-Tenant Apps](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- **発見事項**:
  - 共有リソースパターン(shared resources pattern)として、`calendar_members`のような中間テーブルを使い、RLSポリシーで「対象カレンダーのメンバーであるか」を判定するのが定石。
  - RLSはアプリケーションコードを迂回されても効く最終防衛ラインであり、後付けではなく設計の土台として組み込むべき。
  - 複数テーブルをJOINするクエリでは、各テーブルのRLSポリシーが個別に評価されるため、`events`・`event_comments`・`todos`など全ての子テーブルにも`calendar_members`経由のポリシーが必要。
  - 再帰的権限チェックは`SECURITY DEFINER`関数化してポリシー内から呼び出すことで、パフォーマンス劣化を防げる。
- **設計への示唆**: カレンダー配下の全テーブル(events, todos, tags, meal_records等)に`calendar_id`を保持させ、共通のヘルパー関数`is_calendar_member(calendar_id, uid)`を介したRLSポリシーで統一的にアクセス制御する設計とする。

### プッシュ通知・リマインダー配信
- **背景**: 予定追加・変更・コメント投稿の通知(要件6)と、ToDoのリマインド(要件9.3)を実現する必要がある。
- **参照した情報源**:
  - [React Native Push Notifications with Expo (2026 Guide)](https://www.shipnative.dev/blog/push-notifications-expo-2026-setup-guide)
  - [Expo Local Notifications in 2026: Schedule Alerts and Handle Permissions on iOS & Android](https://www.codesofphoenix.com/articles/expo/local-notifications-expo)
  - [React Native Push Notifications 2026 — Notifee vs Expo Notifications vs OneSignal](https://www.pkgpulse.com/guides/notifee-vs-expo-notifications-vs-onesignal-react-native-2026)
- **発見事項**:
  - ローカル通知(expo-notifications)はサーバー不要で日次リマインダー等に向くが、他メンバーの操作をトリガーに通知する用途には使えない(自端末で完結するため)。
  - Expo Notificationsは、ローカル通知とExpo Push Service経由のリモートプッシュの両方を1パッケージでカバーできる。
  - リモートプッシュの本番運用にはEAS Buildによるdev build/本番buildが必要(Expo Go単体では不可)。
- **設計への示唆**: 「予定変更・コメント投稿の通知」(6.1-6.3)と「ToDoリマインド」(9.3)は共に共有データに基づくため、両方ともサーバー起点(Supabase Edge Functions → Expo Push API)で統一する。デバイス側は起動時にExpo Push Tokenを取得し`push_tokens`テーブルに登録するのみとし、スケジューリングやトリガー判定はサーバー側に一元化する。

### タグの階層構造の実装方式
- **背景**: 予定タグは大分類・中分類・小分類の3階層固定(要件10.2)。献立タグは階層を持たないフラットな分類(要件12.3)。
- **参照した情報源**:
  - [Hierarchical models in PostgreSQL | Ackee blog](https://www.ackee.agency/blog/hierarchical-models-in-postgresql)
  - [Implementing Hierarchical Data Structures in PostgreSQL: ltree vs Adjacency List vs Closure Table](https://dev.to/dowerdev/implementing-hierarchical-data-structures-in-postgresql-ltree-vs-adjacency-list-vs-closure-table-2jpb)
- **発見事項**:
  - ltree(materialized path)は深い・可変長のツリーや高度な祖先検索クエリに強いが、GiSTインデックスのサイズ制限やサブツリー移動の複雑さがコストになる。
  - adjacency list(自己参照`parent_id`)は実装がシンプルで、階層が浅く固定(今回は3階層)であれば十分な性能と可読性を持つ。PostgreSQLの再帰CTEで祖先・子孫取得も容易。
- **設計への示唆**: 予定用`tags`テーブルは`parent_id`自己参照 + `level`列(major/mid/minor)のadjacency listを採用。献立用`meal_tags`は親子関係を持たないフラットテーブルとして完全に分離する(要件12.3の「予定用とは別分類」に対応)。

## アーキテクチャパターンの評価

| 選択肢 | 説明 | 強み | リスク・制約 | 備考 |
|--------|------|------|--------------|------|
| BaaS中心のレイヤードクライアントアーキテクチャ(採用) | React Native クライアント + Supabase(Postgres/Auth/Storage/Realtime/Edge Functions)をバックエンドとして直接利用 | 開発速度が速い、RLSでドメイン境界を強制できる、Realtimeで即時同期が容易 | ベンダーロックイン、複雑なビジネスロジックはEdge Functionsに逃がす必要あり | MVPフェーズのspec規模・チーム規模に適合 |
| 自前APIサーバー(Node.js/NestJS等) + RDB | クライアント⇔自前REST/GraphQL API⇔DB | フルコントロール、ベンダー非依存 | 認証・リアルタイム同期・権限管理を全て自前実装する必要があり開発コスト大 | 12要件を持つMVPには過剰投資 |
| マイクロサービス(ドメイン毎に別サービス) | Calendar/Todo/Meal等をサービス分割 | 将来的なスケール・チーム分割に強い | 単一チーム・単一Postgresで足りる規模には過剰、運用複雑性が要件を上回る | 本specでは非採用、将来の分割は可能な設計(スキーマ境界を明確化)にとどめる |

## 設計判断

### 判断: バックエンド基盤にSupabase(BaaS)を採用
- **背景**: 認証・共有カレンダーの権限管理・リアルタイム同期・画像ストレージ・通知トリガーを、新規プロダクトとして最小構成で立ち上げる必要がある。
- **検討した代替案**:
  1. 自前APIサーバー(NestJS等) + マネージドPostgres — フルコントロールだが認証・RLS相当の権限機構を自前実装する必要がある
  2. Firebase(Firestore + Auth + Cloud Functions) — NoSQLのためタグ階層・献立集計などリレーショナルなクエリが複雑化しやすい
  3. Supabase(Postgres + Auth + Storage + Realtime + Edge Functions) — 採用
- **採用したアプローチ**: Supabaseをバックエンドとして採用し、RLSでカレンダー単位のアクセス制御を行う。
- **根拠**: 本プロダクトの権限モデルは「カレンダーメンバーか否か」を軸としたリレーショナルな構造(予定・ToDo・タグ・献立が全てカレンダーに従属)であり、Postgresのリレーショナルモデルと相性が良い。RLSにより権限ロジックをアプリケーションコードとDBの二重管理にせず一元化できる。
- **トレードオフ**: Supabaseへのベンダー依存が生じるが、標準的なPostgresをベースにしているためマイグレーションパスは比較的容易。
- **フォローアップ**: RLSポリシーのパフォーマンスは主要テーブル(events, todos)に対して実データ量で検証する。

### 判断: 通知配信をサーバー起点のプッシュ通知に統一
- **背景**: 予定変更・コメント投稿・ToDoリマインドは、いずれも「自分以外の操作や時刻経過をトリガーに他メンバーへ知らせる」性質を持つ。
- **検討した代替案**:
  1. 端末ローカル通知(expo-notifications単体) — 他メンバー操作起点の通知を配信できない
  2. サードパーティ通知サービス(OneSignal等) — 追加のベンダー・コストが発生
  3. Supabase Edge Functions + Expo Push Service — 採用
- **採用したアプローチ**: DB変更(INSERT/UPDATE)をトリガーに Edge Function を起動して即時通知、リマインドは pg_cron が Edge Function を毎分起動して期限到来分を配信する。
- **根拠**: 既存のSupabaseスタックに統合でき、追加ベンダーを増やさずに済む。
- **トレードオフ**: pg_cronによる1分間隔ポーリングは大規模化時にコストが増えるが、MVP規模では許容範囲。
- **フォローアップ**: 通知量が増えた場合はpg_cron間隔の見直し、またはキュー(pgmq等)導入を検討する。

### 判断: タグ階層はadjacency listで実装、献立タグは完全に別テーブルで分離
- **背景**: 予定タグは3階層固定、献立タグはフラットかつ予定タグと独立(要件10.2, 12.3)。
- **検討した代替案**:
  1. ltree拡張によるmaterialized path — 汎用的だが3階層固定の用途には過剰
  2. 単一`tags`テーブルに`domain`列(event/meal)を持たせて共用 — 要件が「予定とは別」と明示しているため意味的な混在になる
  3. `tags`(予定用・階層あり)と`meal_tags`(献立用・フラット)を別テーブルとして分離 — 採用
- **採用したアプローチ**: `tags(parent_id, level)`のadjacency listと、独立した`meal_tags`(階層なし)の2テーブル構成。
- **根拠**: 要件文言(「タグは予定とは別で」)を素直にモデル化でき、将来の拡張(階層追加等)も互いに影響しない。
- **トレードオフ**: テーブル・UIコンポーネントの一部が重複するが、ドメインの独立性を優先する。
- **フォローアップ**: 将来的にタグ管理UIを共通化する場合は、表示コンポーネントのみ共有し、データモデルは分離を維持する。

### 判断: 繰り返し予定は各回を個別データとして事前生成する(materialize方式)
- **背景**: design-reviewの指摘(Critical Issue 1)により、「実施済みの予定を思い出として振り返る」機能が繰り返し予定では正しく成立しないことが判明した。当初案は`recurrence_rule`を保持した親イベント1行から表示時に仮想展開する方式であり、写真・コメントが`event_id`(親)にのみ紐づくため、特定回の思い出が全回に波及してしまう欠陥があった。
- **検討した代替案**:
  1. 仮想展開を維持し、`event_photos`/`event_comments`に`occurrence_date`列を追加して回ごとに区別する — 実装は軽いが、ToDo・タグ・コメントなど関連テーブル全てに`occurrence_date`を波及させる必要があり一貫性維持が煩雑
  2. 繰り返し登録時に各回を個別の`events`行として事前生成し、共通の繰り返しID(`series_id`)で紐づける — 採用(ユーザー指定)
- **採用したアプローチ**: 繰り返し予定の登録時に、繰り返し定義自体を`event_series`テーブルに保存し、各回の予定は独立した行として`events`テーブルに生成する。各行は`series_id`で元の繰り返し定義に紐づく。まとめて編集・削除する操作は、同一`series_id`を持つ全ての`events`行に変更を適用する。さらにユーザーからの追加指示により、繰り返しの終了日指定を必須(NOT NULL)とし、開始日から終了日までを最大1年以内に制限する(要件3.4)。
- **根拠**: 各回が実データとして独立するため、写真・コメント・ToDo・タグの紐付けが自然に回ごとに独立し、思い出化の要件(7.6)を追加実装なしに満たせる。「まとめて操作」の要件(3.6)は`series_id`によるバッチ更新で実現できる。終了日を必須化することで、無期限繰り返しの生成horizon管理・延伸バッチという追加の複雑性を排除できる。
- **トレードオフ**: 仮想展開方式に比べてストレージ使用量は増えるが、1シリーズあたりの生成件数は最大1年分に有限化されるため許容範囲。ユーザーは「終了日なしの繰り返し」を作成できなくなる(必要であれば都度、終了日を1年延長して再登録する運用となる)。
- **フォローアップ**: なし(終了日必須化により、当初想定していた延伸バッチ`SeriesMaterializer`は不要になり設計から削除した)。

### 判断: リマインド通知の対象者を予定ごとに選択可能にする
- **背景**: design-reviewの指摘(Critical Issue 3)により、リマインド通知の配信対象(全メンバー vs 特定メンバー)が未確定のまま契約が先行して記述されていた。
- **検討した代替案**:
  1. 常に全メンバーに配信する — シンプルだが「自分だけが担当する準備」のような個人向けリマインドに不向き
  2. ToDo作成者のみに配信する — 予定単位の意図(誰が対応すべきか)を表現できない
  3. 予定ごとに対象者(すべて/特定メンバー)を選択できるようにする — 採用(ユーザー指定)
- **採用したアプローチ**: `events`に対する対象者選択UIを設け、選択結果を`event_reminder_targets`テーブル(予定IDとユーザーIDの組)に保存する。行が存在しない予定は「すべてのメンバー」を対象とみなす。予定に紐づくToDoのリマインドは、当該予定の対象者設定を継承する。予定変更・コメント投稿の通知(6.1-6.3)は本設定の対象外とし、引き続き全メンバーへブロードキャストする(リマインドと変更通知は性質が異なるため)。
- **根拠**: 「行が存在しない=全員」をデフォルトとすることで、既存の全メンバー通知の挙動を後方互換的に維持しつつ、必要な予定だけ絞り込める。
- **トレードオフ**: ToDo単位で個別に対象者を変えたいという将来要望が出た場合は、`todos`側にも独自の対象者テーブルを追加する拡張が必要になる。
- **フォローアップ**: なし(本specの範囲で完結)。

### 判断: Edge Functionsはservice role権限で動作し、RLSはクライアント直接アクセスの認可モデルとして位置づける
- **背景**: design-reviewの指摘(Critical Issue 2)により、Security Considerationsが「RLSが唯一の認可モデル」と記載する一方、Webhook/cron起点のEdge Functionsはユーザーセッションを持たずservice role権限を要することが未記載だった。
- **検討した代替案**:
  1. Edge Functionsも各ユーザーのJWTを模擬して呼び出す — 起点がDB Webhookやpg_cronであるため実現不可
  2. Edge Functionsはservice role鍵で動作し、RLSをバイパスして必要な範囲のみ読み書きする — 採用
- **採用したアプローチ**: `EventChangeNotifier`と`NotificationDispatcher`はSupabaseのservice role鍵を用いてDBへアクセスする。service role鍵はSupabase Edge Functionsのシークレットとして管理し、クライアントには一切配布しない。RLSは「クライアントからの直接アクセス」における唯一の認可モデルと位置づけ、Edge Functions経由のアクセスは別途コードレビューで権限逸脱がないことを担保する。
- **根拠**: Webhook/cron起点の処理は特定ユーザーの文脈を持たないため、RLSのみでは要求(他メンバーへの一括通知)を満たせない。service role権限の使用範囲をNotificationドメインの2つのEdge Functionsに限定することでリスクを局所化する。
- **トレードオフ**: service role鍵の漏洩は全テーブルへの無制限アクセスを許すため、シークレット管理・監査ログの徹底が前提となる。
- **フォローアップ**: なし(design.mdのSecurity Considerationsに反映済み)。

### 判断: タグ削除はカスケード削除とし、削除前に確認モーダルを表示する
- **背景**: TagServiceのタグ削除時、既に予定に紐づいている`event_tags`をどう扱うかが未確定だった(design-reviewでは論理削除を推奨案として提示していたが、ユーザーからカスケード削除の明示的な指示があった)。
- **検討した代替案**:
  1. 論理削除(アーカイブ) — 履歴を保持できるが、スキーマ・UIが複雑化する
  2. 削除禁止 — データは失われないが、タグ整理の柔軟性がない
  3. カスケード削除 + 削除前の確認モーダル — 採用(ユーザー指定)
- **採用したアプローチ**: `tags.parent_id`と`event_tags.tag_id`に`ON DELETE CASCADE`制約を設定する。大分類タグを削除すると配下の中分類・小分類タグ、およびそれらに紐づく`event_tags`が連鎖的に削除される。削除操作の直前には必ずクライアント側で確認モーダルを表示し、誤操作を防止する。
- **根拠**: シンプルな実装で要件を満たせる。誤削除のリスクは確認モーダルというUI層の防御で緩和する方針とし、DBスキーマを複雑化させない。
- **トレードオフ**: 過去の思い出・履歴に付与されていたタグ情報も削除時に失われる。ユーザーは「タグを消すと過去の分類も消える」ことを理解した上で削除する必要があり、確認モーダルの文言で明示する。
- **フォローアップ**: なし。

### 判断: 予定のリマインダー時刻は`events.reminder_at`列として保持する
- **背景**: 2回目のdesign-reviewで、要件6.4(予定のリマインダー通知)を実装するための時刻保持列がデータモデルに存在しないことが判明した。`event_reminder_targets`は対象者(誰に送るか)のみを保持し、いつ送るかの情報を持っていなかった。
- **検討した代替案**:
  1. `events.reminder_at`(nullable)列を追加 — 採用(ユーザー指定)
  2. `event_reminders(event_id, remind_at)`という独立テーブルを新設 — 1予定に対して複数のリマインド時刻を持たせたい場合に拡張しやすいが、本要件(6.4)は単一時刻のみを要求しており過剰
- **採用したアプローチ**: `events`テーブルに`reminder_at TIMESTAMPTZ NULL`を追加する。`createEvent`/`updateEvent`の入力項目として設定し、`NotificationDispatcher`は`events.reminder_at <= now()`を抽出条件として利用する。
- **根拠**: 要件6.4は予定ごとに単一のリマインダー時刻を想定しており、追加テーブルを設けるほどの複雑性は不要。`todos.reminder_at`と同じ命名・型で統一し、実装者の理解コストを下げる。
- **トレードオフ**: 将来「予定当日の朝と前日の夜の2回リマインドしたい」のような複数時刻要求が出た場合は、別テーブルへの移行が必要になる。
- **フォローアップ**: なし。

### 判断: 予定削除は思い出データ(写真・コメント)を含めてカスケード削除し、UIで事前に明示する
- **背景**: 2回目のdesign-reviewで、予定削除時に`todos`・`event_photos`・`event_comments`等の子データがどうなるか未定義であることが判明した。`todos.event_id`はNOT NULLのため、既定のRESTRICT制約では予定削除自体が失敗する懸念があった。
- **検討した代替案**:
  1. 子テーブルごとに異なる挙動(ToDo等はカスケード、写真・コメントは削除禁止) — 一貫性がなく実装・UIが複雑化する
  2. 全ての子データをカスケード削除し、削除前にUIで明示的に警告する — 採用(ユーザー指定)
- **採用したアプローチ**: `events.id`を参照する`todos`・`event_tags`・`event_reminder_targets`・`event_photos`・`event_comments`・`event_reactions`は全て`ON DELETE CASCADE`とする。要件3.9として、削除確認画面で「思い出データ(写真・コメント)も削除されます」という趣旨の警告を必ず表示する。
- **根拠**: DBスキーマをシンプルに保ちつつ、データ喪失のリスクはUI層の確認ステップで緩和するという一貫した方針(タグ削除の確認モーダルと同じ考え方)を予定削除にも適用できる。
- **トレードオフ**: 誤って確認モーダルを read せずに削除すると、思い出データは復元不可能な形で失われる。
- **フォローアップ**: なし。

### 判断: 繰り返しシリーズの一括生成による通知は、行単位ではなくシリーズ単位で1件に集約する
- **背景**: 2回目のdesign-reviewで、`createRecurringSeries`が最大1年分(週次で約52件)の`events`行を一括INSERTすると、DB Webhookベースの`EventChangeNotifier`が行単位で発火し、1回の登録操作に対して最大52件の通知が送信されうることが判明した。
- **検討した代替案**:
  1. `events`に`notify_on_insert`のような専用フラグ列を追加し、Webhook側で判定する — 既存の`series_id`列で代替可能なため冗長
  2. `series_id IS NOT NULL`を判定条件として個別INSERT通知を抑制し、専用の集約テーブル`event_series_creation_events`への1件のINSERTを通知トリガーとする — 採用(ユーザー指定)
  3. RPC内からpg_net拡張で直接Expo Push APIを呼び出す — DB Webhookパターンから逸脱し、Edge Function内の通知ロジック(対象者解決・notification_log記録)を重複実装することになる
- **採用したアプローチ**: `EventChangeNotifier`は`events`のINSERTペイロードについて`series_id IS NOT NULL`の場合は早期リターンする。`create_recurring_series`RPCは、シリーズを構成する全`events`行のINSERT後、同一トランザクション内で`event_series_creation_events`に1件INSERTする。このテーブルへのINSERTをDB Webhookで検知し、シリーズ作成につき1件の通知を送信する。
- **根拠**: 既存の`series_id`列(単発予定は`null`、シリーズの各回は共通値)を判定条件として再利用でき、新規フラグ列を増やさずに済む。DB Webhookという既存の通知起点パターンを維持しつつ、1操作=1通知という要件6.1の意図を保てる。
- **トレードオフ**: 通知ロジックが「`events`単体のINSERT」と「シリーズ作成」の2経路に分岐し、`EventChangeNotifier`内の分岐処理がやや複雑になる。
- **フォローアップ**: なし。

## リスクと緩和策
- RLSポリシーの複雑化によるクエリ性能劣化 — `SECURITY DEFINER`ヘルパー関数化、主要外部キーへのインデックス付与で緩和
- pg_cronベースの通知配信がスケールしない — 通知ジョブテーブルの成長を監視し、閾値超過時にキューベース配信へ移行
- Expo Push Service経由の配信失敗(トークン失効等) — 配信結果を`notification_log`に記録し、失敗トークンを`push_tokens`から無効化
- service role鍵の漏洩によるRLSバイパスの悪用 — シークレットはSupabase Edge Functionsのシークレットストアで管理し、使用範囲をNotificationドメインの2関数に限定する
- タグのカスケード削除による過去データの意図しない喪失 — 削除前の確認モーダルで注意喚起し、UI文言で影響範囲(配下タグ・過去の紐付けも削除される旨)を明示する

## 参考文献
- [Row-Level Security in Supabase: Multi-Tenant SaaS from Day One](https://dev.to/issuecapture/row-level-security-in-supabase-multi-tenant-saas-from-day-one-4lon) — RLSを用いた共有リソース設計パターン
- [Authorization via Row Level Security | Supabase Features](https://supabase.com/features/row-level-security) — RLSの基本方針
- [Supabase RLS Best Practices: Production Patterns for Secure Multi-Tenant Apps](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — SECURITY DEFINER関数によるパフォーマンス最適化
- [React Native Push Notifications with Expo (2026 Guide)](https://www.shipnative.dev/blog/push-notifications-expo-2026-setup-guide) — Expo Push Serviceのセットアップ手順
- [Expo Local Notifications in 2026: Schedule Alerts and Handle Permissions on iOS & Android](https://www.codesofphoenix.com/articles/expo/local-notifications-expo) — ローカル通知とリモート通知の使い分け
- [Implementing Hierarchical Data Structures in PostgreSQL: ltree vs Adjacency List vs Closure Table](https://dev.to/dowerdev/implementing-hierarchical-data-structures-in-postgresql-ltree-vs-adjacency-list-vs-closure-table-2jpb) — 階層データ設計方式の比較
