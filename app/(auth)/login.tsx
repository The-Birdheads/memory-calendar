import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import { useAuthActions } from "../../src/features/auth/hooks";
import { getAuthErrorMessageJa } from "../../src/features/auth/service";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, signInWithGoogle, isSubmitting, error } = useAuthActions();

  const handleSubmit = async () => {
    const success = await signIn({ email, password });
    if (success) {
      router.replace("/(tabs)/calendar");
    }
  };

  const handleGoogleSignIn = async () => {
    const success = await signInWithGoogle();
    if (success) {
      router.replace("/(tabs)/calendar");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ログイン</Text>
      <TextInput
        testID="login-email-input"
        style={styles.input}
        placeholder="メールアドレス"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        testID="login-password-input"
        style={styles.input}
        placeholder="パスワード"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{getAuthErrorMessageJa(error)}</Text> : null}
      <TouchableOpacity
        testID="login-submit-button"
        style={styles.button}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>ログイン</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>または</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        testID="login-google-button"
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
        disabled={isSubmitting}
      >
        <Text style={styles.googleButtonText}>Googleでログイン</Text>
      </TouchableOpacity>

      <TouchableOpacity testID="login-signup-link" onPress={() => router.push("/(auth)/signup")}>
        <Text style={styles.linkText}>アカウントをお持ちでない方はこちら</Text>
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    color: "#999",
    fontSize: 12,
  },
  googleButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  googleButtonText: {
    color: "#333",
    fontWeight: "600",
  },
});
