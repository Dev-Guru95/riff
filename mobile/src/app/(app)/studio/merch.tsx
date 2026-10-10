// Merch & Gigs — the web's /studio/merch (MerchGigClient.tsx). The web's two
// columns stack at phone width: Merch, then Gigs. Every field saves on blur,
// optimistically, and re-syncs from the server if the save fails (as the web).
// Data: GET /api/studio/merch-gigs; POST there to add ({type:"merch",name} or
// {type:"gig",venue}); PATCH/DELETE /api/studio/merch/[id] and /api/studio/gigs/[id].

import { View } from "react-native";
import { Stack } from "expo-router";

import {
  AddRow,
  CardTitle,
  centsInput,
  CommitInput,
  DateInput,
  RemoveButton,
  Select,
  toCents,
  useStudioWrite,
} from "@/components/studio/shared";
import { Card, PageHeader, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { GIG_STATUS, MERCH_STATUS, type GigDTO, type MerchDTO, type MerchGigsResponse } from "@/types/studio";

const PATH = "/api/studio/merch-gigs";
const ALSO = ["/api/mobile/studio/dashboard"];
const MERCH_OPTIONS = MERCH_STATUS.map((s) => ({ value: s, label: s.replace("_", " ").replace(/^./, (c) => c.toUpperCase()) }));

function Labeled({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Text variant="caption">{text}</Text>
      {children}
    </View>
  );
}

export default function MerchAndGigs() {
  const query = useApiQuery<MerchGigsResponse>(PATH);
  const write = useStudioWrite<MerchGigsResponse>([PATH], ALSO);

  const addMerch = (name: string) => void write(PATH, "POST", { type: "merch", name }, undefined, { reload: true });
  const patchMerch = (id: string, data: Partial<MerchDTO>) =>
    void write(`/api/studio/merch/${id}`, "PATCH", data, (old) => ({ ...old, merch: old.merch.map((m) => (m.id === id ? { ...m, ...data } : m)) }));
  const delMerch = (id: string) =>
    void write(`/api/studio/merch/${id}`, "DELETE", undefined, (old) => ({ ...old, merch: old.merch.filter((m) => m.id !== id) }));

  const addGig = (venue: string) => void write(PATH, "POST", { type: "gig", venue }, undefined, { reload: true });
  const patchGig = (id: string, data: Partial<GigDTO>) =>
    void write(`/api/studio/gigs/${id}`, "PATCH", data, (old) => ({
      ...old,
      // The server stores "" as no date.
      gigs: old.gigs.map((g) => (g.id === id ? { ...g, ...data, ...(data.date === "" ? { date: null } : {}) } : g)),
    }));
  const delGig = (id: string) =>
    void write(`/api/studio/gigs/${id}`, "DELETE", undefined, (old) => ({ ...old, gigs: old.gigs.filter((g) => g.id !== id) }));

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Merch & Gigs" }} />
      <PageHeader title="🧢 Merch & Gigs" subtitle="Plan your merch drops and track your shows." />

      <QueryView query={query}>
        {(d) => (
          <View style={{ gap: 24 }}>
            {/* Merch */}
            <View style={{ gap: 8 }}>
              <CardTitle>Merch</CardTitle>
              <AddRow placeholder="New merch item (e.g. Tour tee)" maxLength={120} onAdd={addMerch} />
              <View style={{ gap: 8, marginTop: 4 }}>
                {d.merch.map((m) => (
                  <Card key={m.id} style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <CommitInput
                        key={`n:${m.name}`}
                        initial={m.name}
                        weight="medium"
                        maxLength={120}
                        accessibilityLabel="Merch name"
                        style={{ flex: 1 }}
                        onCommit={(v) => v.trim() && patchMerch(m.id, { name: v.trim() })}
                      />
                      <RemoveButton label={`Delete ${m.name}`} onPress={() => delMerch(m.id)} size={13} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <Select accessibilityLabel="Status" options={MERCH_OPTIONS} value={m.status} onChange={(status) => patchMerch(m.id, { status })} />
                      <Labeled text="Price">
                        <CommitInput
                          key={`p:${m.price}`}
                          initial={centsInput(m.price)}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          accessibilityLabel="Price"
                          style={{ width: 64 }}
                          onCommit={(v) => patchMerch(m.id, { price: toCents(v) })}
                        />
                      </Labeled>
                      <Labeled text="Stock">
                        <CommitInput
                          key={`s:${m.stock}`}
                          initial={m.stock ? String(m.stock) : ""}
                          keyboardType="number-pad"
                          placeholder="0"
                          accessibilityLabel="Stock"
                          style={{ width: 56 }}
                          onCommit={(v) => patchMerch(m.id, { stock: Math.max(0, parseInt(v, 10) || 0) })}
                        />
                      </Labeled>
                    </View>
                  </Card>
                ))}
                {d.merch.length === 0 ? <Text variant="caption">No merch yet.</Text> : null}
              </View>
            </View>

            {/* Gigs */}
            <View style={{ gap: 8 }}>
              <CardTitle>Gigs</CardTitle>
              <AddRow placeholder="New gig (venue name)" maxLength={120} onAdd={addGig} />
              <View style={{ gap: 8, marginTop: 4 }}>
                {d.gigs.map((g) => (
                  <Card key={g.id} style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <CommitInput
                        key={`v:${g.venue}`}
                        initial={g.venue}
                        weight="medium"
                        maxLength={120}
                        accessibilityLabel="Venue"
                        style={{ flex: 1 }}
                        onCommit={(v) => v.trim() && patchGig(g.id, { venue: v.trim() })}
                      />
                      <RemoveButton label={`Delete ${g.venue}`} onPress={() => delGig(g.id)} size={13} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <CommitInput
                        key={`c:${g.city}`}
                        initial={g.city}
                        placeholder="City"
                        maxLength={120}
                        accessibilityLabel="City"
                        style={{ width: 96 }}
                        onCommit={(v) => patchGig(g.id, { city: v })}
                      />
                      <DateInput value={g.date} onChange={(date) => patchGig(g.id, { date })} />
                      <Select accessibilityLabel="Status" options={GIG_STATUS} value={g.status} onChange={(status) => patchGig(g.id, { status })} />
                      <Labeled text="Fee">
                        <CommitInput
                          key={`f:${g.fee}`}
                          initial={centsInput(g.fee)}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          accessibilityLabel="Fee"
                          style={{ width: 64 }}
                          onCommit={(v) => patchGig(g.id, { fee: toCents(v) })}
                        />
                      </Labeled>
                    </View>
                  </Card>
                ))}
                {d.gigs.length === 0 ? <Text variant="caption">No gigs yet.</Text> : null}
              </View>
            </View>
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
