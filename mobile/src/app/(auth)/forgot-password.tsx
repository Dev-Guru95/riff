// Forgot password — the web's (auth)/forgot-password page, same endpoint and
// same deliberately vague answer.
//
// Reviewers found there was no way back into an account from the app once the
// password was gone. The reset link in the email opens the website (the token
// is single-use and expires in an hour), which is why there is no reset screen
// here — only the request.
//
// POST /api/auth/forgot { email }. Answers 200 whether or not the address has
// an account; a 503 means SMTP isn't configured on the server.

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Link } from "expo-router";

import { api } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { Button, Card, Field, Screen, Text } from "@/components/ui";
import { colors, fonts } from "@/theme/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (loading) return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return setError("Enter a valid email address.");
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/forgot", { method: "POST", body: { email: value }, skipAuthRedirect: true });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges="all" contentStyle={styles.wrap}>
      <Card style={styles.card}>
        <Text style={styles.mark} accessibilityRole="header">
          <Text style={{ color: colors.brand }}>●</Text> Riff
        </Text>

        {sent ? (
          <>
            <Text variant="title">Check your email</Text>
            {/* Deliberately "if an account exists": confirming the address would
                let anyone test which emails have Riff accounts. */}
            <Text variant="small" style={{ marginTop: 4, marginBottom: 20 }}>
              If an account exists for <Text weight="semibold" color={colors.foreground}>{email.trim()}</Text>, we&apos;ve
              sent a link to reset your password. It expires in an hour and works once.
            </Text>
            <Text variant="small">
              Didn&apos;t get it? Check spam, or{" "}
              <Text
                color={colors.accent}
                onPress={() => {
                  setSent(false);
                  setError(null);
                }}
              >
                try a different address
              </Text>
              .
            </Text>
          </>
        ) : (
          <>
            <Text variant="title">Forgot your password?</Text>
            <Text variant="small" style={{ marginTop: 4, marginBottom: 20 }}>
              Enter your email and we&apos;ll send you a link to choose a new one.
            </Text>
            <View style={{ gap: 12 }}>
              <Field
                label="Email"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(null);
                }}
                placeholder="you@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                autoFocus
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                error={error}
              />
              <Button
                title={loading ? "Sending…" : "Send reset link"}
                onPress={() => void submit()}
                loading={loading}
                fullWidth
              />
            </View>
          </>
        )}

        <View style={styles.switch}>
          <Text variant="small">Remembered it? </Text>
          <Link href="/login" replace>
            <Text variant="small" color={colors.accent}>Log in</Text>
          </Link>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center" },
  card: { padding: 32, width: "100%", maxWidth: 384, alignSelf: "center" },
  mark: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: colors.foreground, marginBottom: 24 },
  switch: { flexDirection: "row", justifyContent: "center", marginTop: 20, flexWrap: "wrap" },
});
