// Native port of the web's placeholder certificate (src/components/CertificateArtwork.tsx):
// brand gradient, double inset frame, recipient, programme title, date and serial.

import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Text } from "@/components/ui";
import { colors, fonts, gradients } from "@/theme/tokens";

export function CertificateArtwork({
  title,
  recipient,
  issuedAt,
  serial,
}: {
  title: string;
  recipient: string;
  issuedAt: string;
  serial: string;
}) {
  const date = new Date(issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return (
    <LinearGradient {...gradients.brand} style={s.root}>
      <View pointerEvents="none" style={[s.frame, { margin: 16, borderColor: "rgba(255,255,255,0.4)" }]} />
      <View pointerEvents="none" style={[s.frame, { margin: 24, borderColor: "rgba(255,255,255,0.2)" }]} />
      <View style={s.body} accessible accessibilityLabel={`Certificate of completion. This certifies that ${recipient} has completed the ${title}. Issued ${date}.`}>
        <Text style={s.kicker}>CERTIFICATE OF COMPLETION</Text>
        <Text style={{ fontSize: 44, lineHeight: 54, marginVertical: 12 }}>🎓</Text>
        <Text style={s.small}>This certifies that</Text>
        <Text style={s.recipient}>{recipient}</Text>
        <View style={s.rule} />
        <Text style={s.small}>has completed the</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.meta}>
          {date} · #{serial.slice(0, 10)} · SoundRig · Riff
        </Text>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { paddingVertical: 40, paddingHorizontal: 28 },
  frame: { ...StyleSheet.absoluteFill, borderWidth: 1 },
  body: { alignItems: "center" },
  kicker: { fontSize: 11, letterSpacing: 2.5, color: colors.white, opacity: 0.8, fontFamily: fonts.medium, textAlign: "center" },
  small: { fontSize: 14, color: colors.white, opacity: 0.85, textAlign: "center" },
  recipient: { fontSize: 28, lineHeight: 34, fontFamily: fonts.bold, color: colors.white, marginTop: 4, textAlign: "center" },
  rule: { height: 1, width: 192, backgroundColor: "rgba(255,255,255,0.4)", marginVertical: 12 },
  title: { fontSize: 20, lineHeight: 26, fontFamily: fonts.semibold, color: colors.white, marginTop: 4, textAlign: "center" },
  meta: { fontSize: 12, color: colors.white, opacity: 0.7, marginTop: 24, textAlign: "center" },
});
