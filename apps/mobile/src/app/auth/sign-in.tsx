import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "@/components/BrandLogo";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import type { Role } from "@/lib/demo-data";
import { SUPABASE_URL } from "@/lib/env";
import { useDemoStore } from "@/store/demo-store";
import { colors, fontFamily } from "@/theme";

/**
 * Placeholder auth screen for non-demo mode. Phase 2 wires Supabase Auth (email + password,
 * required email verification) and leaves hooks for Sign in with Apple / Google.
 */
export default function SignInScreen() {
  const { role } = useLocalSearchParams<{ role?: Role }>();
  const setRole = useDemoStore((s) => s.setRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (!SUPABASE_URL) {
      Alert.alert(
        "Backend not configured",
        "Set EXPO_PUBLIC_SUPABASE_URL to enable real sign in, or use Demo mode from the Welcome screen.",
      );
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      const r: Role = role === "employer" ? "employer" : "officer";
      setRole(r);
      router.replace(r === "officer" ? "/(officer)/home" : "/(employer)/dashboard");
    }, 600);
  };

  return (
    <Screen title={role === "employer" ? "Employer sign in" : "Officer sign in"} back>
      <View style={styles.logo}>
        <BrandLogo size={30} />
      </View>
      <Card style={{ gap: 12 }}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="••••••••"
        />
        <PrimaryButton title="Sign in" loading={busy} onPress={submit} />
        <PrimaryButton
          title="Create an account"
          variant="ghost"
          size="md"
          onPress={() =>
            Alert.alert(
              "Sign up",
              "Account creation with email verification and phone number arrives in Phase 2.",
            )
          }
        />
      </Card>
      <Text style={styles.note}>Sign in with Apple and Google will appear here at launch.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: "center", paddingVertical: 8 },
  note: {
    textAlign: "center",
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.regular,
    fontSize: 12,
  },
});
