export interface Profile {
  id: string;
  displayName: string | null;
  /** アイコン画像の保存先パス(avatarsバケット内)。未登録なら null で、表示名の頭文字を使う。 */
  avatarPath: string | null;
  /** 個人設定のカレンダー週開始曜日。0 = 日曜始まり, 1 = 月曜始まり。 */
  weekStartsOn: 0 | 1;
}

export type ProfileError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "ValidationError"; field: "displayName" }
  | { type: "DeleteFailed" };
