// Certificates — the web's /certificates: the program certificate (with Share
// to Skool) or the per-track checklist that unlocks it.
// Data: GET /api/mobile/certificates.

import { Platform, Pressable, View } from "react-native";
import { router, Stack, type Href } from "expo-router";

import { ShareToSkool } from "@/components/ShareToSkool";
import { CertificateArtwork } from "@/components/learning/CertificateArtwork";
import { Button, Card, PageHeader, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { CertificatesResponse } from "@/types/api";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

export default function Certificates() {
  const query = useApiQuery<CertificatesResponse>("/api/mobile/certificates");
  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Certificates" }} />
      <QueryView query={query}>
        {(d) => (
          <>
            <PageHeader
              title="🎓 Program Certificate"
              subtitle={`Complete every track in the ${d.programTitle} to earn your certificate — then share it with the community.`}
            />
            {d.certificate ? (
              <Card padded={false} style={{ overflow: "hidden" }}>
                <CertificateArtwork title={d.certificate.title} recipient={d.recipient} issuedAt={d.certificate.issuedAt} serial={d.certificate.serial} />
                <View style={{ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <Text variant="caption" style={{ fontFamily: MONO }}>#{d.certificate.serial.slice(0, 10)}</Text>
                  {d.share ? <ShareToSkool share={d.share} size="sm" /> : null}
                </View>
              </Card>
            ) : (
              <Card style={{ alignItems: "center", padding: 32 }}>
                <Text style={{ fontSize: 48, lineHeight: 56, marginBottom: 12 }}>🎓</Text>
                <Text weight="semibold" style={{ fontSize: 16, lineHeight: 24, marginBottom: 4, textAlign: "center" }}>Your certificate is waiting</Text>
                <Text variant="small" style={{ textAlign: "center", marginBottom: 20 }}>
                  {d.program.total === 0
                    ? "No courses are published yet — check back soon."
                    : `You've completed ${d.program.completed} of ${d.program.total} tracks. Finish them all to unlock your certificate.`}
                </Text>
                {d.program.total > 0 ? (
                  <View style={{ alignSelf: "center", maxWidth: 384, width: "100%", gap: 8, marginBottom: 24 }}>
                    {d.program.tracks.map((t) => (
                      <Pressable
                        key={t.slug}
                        onPress={() => router.push(`/courses/${t.slug}` as Href)}
                        accessibilityRole="link"
                        accessibilityLabel={`${t.title}, ${t.done ? "complete" : "not complete"}`}
                        hitSlop={6}
                        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text>{t.done ? "✅" : "⬜"}</Text>
                        <Text style={{ flex: 1 }} color={t.done ? colors.success : undefined}>{t.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Button title="Continue learning" onPress={() => router.push("/courses" as Href)} style={{ alignSelf: "center" }} />
              </Card>
            )}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
