// Revenue & Budget — the web's /studio/finance (FinanceClient.tsx).
// Data: GET /api/studio/finance (entries, totals, byCategory; cents);
// POST to add an entry; DELETE /api/studio/finance/[id].

import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { Stack } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { fmtDate, Input, KeyboardScroll, label, money, RemoveButton, Select, toCents, useStudioWrite } from "@/components/studio/shared";
import { Button, Card, PageHeader, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, fonts } from "@/theme/tokens";
import { FINANCE_CATEGORIES, type FinanceDTO } from "@/types/studio";

const PATH = "/api/studio/finance";
const ALSO = ["/api/mobile/studio/dashboard"];
const KINDS = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
] as const;

/** The web's `Stat` (emoji, xl bold value, xs muted label), stacked to fit a third of a phone. */
function Stat({ icon, value, label: l, color }: { icon: string; value: string; label: string; color?: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 0, gap: 4, padding: 12 }}>
      <Text style={{ fontSize: 24, lineHeight: 32 }}>{icon}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 24 }} color={color ?? colors.foreground} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption">{l}</Text>
    </Card>
  );
}

/** The web's add form: kind, category, description, amount, Add (stacked at phone width). */
function AddForm({ write }: { write: ReturnType<typeof useStudioWrite<FinanceDTO>> }) {
  const [kind, setKind] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState<string>("streaming");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const cents = toCents(amount);
    if (!desc.trim() || cents <= 0 || busy) return;
    setBusy(true);
    const res = await write(PATH, "POST", { kind, category, label: desc.trim(), amount: cents }, undefined, { reload: true });
    setBusy(false);
    if (res) {
      setDesc("");
      setAmount("");
    }
  }

  return (
    <Card style={{ gap: 8 }}>
      <Select look="field" accessibilityLabel="Type" options={KINDS} value={kind} onChange={setKind} />
      <Select look="field" accessibilityLabel="Category" options={FINANCE_CATEGORIES} value={category} onChange={setCategory} />
      <Input look="field" value={desc} onChangeText={setDesc} maxLength={120} placeholder="Description" accessibilityLabel="Description" />
      <Input
        look="field"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="$0.00"
        accessibilityLabel="Amount"
        style={{ width: 96 }}
      />
      <Button title="Add" fullWidth disabled={busy} onPress={() => void add()} />
    </Card>
  );
}

export default function Finance() {
  const query = useApiQuery<FinanceDTO>(PATH);
  const write = useStudioWrite<FinanceDTO>([PATH], ALSO);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  // The web deletes, then reloads (totals and categories come from the server).
  const del = (id: string) =>
    void write(`${PATH}/${id}`, "DELETE", undefined, (old) => ({ ...old, entries: old.entries.filter((e) => e.id !== id) }), { reload: true });

  const header = (d: FinanceDTO) => (
    <View style={{ gap: 16, paddingBottom: 16 }}>
      <PageHeader title="💰 Revenue & Budget" subtitle="Track what your music earns and costs — no spreadsheet required." />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat icon="📈" value={money(d.totals.income)} label="Income" />
        <Stat icon="📉" value={money(d.totals.expense)} label="Expenses" />
        <Stat icon="🧮" value={money(d.totals.net)} label="Net" color={d.totals.net < 0 ? colors.brand2 : colors.success} />
      </View>
      <AddForm write={write} />
      {d.byCategory.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {d.byCategory.map((c) => (
            <View key={c.category} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surface2 }}>
              <Text variant="caption" color={colors.foreground}>
                {label(c.category)}: <Text variant="caption" color={c.net < 0 ? colors.brand2 : colors.success}>{money(c.net)}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: "Revenue & Budget" }} />
      <QueryView query={query}>
        {(d) => (
          <FlashList
            data={d.entries}
            keyExtractor={(e) => e.id}
            renderScrollComponent={KeyboardScroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16 }}
            ListHeaderComponent={header(d)}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
            ListEmptyComponent={
              <Text variant="small" style={{ textAlign: "center", paddingVertical: 24 }}>
                No entries yet — add your first income or expense.
              </Text>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
            }
            renderItem={({ item: e }) => {
              const income = e.kind === "income";
              return (
                <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 18, lineHeight: 28 }}>{income ? "＋" : "－"}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1}>{e.label}</Text>
                    <Text variant="caption">{label(e.category)} · {fmtDate(e.date)}</Text>
                  </View>
                  <Text weight="medium" color={income ? colors.success : colors.brand2}>
                    {`${income ? "+" : "−"}${money(e.amount)}`}
                  </Text>
                  <RemoveButton label={`Delete ${e.label}`} onPress={() => del(e.id)} size={13} />
                </Card>
              );
            }}
          />
        )}
      </QueryView>
    </Screen>
  );
}
