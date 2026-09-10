import { Tabs } from "expo-router";

import { Icon } from "../../src/shared/components/Icon";
import { TAB_ROUTES } from "../../src/shared/navigation/tabConfig";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      {TAB_ROUTES.map((route) => (
        <Tabs.Screen
          key={route.name}
          name={route.name}
          options={{
            title: route.title,
            tabBarIcon: ({ color, size }) => <Icon name={route.icon} color={color as string} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
