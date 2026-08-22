import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";

import { useAuthSession } from "../src/features/auth/hooks";

export default function Index() {
  const { session, isLoading } = useAuthSession();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)/calendar" />;
  }

  return <Redirect href="/(auth)/login" />;
}
