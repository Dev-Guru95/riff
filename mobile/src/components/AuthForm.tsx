// Mirrors the web's (auth)/AuthForm.tsx: same fields, same copy, same MFA step,
// same endpoints — so an account made on either platform works on both.

import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Link } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { errorMessage } from "@/api/errors";
import { absoluteUrl } from "@/config/env";
import { openInBrowser } from "@/lib/links";
import { colors, fonts } from "@/theme/tokens";
import { Button, Card, Field, Screen, Text } from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { login, signup, sessionExpired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stageName, setStageName] = useState("");
  const [code, setCode] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    setError(null);
    // Same client-side rules as the web form; the server validates again.
    if (!mfaStep) {
      if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email address.");
      if (mode === "signup" && password.length < 8) return setError("Password must be at least 8 characters.");
      if (!password) return setError("Enter your password.");
    } else if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) {
      return setError("Enter the 6-digit code.");
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await login(email, password, mfaStep ? code : undefined);
        if (res.status === "mfa_required") setMfaStep(true);
      } else {
        await signup({ email, password, stageName });
      }
      // On success the root navigator swaps to the app automatically.
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges="all" contentStyle={styles.wrap}>
      <Card style={styles.card}>
        {/* The web's auth card uses the "● Riff" text mark, not the blackletter wordmark. */}
        <Text style={styles.mark} accessibilityRole="header">
          <Text style={{ color: colors.brand }}>●</Text> Riff
        </Text>
        <Text variant="title">{mode === "login" ? "Welcome back" : "Create your account"}</Text>
        <Text variant="small" style={{ marginTop: 4, marginBottom: 24 }}>
          {mode === "login" ? "Pick up where you left off." : "Start your artist growth journey."}
        </Text>

        {sessionExpired && mode === "login" && !error ? (
          <Text variant="small" color={colors.warning} style={{ marginBottom: 12 }}>
            Your session ended. Please log in again.
          </Text>
        ) : null}

        <View style={{ gap: 12 }}>
          {mfaStep ? (
            <>
              <Text variant="small">Enter the 6-digit code from your authenticator app.</Text>
              <Field
                label="Authentication code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={7}
                autoFocus
                placeholder="000000"
                style={{ textAlign: "center", letterSpacing: 8 }}
                returnKeyType="done"
                onSubmitEditing={submit}
              />
            </>
          ) : (
            <>
              {mode === "signup" ? (
                <Field
                  label="Artist / stage name"
                  value={stageName}
                  onChangeText={setStageName}
                  placeholder="e.g. Nova"
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              ) : null}
              <Field
                ref={emailRef}
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <Field
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                textContentType={mode === "login" ? "password" : "newPassword"}
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            </>
          )}

          {error ? (
            <Text variant="small" color={colors.danger} accessibilityLiveRegion="polite">{error}</Text>
          ) : null}

          <Button
            title={loading ? "Please wait…" : mfaStep ? "Verify" : mode === "login" ? "Log in" : "Create account"}
            onPress={submit}
            loading={loading}
            fullWidth
          />
          {mfaStep ? (
            <Button title="Back" variant="link" onPress={() => { setMfaStep(false); setCode(""); setError(null); }} style={{ alignSelf: "center" }} />
          ) : null}
        </View>

        <View style={styles.switch}>
          <Text variant="small">{mode === "login" ? "No account? " : "Already have one? "}</Text>
          <Link href={mode === "login" ? "/signup" : "/login"} replace>
            <Text variant="small" color={colors.accent}>{mode === "login" ? "Sign up" : "Log in"}</Text>
          </Link>
        </View>
      </Card>

      {/* Same policy links as the web's (auth) layout footer: a store reviewer
          must reach them without an account. */}
      <View style={styles.footer}>
        <Text variant="caption" onPress={() => void openInBrowser(absoluteUrl("/terms"))} accessibilityRole="link" style={styles.footerLink}>
          Terms of Use
        </Text>
        <Text variant="caption" onPress={() => void openInBrowser(absoluteUrl("/privacy"))} accessibilityRole="link" style={styles.footerLink}>
          Privacy Policy
        </Text>
        <Text variant="caption" onPress={() => void openInBrowser(absoluteUrl("/account/deletion"))} accessibilityRole="link" style={styles.footerLink}>
          Delete your account
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center" },
  card: { padding: 32, width: "100%", maxWidth: 384, alignSelf: "center" },
  mark: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: colors.foreground, marginBottom: 24 },
  switch: { flexDirection: "row", justifyContent: "center", marginTop: 20, flexWrap: "wrap" },
  footer: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", columnGap: 20, rowGap: 8, marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border },
  footerLink: { paddingVertical: 6 },
});
