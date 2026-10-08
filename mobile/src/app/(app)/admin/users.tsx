// Users — the web's /admin/users. The 8-column table becomes a searchable card
// list; each card expands into the same actions as UsersClient.tsx (tier, role,
// Skool verification, suspend). Data: GET /api/mobile/admin/users?q=&page=&pending=1
// (50 per page). Writes: PATCH /api/admin/users/:id (admin only, server-checked).

import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { AdminList } from "@/components/admin/AdminList";
import { Label, OptionPicker, ViewOnlyNote } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { useAuth } from "@/auth/AuthProvider";
import { Avatar, Button, Card, Chip, EmptyState, Field, Icon, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { AdminUserRow, AdminUsersResponse } from "@/types/api";

const PATH = "/api/mobile/admin/users";
const PLANS = ["free", "pro", "premium"] as const;
const ROLES = ["artist", "reviewer", "moderator", "admin"] as const;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text weight="bold">{value}</Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

function UserCard({ u, expanded, onToggle, canEdit }: { u: AdminUserRow; expanded: boolean; onToggle: () => void; canEdit: boolean }) {
  const { user: me, refreshUser } = useAuth();
  const isSelf = me?.user.id === u.id;
  const { run, busy } = useAdminAction([PATH]);

  async function patch(body: Record<string, unknown>, success: string) {
    const res = await run(`/api/admin/users/${u.id}`, "PATCH", body, success);
    if (res && isSelf) await refreshUser();
  }

  function changeRole(role: string) {
    const warn =
      isSelf && role !== "admin"
        ? "You are changing your own role. You may lose access to parts of the admin area."
        : role === "admin"
          ? "Admins can change every setting, including other people's roles."
          : `They will have ${role} access.`;
    Alert.alert(`Make ${u.name} ${role}?`, warn, [
      { text: "Cancel", style: "cancel" },
      { text: "Change role", style: isSelf ? "destructive" : "default", onPress: () => void patch({ role }, `Role set to ${role}`) },
    ]);
  }

  function changePlan(plan: string) {
    Alert.alert(`Set ${u.name} to ${plan}?`, "The tier is granted directly. No payment is taken.", [
      { text: "Cancel", style: "cancel" },
      { text: "Set tier", onPress: () => void patch({ plan }, `Tier set to ${plan}`) },
    ]);
  }

  function toggleSkool() {
    if (u.skoolMember) {
      Alert.alert("Revoke Skool membership?", `${u.name} loses Community and Coach access in Riff.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Revoke", style: "destructive", onPress: () => void patch({ skoolMember: false }, "Skool membership revoked") },
      ]);
    } else {
      void patch({ skoolMember: true }, "Skool membership verified");
    }
  }

  function toggleStatus() {
    if (u.status === "active") {
      Alert.alert(`Suspend ${u.name}?`, "They will be signed out and can't log in until reactivated.", [
        { text: "Cancel", style: "cancel" },
        { text: "Suspend", style: "destructive", onPress: () => void patch({ status: "suspended" }, "User suspended") },
      ]);
    } else {
      void patch({ status: "active" }, "User reactivated");
    }
  }

  return (
    <Card onPress={onToggle} style={{ gap: 10, marginBottom: 10 }} accessibilityLabel={`${u.name}, ${u.email}. ${expanded ? "Collapse" : "Show details"}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Avatar name={u.name} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium" numberOfLines={1}>{u.name}{isSelf ? " (you)" : ""}</Text>
          <Text variant="caption" numberOfLines={1}>{u.email}</Text>
        </View>
        <Icon name={expanded ? "chevronDown" : "chevronRight"} size={16} color={colors.muted} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Chip label={u.status} tone={u.status === "active" ? "success" : "danger"} />
        <Chip label={u.role} tone={u.role === "artist" ? "muted" : "accent"} />
        <Chip label={u.plan} tone={u.plan === "free" ? "muted" : "brand"} />
        {u.skoolMember ? <Chip label="Skool" tone="brand" icon="check" /> : u.skoolRequestedAt ? <Chip label="Skool requested" tone="warning" /> : null}
      </View>

      {expanded ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row" }}>
            <Stat label="XP" value={u.totalXp} />
            <Stat label="Tracks" value={u.tracksDone} />
            <Stat label="Badges" value={u.badgeCount} />
            <Stat label="Streak" value={u.streak} />
          </View>
          <Text variant="caption">
            Joined {new Date(u.createdAt).toLocaleDateString()}
            {u.subscriptionStatus ? ` · subscription ${u.subscriptionStatus}` : ""}
            {u.skoolHandle ? ` · Skool @${u.skoolHandle}` : ""}
            {u.skoolRequestedAt && !u.skoolMember ? ` · requested ${new Date(u.skoolRequestedAt).toLocaleDateString()}` : ""}
          </Text>

          {canEdit ? (
            <>
              <OptionPicker label="Tier (no payment taken)" value={u.plan as (typeof PLANS)[number]} options={PLANS} onChange={changePlan} disabled={busy} />
              <OptionPicker label="Role" value={u.role as (typeof ROLES)[number]} options={ROLES} onChange={changeRole} disabled={busy} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button
                  size="sm"
                  variant={u.skoolMember ? "ghost" : u.skoolRequestedAt ? "primary" : "ghost"}
                  title={u.skoolMember ? "✓ Skool confirmed · Revoke" : u.skoolRequestedAt ? "Verify Skool ⏳" : "Verify Skool"}
                  onPress={toggleSkool}
                  disabled={busy}
                />
                <Button
                  size="sm"
                  variant={u.status === "active" ? "danger" : "ghost"}
                  title={u.status === "active" ? "Suspend" : "Activate"}
                  onPress={toggleStatus}
                  disabled={busy || (isSelf && u.status === "active")}
                />
              </View>
              {isSelf ? <Text variant="caption">You can&apos;t suspend your own account.</Text> : null}
            </>
          ) : null}
        </View>
      ) : null}
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
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useApiQuery<AdminUsersResponse>(PATH, { q: q || undefined, page, pending: pending ? 1 : undefined }, { placeholderData: (prev) => prev });
  const data = query.data;

  function search() {
    setQ(input.trim());
    setPage(1);
  }

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Text variant="small">Everyone with a Riff account, and the access they hold</Text>
      {!canEdit ? <ViewOnlyNote role={role} needs="admin" /> : null}
      {data && data.pendingCount > 0 ? (
        <Card
          onPress={() => {
            setPending((p) => !p);
            setPage(1);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14 }}
          accessibilityLabel={pending ? "Show all users" : "Review community access requests"}
        >
          <Text style={{ flex: 1 }}>
            <Text weight="bold">{data.pendingCount}</Text> community access request{data.pendingCount === 1 ? "" : "s"} awaiting verification
          </Text>
          <Text variant="caption" color={colors.brand}>{pending ? "Show all" : "Review"} ›</Text>
        </Card>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
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
            accessibilityLabel="Search users by email"
          />
        </View>
        <Button title="Search" variant="ghost" onPress={search} />
      </View>
      {pending || q ? (
        <Label right={<Button title="Clear" variant="link" size="sm" onPress={() => { setInput(""); setQ(""); setPending(false); setPage(1); }} />}>
          {pending ? "Skool requests, oldest first" : `Results for "${q}"`}
        </Label>
      ) : null}
    </View>
  );

  const footer =
    data && (page > 1 || data.hasNext) ? (
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 }}>
        <Button title="‹ Prev" variant="ghost" size="sm" disabled={page <= 1 || query.isFetching} onPress={() => setPage((p) => Math.max(1, p - 1))} />
        <Text variant="caption">Page {page}</Text>
        <Button title="Next ›" variant="ghost" size="sm" disabled={!data.hasNext || query.isFetching} onPress={() => setPage((p) => p + 1)} />
      </View>
    ) : null;

  return (
    <>
      <Stack.Screen options={{ title: "Users" }} />
      <AdminList
        query={query}
        select={(d) => d.users}
        keyOf={(u) => u.id}
        extraData={{ expanded, canEdit }}
        renderItem={(item) => (
          <UserCard
            key={item.id}
            u={item}
            canEdit={canEdit}
            expanded={expanded === item.id}
            onToggle={() => setExpanded((e) => (e === item.id ? null : item.id))}
          />
        )}
        header={header}
        footer={footer}
        empty={<EmptyState icon="user" title="No users found." />}
      />
    </>
  );
}
