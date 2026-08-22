export interface TabRouteConfig {
  name: string;
  title: string;
}

export const TAB_ROUTES: TabRouteConfig[] = [
  { name: "calendar", title: "カレンダー" },
  { name: "todos", title: "ToDo" },
  { name: "history", title: "振り返り" },
  { name: "memories", title: "思い出" },
  { name: "meals", title: "献立" },
];
