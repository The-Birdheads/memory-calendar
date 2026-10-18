import type { IconName } from "../../shared/components/Icon";

export interface OnboardingSlide {
  id: string;
  icon: IconName;
  title: string;
  body: string;
}

/** 初回の案内の、最後の「始める」画面より前のスライド(ストーリー ONB-001)。 */
export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "welcome",
    icon: "calendar",
    title: "Memory Calendar へようこそ",
    body: "予定を共有して、終わった予定は思い出に。写真・コメント・ToDo・献立まで、ひとつのカレンダーにまとめられます。",
  },
  {
    id: "share",
    icon: "comment",
    title: "家族や友人と予定を共有",
    body: "共有カレンダーをつくって、招待コードで家族や友人を招待しましょう。招待コードをもらったときは、左上の歯車 → カレンダー設定 から参加できます。",
  },
  {
    id: "memories",
    icon: "photo",
    title: "終わった予定は思い出に",
    body: "終わった予定に写真やコメントを残せます。振り返りタブの「年表」や「画像」で、あとから見返せます。",
  },
  {
    id: "personal",
    icon: "checklist",
    title: "自分用のToDo・タグ・献立",
    body: "ToDoやタグは自分だけに見えます。献立も記録できて、決めた時間に通知もできます。",
  },
];
