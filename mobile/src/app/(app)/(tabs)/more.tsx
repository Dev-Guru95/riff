// Everything in the web sidebar that isn't a bottom tab, in the web's order,
// plus the account footer (avatar, name, plan, log out).

import { Alert, View } from "react-native";
import { router, type Href } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { Avatar, Card, Divider, ListRow, Screen, Text, type IconName } from "@/components/ui";

const ITEMS: { href: string; icon: IconName; title: string; subtitle: string }[] = [
  { href: "/missions", icon: "target", title: "Missions", subtitle: "Weekly challenges" },
  { href: "/studio", icon: "disc", title: "Studio", subtitle: "Brand, merch, gigs, fans, finance" },
  { href: "/audit", icon: "layers", title: "Audit", subtitle: "Track real social growth" },
  { href: "/roadmap", icon: "route", title: "Roadmap", subtitle: "30/90-day plans" },
  { href: "/community", icon: "community", title: "Community", subtitle: "Join on Skool" },
  { href: "/leaderboard", icon: "trophy", title: "Ranks", subtitle: "Global leaderboard" },
  { href: "/certificates", icon: "graduation", title: "Certificates", subtitle: "Your credentials" },
  { href: "/pricing", icon: "card", title: "Plans", subtitle: "Upgrade your plan" },
  { href: "/search", icon: "search", title: "Search", subtitle: "Boards, cards and tasks" },
  { href: "/settings", icon: "settings", title: "Settings", subtitle: "Account, billing, delete account" },
];

export default function More() {
  const { user, isStaff, logout } = useAuth();
  const name = user?.profile?.stageName || user?.user.email.split("@")[0] || "Artist";

  return (
    <Screen>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={name} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="semibold" numberOfLines={1}>{name}</Text>
          <Text variant="caption" numberOfLines={1}>
            {isStaff ? user?.user.role : `${user?.plan ?? "free"} plan`} · {user?.user.email}
          </Text>
        </View>
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        {ITEMS.map((item, i) => (
          <View key={item.href}>
            {i > 0 ? <Divider /> : null}
            <ListRow icon={item.icon} title={item.title} subtitle={item.subtitle} onPress={() => router.push(item.href as Href)} />
          </View>
        ))}
      </Card>

      {isStaff ? (
        <Card padded={false} style={{ overflow: "hidden" }}>
          <ListRow icon="shield" title="Admin" subtitle="Courses, review queue, users, moderation" onPress={() => router.push("/admin" as Href)} />
        </Card>
      ) : null}

      <Card padded={false} style={{ overflow: "hidden" }}>
        <ListRow
          icon="logout"
          title="Log out"
          destructive
          onPress={() =>
            Alert.alert("Log out?", "You'll need to log in again on this device.", [
              { text: "Cancel", style: "cancel" },
              { text: "Log out", style: "destructive", onPress: () => void logout() },
            ])
          }
        />
      </Card>
    </Screen>
  );
}
