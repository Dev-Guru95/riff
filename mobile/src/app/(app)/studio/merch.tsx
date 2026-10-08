// Merch & Gigs — the web's /studio/merch (MerchGigClient.tsx). The web shows the
// two lists side by side; on a phone they are two tabs.
// Data: GET /api/studio/merch-gigs; POST there to add ({type:"merch",name} or
// {type:"gig",venue}); PATCH/DELETE /api/studio/merch/[id] and /api/studio/gigs/[id].

import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack } from "expo-router";

import { AddBar, centsInput, DateField, fmtDay, label, money, OptionPills, Sheet, toCents } from "@/components/studio/shared";
import { Button, Card, Chip, EmptyState, Field, PageHeader, Pill, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { GIG_STATUS, MERCH_STATUS, type GigDTO, type MerchDTO, type MerchGigsResponse } from "@/types/studio";

const PATH = "/api/studio/merch-gigs";
type Tone = "muted" | "success" | "warning" | "brand" | "danger" | "accent";
const MERCH_TONE: Record<string, Tone> = { idea: "muted", design: "accent", production: "warning", for_sale: "success", sold_out: "danger" };
const GIG_TONE: Record<string, Tone> = { inquiry: "muted", confirmed: "success", done: "accent", cancelled: "danger" };

function confirmDelete(what: string, name: string, run: () => void) {
  Alert.alert(`Delete this ${what}?`, name, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: run },
  ]);
}

function EditMerch({ item, onClose }: { item: MerchDTO; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [status, setStatus] = useState(item.status);
  const [price, setPrice] = useState(centsInput(item.price));
  const [stock, setStock] = useState(item.stock ? String(item.stock) : "");
  const save = useApiMutation({ invalidates: [PATH], success: "Item saved", onSuccess: onClose });
  const remove = useApiMutation({ invalidates: [PATH], success: "Item deleted", onSuccess: onClose });
  const url = `/api/studio/merch/${item.id}`;

  return (
    <Sheet visible title="Edit merch item" onClose={onClose} error={save.error ?? remove.error}>
      <Field label="Name" value={name} onChangeText={setName} maxLength={120} />
      <OptionPills title="Status" options={MERCH_STATUS} value={status} onChange={setStatus} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Price ($)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Stock" value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="0" />
        </View>
      </View>
      <Button
        title="Save"
        fullWidth
        loading={save.isPending}
        disabled={!name.trim()}
        onPress={() =>
          save.mutate({
            path: url,
            method: "PATCH",
            body: { name: name.trim(), status, price: toCents(price), stock: Math.max(0, parseInt(stock, 10) || 0) },
          })
        }
      />
      <Button
        title="Delete item"
        variant="danger"
        fullWidth
        loading={remove.isPending}
        onPress={() => confirmDelete("item", item.name, () => remove.mutate({ path: url, method: "DELETE" }))}
      />
    </Sheet>
  );
}

function EditGig({ gig, onClose }: { gig: GigDTO; onClose: () => void }) {
  const [venue, setVenue] = useState(gig.venue);
  const [city, setCity] = useState(gig.city);
  const [date, setDate] = useState<string | null>(gig.date);
  const [status, setStatus] = useState(gig.status);
  const [fee, setFee] = useState(centsInput(gig.fee));
  const save = useApiMutation({ invalidates: [PATH], success: "Gig saved", onSuccess: onClose });
  const remove = useApiMutation({ invalidates: [PATH], success: "Gig deleted", onSuccess: onClose });
  const url = `/api/studio/gigs/${gig.id}`;

  return (
    <Sheet visible title="Edit gig" onClose={onClose} error={save.error ?? remove.error}>
      <Field label="Venue" value={venue} onChangeText={setVenue} maxLength={120} />
      <Field label="City" value={city} onChangeText={setCity} maxLength={120} placeholder="City" />
      <DateField label="Date" value={date} onChange={setDate} />
      <OptionPills title="Status" options={GIG_STATUS} value={status} onChange={setStatus} />
      <Field label="Fee ($)" value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="0" />
      <Button
        title="Save"
        fullWidth
        loading={save.isPending}
        disabled={!venue.trim()}
        onPress={() =>
          save.mutate({
            path: url,
            method: "PATCH",
            body: { venue: venue.trim(), city, date: date ?? "", status, fee: toCents(fee) },
          })
        }
      />
      <Button
        title="Delete gig"
        variant="danger"
        fullWidth
        loading={remove.isPending}
        onPress={() => confirmDelete("gig", gig.venue, () => remove.mutate({ path: url, method: "DELETE" }))}
      />
    </Sheet>
  );
}

export default function MerchAndGigs() {
  const query = useApiQuery<MerchGigsResponse>(PATH);
  const add = useApiMutation({ invalidates: [PATH], success: "Added" });
  const [tab, setTab] = useState<"merch" | "gigs">("merch");
  const [merch, setMerch] = useState<MerchDTO | null>(null);
  const [gig, setGig] = useState<GigDTO | null>(null);

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Merch & Gigs" }} />
      <PageHeader title="🧢 Merch & Gigs" subtitle="Plan your merch drops and track your shows." />

      <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole="tablist">
        <Pill label={`Merch${query.data ? ` (${query.data.merch.length})` : ""}`} active={tab === "merch"} onPress={() => setTab("merch")} />
        <Pill label={`Gigs${query.data ? ` (${query.data.gigs.length})` : ""}`} active={tab === "gigs"} onPress={() => setTab("gigs")} />
      </View>

      {tab === "merch" ? (
        <AddBar
          key="merch"
          placeholder="New merch item (e.g. Tour tee)"
          maxLength={120}
          loading={add.isPending}
          onAdd={(name) => add.mutateAsync({ path: PATH, body: { type: "merch", name } })}
        />
      ) : (
        <AddBar
          key="gig"
          placeholder="New gig (venue name)"
          maxLength={120}
          loading={add.isPending}
          onAdd={(venue) => add.mutateAsync({ path: PATH, body: { type: "gig", venue } })}
        />
      )}

      <QueryView query={query}>
        {(d) =>
          tab === "merch" ? (
            d.merch.length === 0 ? (
              <EmptyState icon="card" title="No merch yet." />
            ) : (
              <View style={{ gap: 8 }}>
                {d.merch.map((m) => (
                  <Card key={m.id} onPress={() => setMerch(m)} accessibilityLabel={`${m.name}, ${label(m.status)}. Edit`} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text weight="medium" style={{ flex: 1 }} numberOfLines={2}>{m.name}</Text>
                      <Chip label={label(m.status)} tone={MERCH_TONE[m.status] ?? "muted"} />
                    </View>
                    <Text variant="caption">Price {m.price ? money(m.price) : "—"} · Stock {m.stock || 0}</Text>
                  </Card>
                ))}
              </View>
            )
          ) : d.gigs.length === 0 ? (
            <EmptyState icon="flag" title="No gigs yet." />
          ) : (
            <View style={{ gap: 8 }}>
              {d.gigs.map((g) => (
                <Card key={g.id} onPress={() => setGig(g)} accessibilityLabel={`${g.venue}, ${g.status}. Edit`} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text weight="medium" style={{ flex: 1 }} numberOfLines={2}>{g.venue}</Text>
                    <Chip label={label(g.status)} tone={GIG_TONE[g.status] ?? "muted"} />
                  </View>
                  <Text variant="caption">
                    {[g.city || "No city", g.date ? fmtDay(g.date) : "No date", g.fee ? `Fee ${money(g.fee)}` : null].filter(Boolean).join(" · ")}
                  </Text>
                </Card>
              ))}
            </View>
          )
        }
      </QueryView>

      {merch ? <EditMerch key={merch.id} item={merch} onClose={() => setMerch(null)} /> : null}
      {gig ? <EditGig key={gig.id} gig={gig} onClose={() => setGig(null)} /> : null}
    </Screen>
  );
}
