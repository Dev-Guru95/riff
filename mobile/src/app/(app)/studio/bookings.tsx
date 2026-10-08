// Booking Scheduler — the web's /studio/bookings (BookingsClient.tsx).
// Data: GET /api/studio/bookings; POST to add, PATCH/DELETE /api/studio/bookings/[id].
// The web edits each row inline; here a row opens an edit sheet.

import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack } from "expo-router";

import { AddBar, centsInput, DateField, fmtDay, label, money, OptionPills, Sheet, toCents } from "@/components/studio/shared";
import { Button, Card, Chip, EmptyState, Field, PageHeader, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { BOOKING_STATUS, type BookingDTO, type BookingsResponse } from "@/types/studio";

const PATH = "/api/studio/bookings";
const TONE: Record<string, "muted" | "success" | "warning" | "brand" | "danger" | "accent"> = {
  inquiry: "muted",
  held: "warning",
  confirmed: "success",
  done: "accent",
  declined: "danger",
};

function EditBooking({ booking, onClose }: { booking: BookingDTO; onClose: () => void }) {
  const [title, setTitle] = useState(booking.title);
  const [contact, setContact] = useState(booking.contact);
  const [date, setDate] = useState<string | null>(booking.date);
  const [fee, setFee] = useState(centsInput(booking.fee));
  const [status, setStatus] = useState(booking.status);
  const save = useApiMutation({ invalidates: [PATH], success: "Booking saved", onSuccess: onClose });
  const remove = useApiMutation({ invalidates: [PATH], success: "Booking deleted", onSuccess: onClose });

  return (
    <Sheet visible title="Edit booking" onClose={onClose} error={save.error ?? remove.error}>
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={160} />
      <OptionPills title="Status" options={BOOKING_STATUS} value={status} onChange={setStatus} />
      <Field label="Contact / promoter" value={contact} onChangeText={setContact} maxLength={160} placeholder="Contact / promoter" />
      <DateField label="Date" value={date} onChange={setDate} />
      <Field label="Fee ($)" value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="0" />
      <Button
        title="Save"
        fullWidth
        loading={save.isPending}
        disabled={!title.trim()}
        onPress={() =>
          save.mutate({
            path: `${PATH}/${booking.id}`,
            method: "PATCH",
            body: { title: title.trim(), contact, date: date ?? "", fee: toCents(fee), status },
          })
        }
      />
      <Button
        title="Delete booking"
        variant="danger"
        fullWidth
        loading={remove.isPending}
        onPress={() =>
          Alert.alert("Delete this booking?", booking.title, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => remove.mutate({ path: `${PATH}/${booking.id}`, method: "DELETE" }) },
          ])
        }
      />
    </Sheet>
  );
}

export default function Bookings() {
  const query = useApiQuery<BookingsResponse>(PATH);
  const add = useApiMutation({ invalidates: [PATH], success: "Booking added" });
  const [editing, setEditing] = useState<BookingDTO | null>(null);

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Booking Scheduler" }} />
      <PageHeader title="📆 Booking Scheduler" subtitle="Track show inquiries and bookings from first contact to confirmed." />
      <AddBar
        placeholder="New booking (e.g. Summer Fest slot)"
        maxLength={160}
        loading={add.isPending}
        onAdd={(title) => add.mutateAsync({ path: PATH, body: { title } })}
      />
      <QueryView
        query={query}
        isEmpty={(d) => d.bookings.length === 0}
        empty={<EmptyState icon="calendar" title="No bookings yet." />}
      >
        {(d) => (
          <View style={{ gap: 8 }}>
            {d.bookings.map((b) => (
              <Card key={b.id} onPress={() => setEditing(b)} accessibilityLabel={`${b.title}, ${b.status}. Edit`} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text weight="medium" style={{ flex: 1 }} numberOfLines={2}>{b.title}</Text>
                  <Chip label={label(b.status)} tone={TONE[b.status] ?? "muted"} />
                </View>
                <Text variant="caption">
                  {[b.contact || "No contact", b.date ? fmtDay(b.date) : "No date", b.fee ? `Fee ${money(b.fee)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </QueryView>
      {editing ? <EditBooking key={editing.id} booking={editing} onClose={() => setEditing(null)} /> : null}
    </Screen>
  );
}
