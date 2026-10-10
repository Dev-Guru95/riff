// Booking Scheduler — the web's /studio/bookings (BookingsClient.tsx).
// Data: GET /api/studio/bookings; POST to add, PATCH/DELETE /api/studio/bookings/[id].
// Each row edits inline and saves on blur / change, optimistically, re-syncing
// from the server if a save fails (as the web).

import { View } from "react-native";
import { Stack } from "expo-router";

import { AddRow, centsInput, CommitInput, DateInput, RemoveButton, Select, toCents, useStudioWrite } from "@/components/studio/shared";
import { Card, PageHeader, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { BOOKING_STATUS, type BookingDTO, type BookingsResponse } from "@/types/studio";

const PATH = "/api/studio/bookings";
// The web's <option>s are the raw lowercase values.
const STATUS_OPTIONS = BOOKING_STATUS.map((s) => ({ value: s, label: s }));

export default function Bookings() {
  const query = useApiQuery<BookingsResponse>(PATH);
  const write = useStudioWrite<BookingsResponse>([PATH]);

  const add = (title: string) => void write(PATH, "POST", { title }, undefined, { reload: true });
  const patch = (id: string, d: Partial<BookingDTO>) =>
    void write(`${PATH}/${id}`, "PATCH", d, (old) => ({
      bookings: old.bookings.map((b) => (b.id === id ? { ...b, ...d, ...(d.date === "" ? { date: null } : {}) } : b)),
    }));
  const del = (id: string) => void write(`${PATH}/${id}`, "DELETE", undefined, (old) => ({ bookings: old.bookings.filter((b) => b.id !== id) }));

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Booking Scheduler" }} />
      <PageHeader title="📆 Booking Scheduler" subtitle="Track show inquiries and bookings from first contact to confirmed." />
      <AddRow placeholder="New booking (e.g. Summer Fest slot)" maxLength={160} onAdd={add} />
      <QueryView query={query}>
        {(d) => (
          <View style={{ gap: 8 }}>
            {d.bookings.map((b) => (
              <Card key={b.id} style={{ padding: 12, gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <CommitInput
                    key={`t:${b.title}`}
                    initial={b.title}
                    weight="medium"
                    maxLength={160}
                    accessibilityLabel="Booking title"
                    style={{ flex: 1 }}
                    onCommit={(v) => v.trim() && patch(b.id, { title: v.trim() })}
                  />
                  <Select accessibilityLabel="Status" options={STATUS_OPTIONS} value={b.status} onChange={(status) => patch(b.id, { status })} />
                  <RemoveButton label={`Delete ${b.title}`} onPress={() => del(b.id)} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <CommitInput
                    key={`c:${b.contact}`}
                    initial={b.contact}
                    placeholder="Contact / promoter"
                    maxLength={160}
                    accessibilityLabel="Contact / promoter"
                    style={{ width: 160 }}
                    onCommit={(v) => patch(b.id, { contact: v })}
                  />
                  <DateInput value={b.date} onChange={(date) => patch(b.id, { date })} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text variant="caption">Fee</Text>
                    <CommitInput
                      key={`f:${b.fee}`}
                      initial={centsInput(b.fee)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      accessibilityLabel="Fee"
                      style={{ width: 64 }}
                      onCommit={(v) => patch(b.id, { fee: toCents(v) })}
                    />
                  </View>
                </View>
              </Card>
            ))}
            {d.bookings.length === 0 ? (
              <Text variant="small" style={{ textAlign: "center", paddingVertical: 24 }}>No bookings yet.</Text>
            ) : null}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
