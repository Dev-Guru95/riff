// Community — the web's /community gateway (CommunityOnboarding).
// Riff doesn't host a community: members are sent to Skool (the web page
// redirects them; here they get an "Open Skool" button), everyone else sees the
// onboarding: open Skool → request access → pending admin verification.
// Data: GET /api/mobile/community. Write: POST /api/community/join {}.

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { Button, Card, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { openInBrowser } from "@/lib/links";
import { type } from "@/theme/tokens";
import type { CommunityResponse } from "@/types/api";

const BENEFITS: { icon: string; title: string; body: string }[] = [
  { icon: "🤖", title: "AI Coach", body: "Your personal mentor — unlocks once you're verified." },
  { icon: "💬", title: "Student discussions", body: "Ask, answer, and learn with other artists." },
  { icon: "🤝", title: "Accountability groups", body: "Stay consistent with a crew that shows up." },
  { icon: "🏆", title: "Weekly leaderboards", body: "Compete and climb every single week." },
  { icon: "📊", title: "Monthly rankings", body: "See how far you've come, month over month." },
  { icon: "🎯", title: "Challenges", body: "Real-world missions with real rewards." },
  { icon: "📣", title: "Announcements", body: "Never miss drops, updates, or opportunities." },
  { icon: "🎬", title: "Live events", body: "Workshops, Q&As, and guest sessions." },
  { icon: "🌍", title: "Networking", body: "Meet collaborators, peers, and mentors." },
  { icon: "🎁", title: "Exclusive rewards", body: "Perks reserved for community members." },
  { icon: "💚", title: "Community support", body: "Encouragement when you need it most." },
];

function Benefits() {
  return (
    <View style={{ gap: 12 }}>
      {BENEFITS.map((b) => (
        <Card key={b.title} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <Text style={{ fontSize: 24, lineHeight: 32 }}>{b.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text weight="semibold">{b.title}</Text>
            <Text variant="caption">{b.body}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

function Member({ data }: { data: CommunityResponse }) {
  return (
    <Card style={[styles.cta, { alignItems: "center" }]}>
      <Text style={{ fontSize: 40, lineHeight: 48 }}>🎉</Text>
      <Text variant="heading" weight="bold" style={{ textAlign: "center" }}>You&apos;re in the SoundRig community</Text>
      <Text variant="small" style={{ textAlign: "center" }}>
        Discussions, accountability groups, challenges and live events all happen on Skool.
        {data.skoolHandle ? ` You're verified as @${data.skoolHandle}.` : ""}
      </Text>
      <Button title="Open Skool →" fullWidth onPress={() => void openInBrowser(data.redirectTo ?? data.skoolUrl)} />
    </Card>
  );
}

function Onboarding({ data }: { data: CommunityResponse }) {
  const { refreshUser } = useAuth();
  // intro -> (open Skool) -> confirm -> (request) -> pending
  const [stage, setStage] = useState<"intro" | "confirm" | "pending">(data.alreadyRequested ? "pending" : "intro");
  const request = useApiMutation({
    invalidates: ["/api/mobile/community", "/api/mobile/coach"],
    success: "Request sent",
    onSuccess: () => {
      setStage("pending");
      void refreshUser();
    },
  });

  async function openSkool() {
    await openInBrowser(data.skoolUrl);
    setStage((s) => (s === "intro" ? "confirm" : s));
  }

  return (
    <Card style={styles.cta}>
      {stage === "intro" ? (
        <>
          <Text variant="heading" weight="bold" style={{ textAlign: "center" }}>Ready to plug in?</Text>
          <Text variant="small" style={{ textAlign: "center" }}>
            Join free on Skool, then request access here. Our team verifies your membership before unlocking Community + AI Coach.
          </Text>
          <Button title="Join the Community on Skool →" fullWidth onPress={() => void openSkool()} />
        </>
      ) : stage === "confirm" ? (
        <>
          <Text variant="heading" weight="bold" style={{ textAlign: "center" }}>Joined on Skool?</Text>
          <Text variant="small" style={{ textAlign: "center" }}>
            Request access below. An admin will verify your Skool membership, then Community + AI Coach unlock automatically.
          </Text>
          <Button
            title={request.isPending ? "Sending…" : "Request access"}
            fullWidth
            loading={request.isPending}
            onPress={() => request.mutate({ path: "/api/community/join", body: {} })}
          />
          <Button title="Re-open Skool" variant="ghost" fullWidth onPress={() => void openSkool()} />
        </>
      ) : (
        <>
          <Text style={{ fontSize: 36, lineHeight: 44, textAlign: "center" }}>⏳</Text>
          <Text variant="heading" weight="bold" style={{ textAlign: "center" }}>Request received</Text>
          <Text variant="small" style={{ textAlign: "center" }}>
            Thanks! An admin is verifying your Skool membership. Once you&apos;re approved, Community and AI Coach unlock here automatically — we&apos;ll notify you.
          </Text>
          <Button title="Open the Skool community →" variant="ghost" fullWidth onPress={() => void openInBrowser(data.skoolUrl)} />
        </>
      )}
    </Card>
  );
}

export default function Community() {
  const query = useApiQuery<CommunityResponse>("/api/mobile/community");
  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Community" }} />
      <View style={{ alignItems: "center", marginTop: 24, marginBottom: 16 }}>
        <Text style={{ fontSize: 48, lineHeight: 56, marginBottom: 12 }}>🤝</Text>
        <Text variant="title" style={[type["3xl"], { textAlign: "center" }]}>Join the SoundRig Community</Text>
        <Text variant="small" style={[type.base, { textAlign: "center", marginTop: 8 }]}>
          Riff is SoundRig’s learning app — lessons, quizzes and tools live here. The SoundRig community lives on Skool — join to unlock your AI Coach, accountability, challenges, live events, and the people who’ll keep you moving.
        </Text>
      </View>
      <QueryView query={query}>
        {(d) =>
          d.status === "member" ? (
            <>
              <Benefits />
              <Member data={d} />
            </>
          ) : (
            <>
              <Benefits />
              <Onboarding key={d.status} data={d} />
            </>
          )
        }
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Web: `card p-6 text-center`, plain border (it is sticky at the bottom there).
  cta: { padding: 24, gap: 8 },
});
