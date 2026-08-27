import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import { useAuthActions } from "../../src/features/auth/hooks";
import { getAuthErrorMessageJa } from "../../src/features/auth/service";

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signUp, isSubmitting, error } = useAuthActions();

  const handleSubmit = async () => {
    const success = await signUp({ email, password, displayName: displayName.trim() || undefined });
    if (success) {
      router.replace("/(tabs)/calendar");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>アカウント登録</Text>
      <TextInput
        testID="signup-display-name-input"
        style={styles.input}
        placeholder="表示名"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        testID="signup-email-input"
        style={styles.input}
        placeholder="メールアドレス"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        testID="signup-password-input"
        style={styles.input}
        placeholder="パスワード"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{getAuthErrorMessageJa(error)}</Text> : null}
      <TouchableOpacity
        testID="signup-submit-button"
        style={styles.button}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>登録する</Text>
      </TouchableOpacity>

      <TouchableOpacity testID="signup-login-link" onPress={() => router.push("/(auth)/login")}>
        <Text style={styles.linkText}>すでにアカウントをお持ちの方はこちら</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: "#d32f2f",
  },
  linkText: {
    color: "#2f6fed",
    textAlign: "center",
    marginTop: 8,
  },
  button: {
    backgroundColor: "#2f6fed",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
