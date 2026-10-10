// Studio hub — the web's /studio (src/app/(app)/studio/page.tsx).
// Data: GET /api/mobile/studio returns the AI builders (src/lib/studio BUILDERS).
// The other tiles are declared inside the web page file and have no API, so the
// navigation tiles below are copied verbatim from that page (AI_TOOLS, MANAGERS).

import { View } from "react-native";
import { router, Stack, type Href } from "expo-router";

import { SubHeading, TrackBadge } from "@/components/studio/shared";
import { Card, PageHeader, QueryView, Screen, Skeleton, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import type { StudioHubResponse } from "@/types/api";

type Tile = { href: string; icon: string; name: string; track: number; tagline: string };

// Copied from src/app/(app)/studio/page.tsx — keep identical to the web.
const AI_TOOLS: Tile[] = [
  { href: "/studio/caption", icon: "✍️", name: "Caption & Hashtag Generator", track: 2, tagline: "Generate scroll-stopping captions and hashtags." },
];

const MANAGERS: Tile[] = [
  { href: "/studio/brand-kit", icon: "🪪", name: "Brand Kit", track: 1, tagline: "Palette, fonts, logos & brand guidelines in one place." },
  { href: "/studio/fans", icon: "👥", name: "Fan CRM", track: 5, tagline: "Your audience, tagged into targetable segments." },
  { href: "/studio/broadcasts", icon: "📣", name: "Broadcasts", track: 5, tagline: "Compose fan updates and target them by segment." },
  { href: "/studio/link-in-bio", icon: "🔗", name: "Link-in-Bio", track: 5, tagline: "A public landing page for all your links." },
  { href: "/studio/finance", icon: "💰", name: "Revenue & Budget", track: 6, tagline: "Track what your music earns and costs." },
  { href: "/studio/merch", icon: "🧢", name: "Merch & Gigs", track: 6, tagline: "Plan your merch drops and track your shows." },
  { href: "/studio/bookings", icon: "📆", name: "Booking Scheduler", track: 7, tagline: "Track show inquiries from first contact to confirmed." },
  { href: "/studio/goals", icon: "🎯", name: "Goals & Milestones", track: 8, tagline: "Set career goals and track milestone progress." },
];

function TileCard({ t }: { t: Tile }) {
  return (
    <Card onPress={() => router.push(t.href as Href)} accessibilityLabel={`${t.name}. ${t.tagline}`} >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 24, lineHeight: 32 }}>{t.icon}</Text>
        <TrackBadge track={t.track} />
      </View>
      <Text weight="semibold" style={{ marginTop: 4, fontSize: 16, lineHeight: 24 }}>{t.name}</Text>
      <Text variant="caption" style={{ marginTop: 2 }}>{t.tagline}</Text>
    </Card>
  );
}

function RowCard({ icon, title, body, href }: { icon: string; title: string; body: string; href: string }) {
  return (
    <Card
      onPress={() => router.push(href as Href)}
      accessibilityLabel={`${title}. ${body}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <Text style={{ fontSize: 24, lineHeight: 32 }}>{icon}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="semibold" style={{ fontSize: 16, lineHeight: 24 }}>{title}</Text>
        <Text variant="caption">{body}</Text>
      </View>
    </Card>
  );
}

export default function StudioHub() {
  const query = useApiQuery<StudioHubResponse>("/api/mobile/studio");

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Studio" }} />
      <PageHeader title="🎛️ Studio" subtitle="Do the real work and get instant, AI-scored feedback — without leaving Riff." />

      <RowCard
        icon="📊"
        title="Career Dashboard"
        body="Your whole career at a glance — XP, revenue, fans, goals, tasks."
        href="/studio/dashboard"
      />

      <View style={{ gap: 12, marginTop: 8 }}>
        <SubHeading>AI tools</SubHeading>
        <QueryView query={query} skeleton={<View style={{ gap: 12 }}><Skeleton height={96} /><Skeleton height={96} /></View>}>
          {(d) => (
            <View style={{ gap: 12 }}>
              {[
                ...d.builders.map((b) => ({ href: `/studio/${b.kind}`, icon: b.icon, name: b.name, track: b.track, tagline: b.tagline })),
                ...AI_TOOLS,
              ].map((t) => (
                <TileCard key={t.href} t={t} />
              ))}
            </View>
          )}
        </QueryView>
      </View>

      <View style={{ gap: 12, marginTop: 16 }}>
        <SubHeading>Your assets & business</SubHeading>
        <View style={{ gap: 12 }}>
          {MANAGERS.map((t) => (
            <TileCard key={t.href} t={t} />
          ))}
        </View>
      </View>

      <View style={{ gap: 12, marginTop: 16 }}>
        <SubHeading>Project boards</SubHeading>
        <RowCard
          icon="🗂️"
          title="Open Projects"
          body="Content Calendar · Release Planner · Pitch Tracker · Outreach CRM · Collaboration Board"
          href="/boards"
        />
      </View>
    </Screen>
  );
}
