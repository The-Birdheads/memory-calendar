# App Store 掲載情報(Memory Calendar 1.0)

App Store Connect(`https://appstoreconnect.apple.com/apps/6808228246`)にそのまま貼れる形でまとめています。
文字数は Apple の上限内であることを確認済みです。

---

## 1. アプリ情報

| 項目 | 内容 | 上限 |
|---|---|---|
| 名前 | `Memory Calendar` | 30 |
| サブタイトル | `家族や仲間と、予定と思い出を残す` | 30 |
| プライマリカテゴリ | ライフスタイル | |
| セカンダリカテゴリ | 仕事効率化 | |
| サポートURL | `https://kogenlab.com/support.html` | |
| マーケティングURL(任意) | `https://kogenlab.com/` | |
| プライバシーポリシーURL | `https://kogenlab.com/privacy.html` | |
| 著作権 | `2026 KOGEN LAB` | |
| 価格 | 無料 | |

## 2. プロモーションテキスト(170文字以内、審査なしで随時変更可)

```
予定を共有して、終わった予定は思い出に。写真・コメント・ToDo・献立まで、ひとつのカレンダーにまとめて、あとから家族や仲間と振り返れます。
```

## 3. キーワード(100文字以内、カンマ区切り、スペースなし)

```
カレンダー,共有カレンダー,家族,夫婦,カップル,予定,思い出,写真,日記,ToDo,タグ,献立,リマインダー,振り返り,記録,スケジュール,グループ,アルバム,メモ,旅行
```

※ アプリ名・カテゴリ名と重複する語は入れても効果が薄いため、「カレンダー」だけ残しています。

## 4. 説明文(4000文字以内)

```
Memory Calendar は、予定を共有するだけでなく、終わった予定を「思い出」として残せる共有カレンダーです。

家族、パートナー、友人グループで予定をあわせて、写真やコメントを添えて記録。あとから年表で振り返ったり、「何年前の今日」を見返したりできます。

■ 予定を共有する
・招待コードで、家族や仲間と共有カレンダーをつくれます
・自分だけの個人カレンダーも使えます(個人用の予定は他の人には見えません)
・カレンダーごとに色を決めて、ひと目で見分けられます
・月表示と一覧表示を切り替えられます
・予定の追加・変更・コメントがあると、メンバーに通知します
・リマインダーで、予定の前にお知らせします

■ 思い出を残す
・予定に写真を追加して、サムネイルを選べます
・コメントとリアクションで、みんなの感想を残せます
・「画像」タブで、思い出の写真を一覧できます
・何年前の今日の予定を振り返れます

■ タグで整理する
・大分類・中分類・小分類の3段階のタグで、予定を整理できます
・タグごとに色をつけて、カレンダーでも見分けられます
・複数の予定にまとめてタグを付けたり外したりできます

■ 年表で振り返る
・過去の予定を年表で一覧できます
・カレンダー、タグ、期間、タイトルのキーワードで絞り込めます

■ ToDo と献立も一緒に
・予定にひもづくToDoを管理できます。リマインダーや、並べ替えにも対応しています
・食事の記録(朝・昼・夜・間食)に、評価やメモ、レシピのURLを残せます

■ 安心して使える
・Apple、Google、メールアドレスでログインできます
・アカウントは、アプリの設定からいつでも削除できます
・無料でお使いいただくため、画面の一部に広告を表示します(トラッキングを許可しなくても、すべての機能を使えます)

ご意見・ご要望は、サポートページからお寄せください。
https://kogenlab.com/support.html
```

## 5. このバージョンの新機能(1.0.3)

```
・同じアカウントを、姉妹アプリ「Habitas」でも使えるようになります(Habitasの対応版の公開以降)
・ログアウトは、この端末のこのアプリだけに適用されるようになりました
・アカウントを削除するときの確認画面で、同じアカウントをほかのアプリでも使っている場合は、そのことをお知らせします(その場合、アカウント自体は削除されません)
・動作の安定性を改善しました
```

アプリ内の「更新内容」画面(`src/features/releaseNotes/releases.ts`)には、1.0.3 のノートを足さない。
利用者から見た機能追加ではなく、足すと全員に更新内容の画面が出るため。

### 1.0.2 の新機能(公開済み)

```
・月のカレンダーで、余白があるのに予定が少なく表示されることがある不具合を直しました
・週の開始曜日を「月曜始まり」にしているのに、日曜始まりで表示されることがある不具合を直しました
```

### 1.0.1 の新機能(公開済み)

(1.0 は「はじめてのリリースです。」)

```
・使い方ガイドを追加しました(設定 > 個人設定 > 使い方を見る)
・予定の日付と時刻を横並びで入力できるようになり、時刻は専用のキーパッドで入力できます
・予定の作成画面でリマインドを設定できます(はじめは前日の9時)
・共有カレンダーの予定に対象者を設定できます。個人設定でアイコンも変えられます
・共有カレンダーの色を、自分だけ変更できます
・月のカレンダーに、入るだけ予定を表示します
・献立の検索の不具合を直し、朝食・昼食・夕食・間食を色分けしました
・日本語入力中の未確定の文字に、下線が表示されない不具合を直しました
・一部の画面に広告を表示します
```

---

## 6. 年齢制限(質問票への回答の目安)

| 質問 | 回答 |
|---|---|
| 暴力、性的表現、ギャンブル、薬物、ホラーなど | すべて「なし」 |
| ユーザー生成コンテンツ | あり(招待されたメンバー内のコメントのみ。公開の投稿・検索・DMはなし) |
| Webへの無制限のアクセス | なし |
| 医療・健康に関する情報 | なし |

質問票に正直に答えた結果で、レーティングが自動で決まります(見込み: 4+ 〜 12+)。

## 7. App のプライバシー(栄養表示)

広告(Google AdMob)を入れたため、**トラッキング:「はい」**になります(広告識別子を、利用者が許可した場合に、広告のために使う)。

アプリ自身が集めるデータ(すべて「ユーザーに紐づく」)と、広告SDK(Google AdMob)が集めるデータに分けて答えます。

### アプリ自身が収集するデータ(広告より前から。「トラッキングには使わない」を選ぶ)
| カテゴリ | データ種別 | 利用目的 |
|---|---|---|
| 連絡先情報 | メールアドレス | アプリの機能、アカウント管理 |
| 連絡先情報 | 名前(表示名。Apple/Google から提供される氏名を含む) | アプリの機能 |
| ユーザーコンテンツ | 写真またはビデオ | アプリの機能 |
| ユーザーコンテンツ | その他のユーザーコンテンツ(予定、コメント、ToDo、食事の記録) | アプリの機能 |
| 識別子 | ユーザーID | アプリの機能 |
| 識別子 | デバイスID(プッシュ通知のトークン) | アプリの機能 |
| 診断 | その他の診断データ(エラー内容、OSの種類、アプリのバージョン) | アプリの機能 |

### 広告SDK(Google AdMob)が収集するデータ(追加)
Google が公開している「App Store のデータの開示」のガイドに沿って答えます(下の表は、バナー広告だけを使う場合の目安です。**回答の前に、必ず最新のガイドで確認してください**: Google AdMob ヘルプの「Apple の App Store のデータ開示」)。

| カテゴリ | データ種別 | 利用目的 | 追跡(トラッキング)に使うか |
|---|---|---|---|
| 識別子 | デバイスID(広告識別子 IDFA) | 第三者の広告、アプリの機能 | **はい** |
| 使用状況データ | 広告データ(広告の表示・操作) | 第三者の広告 | はい |
| 使用状況データ | 製品の操作 | 第三者の広告、アナリティクス | はい |
| 診断 | クラッシュデータ、パフォーマンスデータ、その他の診断データ | アプリの機能、アナリティクス | いいえ |
| 位置情報 | おおよその位置(IPアドレスから推定) | 第三者の広告 | はい |

- すべて「ユーザーに紐づく」を選びます(AdMob は、広告識別子などで利用者を特定するため)。
- 「トラッキング」の欄には、トラッキングに使うデータ種別(上の表で「はい」のもの)にチェックします。
- 画面に出る **トラッキングの確認(ATT)** は、アプリの初回起動後、少し待ってから出ます。許可されなくても、広告はパーソナライズなしで表示されます。

収集していないもの: 連絡先、閲覧履歴、検索履歴、購入履歴、健康・フィットネス、財務情報、機密情報。

※ 公開中のプライバシーポリシー(`https://kogenlab.com/privacy.html`)の記載と一致させます(広告の取得情報・トラッキングの許可・Google AdMob の記載を追加済み。`website/privacy.html` を再公開する必要があります)。

## 8. 輸出コンプライアンス

質問は出ません(`ITSAppUsesNonExemptEncryption: false` を設定済み)。

---

## 9. Appレビュー情報

**サインイン情報:** 「サインインが必要」にチェック

| 項目 | 内容 |
|---|---|
| ユーザ名 | `test.birdhead@gmail.com` |
| パスワード | (ご自身で記入) |

**連絡先:** 氏名・電話番号・メールアドレスをご自身で記入

**メモ(英語、そのまま貼り付け):**

```
Memory Calendar is a private, invite-only shared calendar for families and small groups. Users share events, then attach photos and comments to keep them as memories.

[Demo account]
Email: test.birdhead@gmail.com
Password: (see the Password field above)
The demo account already contains sample events, ToDos, meal records and a shared calendar. Users can also sign in with Apple, Google, or email.

[How to find main features]
- Calendar tab: month grid / list view. Tap a date to see that day's events.
- History tab: timeline of past events with filters (calendar, tag, period, keyword), and a photo grid.
- ToDo tab: ToDos linked to events (reordering supported).
- Meals tab: meal records.
- Gear icon (top-left of the Calendar tab): Personal settings / Calendar settings / Tag settings.

[About this update (1.0.3)]
This update prepares Memory Calendar to share one sign-in account with our other app, "Habitas" (a habit and task tracker by the same developer, bundle ID com.morikuma.habitas). Both apps use the same authentication backend, so a user can sign in to both with the same Apple / Google / email account. Each app keeps its own data separately, and no data is shown in the other app; only the sign-in account is shared. In this version:
- Logging out ends the session on this device in this app only. It no longer signs the user out of the other app.
- The app records that the account uses Memory Calendar, so that deleting the account in one app does not remove the data of the other.
- The account-deletion confirmation tells the user when the same account is also used by Habitas.
There are no other user-facing changes. This version does not add a new entry to the in-app "What's new", so that screen is not shown after updating.

[Account deletion - Guideline 5.1.1(v)]
Gear icon > Personal settings > "アカウントを削除" (Delete account). For users who signed in with Apple, the app asks them to confirm with Apple and then revokes the Sign in with Apple token before deleting the account.
Deleting removes all of the user's Memory Calendar data (personal calendar, ToDos, tags, etc.; the user leaves shared calendars). If the same account is also used in Habitas, the confirmation states that the account itself and the Habitas data are kept, and only the Memory Calendar data is deleted; the sign-in account is deleted completely when the user deletes it from the last app that uses it. The demo account below is used only in Memory Calendar, so deleting it removes the account completely (it cannot be restored, so please delete it only to verify this feature).

[User-generated content - Guideline 1.2]
Comments and reactions exist only inside a private shared calendar. They are visible only to members who joined with an invitation code issued from that calendar. There are no public posts, no user search or discovery, and no direct messaging. Authors can delete their own comments, and any member can leave a shared calendar at any time (Calendar settings). Support contact: support@kogenlab.com

[Notifications]
Push notifications are used only for event changes/comments in calendars the user belongs to, and for reminders the user sets.

[Advertising and App Tracking Transparency]
The app shows Google AdMob banner ads on some screens (the bottom of the Calendar tab, the Calendar list view, the day list, the ToDo tab, the History tab and the Meals log). Ads are never shown on the login/sign-up screens, while creating or editing events, or in the settings. A few seconds after the Calendar tab opens (after the tutorial / What's new screen is closed), the app shows the standard App Tracking Transparency prompt. If the user denies it, every feature remains available and only non-personalized ads are shown. If no ad is available, the ad area collapses and leaves no blank space.

[First launch and "What's new"]
On the first launch, a short tutorial (5 slides) is shown; it can be skipped at any time and replayed from Gear icon > Personal settings > "使い方を見る". After an app update, a "更新内容" (What's new) screen is shown once to existing users; it can be reopened from Gear icon > Personal settings > "更新内容を見る". Neither screen contains ads.

[Sign in with Apple - Guideline 4.8]
The login screen offers Sign in with Apple alongside Google and email/password.
```

---

## 10. スクリーンショット(iPhone 6.9インチ、1320×2868、2〜10枚)

iPhone 専用なので iPad のスクリーンショットは不要です。撮影の候補:

1. カレンダー(月表示。予定の色分け)
2. 日別の予定一覧(タグ・写真・コメントのマーク付き)
3. 予定詳細(写真・コメント・タグ・ToDo)
4. ToDo(予定ごとのまとまり)
5. 年表(振り返り。絞り込み)
6. 献立(食事の記録)

---

## 11. 広告(AdMob)まわりの作業メモ

アプリ側は実装済みです(開発ビルドでは Google のテスト広告が出ます)。リリース前に、次をご自身でお願いします。

1. **AdMob にこのアプリを登録する**: AdMob の管理画面で「アプリ」→「アプリを追加」→ iOS → 「Memory Calendar」(App Store に公開前でも「未公開のアプリ」として登録できる)。**アプリID**(`ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy`)が発行される。
2. **広告ユニットを作る**: そのアプリに「バナー」の広告ユニットを作る(全ての配置で、同じものを使い回してもよい。配置ごとの収益を見たいときは、配置ごとに分ける)。**広告ユニットID**(`ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz`)が発行される。
3. **ID をアプリに設定する**(私が行う。IDを教えてください):
   - アプリID: `app.json` の `react-native-google-mobile-ads` の `iosAppId`(設定済み: 本番のアプリID)
   - 広告ユニットID: 環境変数 `EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID`(設定済み: `eas.json` の production の env。開発ビルド・preview では本番IDを使わず、テスト広告/広告なし)。未設定の本番ビルドでは、広告は出ない
4. **app-ads.txt を公開する**: AdMob のアプリの設定にある「app-ads.txt」の行を、開発者のWebサイト(`https://kogenlab.com/app-ads.txt`)に置く。App Store Connect の「マーケティングURL」(または開発者のWebサイト)のドメインに置く必要がある。
5. **App のプライバシー**(上の7)を、App Store Connect で更新する。
6. **プライバシーポリシー**(`website/privacy.html`)を再公開する。
7. **年齢制限の質問票**: 広告は「アプリ内の広告」として、特別な回答は不要(コンテンツの質問に従う)。広告の年齢制限(広告の内容)は、AdMob 側の「ブロックのコントロール」で調整できる。
