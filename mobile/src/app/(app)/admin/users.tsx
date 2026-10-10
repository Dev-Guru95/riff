// Users — the web's /admin/users (page.tsx + UsersClient.tsx). The 8-column
// table (User, Role, Tier, XP, Trk, Bdg, Streak, Actions) becomes one card per
// user carrying every column, with the same actions: tier select (no payment
// taken), role select, Skool Verify / ✓ Confirmed, Suspend / Activate.
// Data: GET /api/mobile/admin/users?q=&page=&pending=1 (50 per page).
// Writes: PATCH /api/admin/users/:id (admin only, server-checked).

import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { useStaffAccess } from "@/components/admin/access";
import { AdminEmpty, OptionPicker, ViewOnlyNote } from "@/components/admin/controls";
import { AdminList } from "@/components/admin/AdminList";
import { useAdminCall } from "@/components/admin/useAdminAction";
import { Avatar, Button, Card, Chip, Field, Icon, PageHeader, Text, useToast } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, fonts, radius, tint } from "@/theme/tokens";
import type { AdminUserRow, AdminUsersResponse } from "@/types/api";

const PATH = "/api/mobile/admin/users";
const PLANS = ["free", "pro", "premium"] as const;
const ROLES = ["artist", "reviewer", "moderator", "admin"] as const;

function Col({ label, children, right }: { label: string; children: React.ReactNode; right?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: right ? "flex-end" : "flex-start" }}>
      <Text variant="caption" weight="medium" numberOfLines={1}>{label}</Text>
      {children}
    </View>
  );
}

/** Web UserActions: tier + role selects, Verify / ✓ Confirmed, Suspend / Activate. */
function UserActions({ u }: { u: AdminUserRow }) {
  const toast = useToast();
  const { user: me, refreshUser } = useAuth();
  const { call, busy } = useAdminCall([PATH]);

  async function patch(body: Record<string, unknown>) {
    const res = await call(`/api/admin/users/${u.id}`, "PATCH", body);
    if (!res.ok && res.error) toast(res.error, "error");
    // Your own role / Skool access drive the rest of the app: re-read /me.
    else if (res.ok && me?.user.id === u.id) await refreshUser();
  }

  const requested = !!u.skoolRequestedAt;

  return (
    <View style={{ gap: 10 }}>
      <OptionPicker compact label="Tier (no payment taken)" value={u.plan as (typeof PLANS)[number]} options={PLANS} onChange={(plan) => void patch({ plan })} disabled={busy} />
      <OptionPicker compact label="Role" value={u.role as (typeof ROLES)[number]} options={ROLES} onChange={(role) => void patch({ role })} disabled={busy} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {/* Purple call-to-action while unverified, settled green once confirmed. */}
        <Pressable
          disabled={busy}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={
            u.skoolMember ? "Revoke Skool community membership" : requested ? "Verify — this user requested access" : "Grant Skool community membership"
          }
          onPress={() =>
            u.skoolMember
              ? Alert.alert("Revoke Skool membership?", `${u.name} loses Community and Coach access in Riff.`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Revoke", style: "destructive", onPress: () => void patch({ skoolMember: false }) },
                ])
              : void patch({ skoolMember: true })
          }
          style={({ pressed }) => [
            styles.pill,
            u.skoolMember ? styles.pillConfirmed : requested ? styles.pillRequested : styles.pillPlain,
            (busy || pressed) && { opacity: busy ? 0.5 : 0.85 },
          ]}
        >
          <Text style={[styles.pillText, { fontFamily: fonts.semibold, color: u.skoolMember ? colors.success : requested ? colors.white : colors.foreground }]}>
            {u.skoolMember ? "✓ Confirmed" : requested ? "Verify ⏳" : "Verify"}
          </Text>
        </Pressable>
        <Pressable
          disabled={busy}
          hitSlop={6}
          accessibilityRole="button"
          onPress={() =>
            u.status === "active"
              ? Alert.alert(`Suspend ${u.name}?`, "They will be signed out and can't log in until reactivated.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Suspend", style: "destructive", onPress: () => void patch({ status: "suspended" }) },
                ])
              : void patch({ status: "active" })
          }
          style={({ pressed }) => [styles.pill, styles.pillPlain, (busy || pressed) && { opacity: busy ? 0.5 : 0.85 }]}
        >
          <Text style={[styles.pillText, { color: colors.foreground }]}>{u.status === "active" ? "Suspend" : "Activate"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function UserCard({ u, canEdit }: { u: AdminUserRow; canEdit: boolean }) {
  return (
    <Card style={{ gap: 12, marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Avatar name={u.name} size={32} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium" numberOfLines={1}>{u.name}</Text>
          <Text variant="caption" numberOfLines={1}>{u.email}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text variant="caption" color={u.status === "active" ? colors.success : colors.danger}>{u.status}</Text>
            {u.skoolMember ? <Chip label="Skool" tone="brand" /> : null}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Col label="Role">
          <Text variant="caption" numberOfLines={1}>{u.role}</Text>
        </Col>
        <Col label="Tier">
          <Text variant="caption" weight="medium" color={u.plan === "free" ? colors.muted : colors.brand} numberOfLines={1}>{u.plan}</Text>
        </Col>
        <Col label="XP" right>
          <Text>{String(u.totalXp)}</Text>
        </Col>
        <Col label="Trk" right>
          <Text accessibilityLabel={`${u.tracksDone} tracks completed`}>{String(u.tracksDone)}</Text>
        </Col>
        <Col label="Bdg" right>
          <Text accessibilityLabel={`${u.badgeCount} badges earned`}>{String(u.badgeCount)}</Text>
        </Col>
        <Col label="Streak" right>
          <Text accessibilityLabel={`${u.streak} day streak`}>{String(u.streak)}</Text>
        </Col>
      </View>

      {canEdit ? <UserActions u={u} /> : null}
    </Card>
  );
}

export default function AdminUsers() {
  const { role, can } = useStaffAccess();
  const canEdit = can("admin");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(false);

  const query = useApiQuery<AdminUsersResponse>(PATH, { q: q || undefined, page, pending: pending ? 1 : undefined }, { placeholderData: (prev) => prev });
  const data = query.data;

  function search() {
    setQ(input.trim());
    setPage(1);
  }

  const header = (
    <View style={{ paddingBottom: 16, gap: 16 }}>
      <PageHeader title="Users" subtitle="Everyone with a Riff account, and the access they hold" />
      {!canEdit ? <ViewOnlyNote role={role} needs="admin" /> : null}

      {/* Community access requests awaiting admin verification */}
      {data && data.pendingCount > 0 ? (
        <Card
          onPress={() => {
            setPending((p) => !p);
            setPage(1);
          }}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}
          accessibilityLabel={pending ? "Show all users" : "Review community access requests"}
        >
          <Text style={{ flex: 1 }}>
            <Text weight="bold">{String(data.pendingCount)}</Text> community access request{data.pendingCount === 1 ? "" : "s"} awaiting verification
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text variant="caption" color={colors.brand}>{pending ? "Show all users" : "Review"}</Text>
            <Icon name="chevronRight" size={13} color={colors.brand} />
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Field
            placeholder="Search by email…"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={search}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            accessibilityLabel="Search by email"
          />
        </View>
        <Button title="Search" variant="ghost" onPress={search} />
      </View>
    </View>
  );

  const footer =
    data && (page > 1 || data.hasNext) ? (
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <Button title="← Prev" variant="ghost" size="sm" disabled={page <= 1 || query.isFetching} onPress={() => setPage((p) => Math.max(1, p - 1))} />
        <Text variant="caption">Page {page}</Text>
        <Button title="Next →" variant="ghost" size="sm" disabled={!data.hasNext || query.isFetching} onPress={() => setPage((p) => p + 1)} />
      </View>
    ) : null;

  return (
    <>
      <Stack.Screen options={{ title: "Users" }} />
      <AdminList
        query={query}
        select={(d) => d.users}
        keyOf={(u) => u.id}
        extraData={canEdit}
        renderItem={(item) => <UserCard key={item.id} u={item} canEdit={canEdit} />}
        header={header}
        footer={footer}
        empty={
          <Card padded={false}>
            <AdminEmpty icon="user" title="No users found." />
          </Card>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 12, minHeight: 32, justifyContent: "center", borderRadius: radius.pill },
  pillText: { fontSize: 12, lineHeight: 16, fontFamily: fonts.medium },
  pillConfirmed: { borderWidth: 1, borderColor: tint(colors.success) },
  pillRequested: { backgroundColor: colors.brand },
  pillPlain: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
});
