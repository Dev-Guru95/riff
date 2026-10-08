// Revenue & Budget — the web's /studio/finance (FinanceClient.tsx).
// Data: GET /api/studio/finance (entries, totals, byCategory; cents);
// POST to add an entry; DELETE /api/studio/finance/[id].

import { useState } from "react";
import { Alert, RefreshControl, View } from "react-native";
import { Stack } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { fmtDate, IconButton, label, money, OptionPills, Sheet, toCents, usePullRefresh } from "@/components/studio/shared";
import { Button, Card, EmptyState, Field, PageHeader, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { colors, fonts } from "@/theme/tokens";
import { FINANCE_CATEGORIES, type FinanceDTO, type FinanceEntryDTO } from "@/types/studio";

const PATH = "/api/studio/finance";
const KINDS = ["income", "expense"] as const;

function Stat({ icon, value, label: l, color }: { icon: string; value: string; label: string; color?: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 0, gap: 2, padding: 12 }}>
      <Text style={{ fontSize: 18, lineHeight: 24 }}>{icon}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 }} color={color ?? colors.foreground} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption">{l}</Text>
    </Card>
  );
}

function AddEntry({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("income");
  const [category, setCategory] = useState<string>("streaming");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const add = useApiMutation({ invalidates: [PATH, "/api/mobile/studio/dashboard"], success: "Entry added", onSuccess: onClose });
  const cents = toCents(amount);

  return (
    <Sheet visible title="Add income or expense" onClose={onClose} error={add.error}>
      <OptionPills title="Type" options={KINDS} value={kind} onChange={setKind} />
      <OptionPills title="Category" options={FINANCE_CATEGORIES} value={category} onChange={setCategory} />
      <Field label="Description" value={desc} onChangeText={setDesc} maxLength={120} placeholder="Description" />
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="$0.00" />
      <Button
        title="Add"
        fullWidth
        loading={add.isPending}
        disabled={!desc.trim() || cents <= 0}
        onPress={() => add.mutate({ path: PATH, body: { kind, category, label: desc.trim(), amount: cents } })}
      />
    </Sheet>
  );
}

export default function Finance() {
  const query = useApiQuery<FinanceDTO>(PATH);
  const remove = useApiMutation({ invalidates: [PATH, "/api/mobile/studio/dashboard"], success: "Entry deleted" });
  const [adding, setAdding] = useState(false);
  const pull = usePullRefresh(query.refetch);

  function del(e: FinanceEntryDTO) {
    Alert.alert("Delete this entry?", `${e.label} · ${money(e.amount)}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate({ path: `${PATH}/${e.id}`, method: "DELETE" }) },
    ]);
  }

  const header = (d: FinanceDTO) => (
    <View style={{ gap: 16, paddingBottom: 12 }}>
      <PageHeader title="💰 Revenue & Budget" subtitle="Track what your music earns and costs — no spreadsheet required." />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stat icon="📈" value={money(d.totals.income)} label="Income" />
        <Stat icon="📉" value={money(d.totals.expense)} label="Expenses" />
        <Stat icon="🧮" value={money(d.totals.net)} label="Net" color={d.totals.net < 0 ? colors.brand2 : colors.success} />
      </View>
      <Button title="+ Add income or expense" fullWidth onPress={() => setAdding(true)} />
      {d.byCategory.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {d.byCategory.map((c) => (
            <View key={c.category} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surface2 }}>
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
            contentContainerStyle={{ paddingHorizontal: 16 }}
            ListHeaderComponent={header(d)}
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            ListEmptyComponent={<EmptyState icon="dollar" title="No entries yet — add your first income or expense." />}
            refreshControl={
              <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
            }
            renderItem={({ item: e }) => {
              const income = e.kind === "income";
              return (
                <Card style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingRight: 4 }}>
                  <Text style={{ fontSize: 18 }}>{income ? "＋" : "－"}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1}>{e.label}</Text>
                    <Text variant="caption">{label(e.category)} · {fmtDate(e.date)}</Text>
                  </View>
                  <Text weight="medium" color={income ? colors.success : colors.brand2}>
                    {income ? "+" : "−"}
                    {money(e.amount)}
                  </Text>
                  <IconButton icon="close" label={`Delete ${e.label}`} onPress={() => del(e)} />
                </Card>
              );
            }}
          />
        )}
      </QueryView>
      {adding ? <AddEntry onClose={() => setAdding(false)} /> : null}
    </Screen>
  );
}
