import type { IconName } from "../components/Icon";

export interface TabRouteConfig {
  name: string;
  title: string;
  icon: IconName;
}

export const TAB_ROUTES: TabRouteConfig[] = [
  { name: "calendar", title: "カレンダー", icon: "calendar" },
  { name: "todos", title: "ToDo", icon: "checklist" },
  { name: "history", title: "振り返り", icon: "clock" },
  { name: "meals", title: "献立", icon: "meal" },
];
