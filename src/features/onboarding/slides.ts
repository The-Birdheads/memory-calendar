import type { ImageSourcePropType } from "react-native";

export interface OnboardingSlide {
  id: string;
  /** 実際の画面の切り抜き(assets/onboarding/)。差し替えるときは、同じ名前で上書きし、縦横比を直す。 */
  image: ImageSourcePropType;
  /** 画像の幅 ÷ 高さ。 */
  imageAspectRatio: number;
  /** 画像の下に出す、何が写っているかの一言。 */
  caption: string;
  title: string;
  body: string;
}

/**
 * 初回の案内の、最後の「始める」画面より前のスライド(ストーリー ONB-001)。
 * 画像は、アプリの実際の画面(サンプルデータ)の切り抜き。
 */
export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "welcome",
    image: require("../../../assets/onboarding/calendar.png"),
    imageAspectRatio: 760 / 664,
    caption: "月のカレンダーに、予定が色つきで並びます",
    title: "Memory Calendar へようこそ",
    body: "予定を共有して、終わった予定は思い出に。写真・コメント・ToDo・献立まで、ひとつのカレンダーにまとめられます。",
  },
  {
    id: "share",
    image: require("../../../assets/onboarding/shared.png"),
    imageAspectRatio: 760 / 735,
    caption: "共有カレンダーの予定には、メンバーみんなで写真やコメントを残せます",
    title: "家族や友人と予定を共有",
    body: "共有カレンダーをつくって、招待コードで招待しましょう。招待コードをもらったときは、左上の歯車 → カレンダー設定 から参加できます。",
  },
  {
    id: "memories",
    image: require("../../../assets/onboarding/memories.png"),
    imageAspectRatio: 760 / 557,
    caption: "振り返りタブの「画像」で、思い出の写真をまとめて見返せます",
    title: "終わった予定は思い出に",
    body: "終わった予定に写真やコメントを残すと、「年表」や「画像」であとから見返せます。",
  },
  {
    id: "personal",
    image: require("../../../assets/onboarding/personal.png"),
    imageAspectRatio: 760 / 376,
    caption: "「個人用」の枠は、自分にしか見えません",
    title: "自分用のToDo・タグ",
    body: "予定ごとに、自分だけのToDoとタグを付けられます。共有カレンダーのメンバーにも見えません。",
  },
  {
    id: "meals",
    image: require("../../../assets/onboarding/meals.png"),
    imageAspectRatio: 760 / 730,
    caption: "朝・昼・夕・間食ごとに、食べたものや食べる予定を記録できます",
    title: "献立も記録",
    body: "献立タブで、食べたものや食べる予定を記録できます。決めた時間に通知もできます。",
  },
];
