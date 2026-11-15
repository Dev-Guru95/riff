// Artist profile — stage name, country and genres.
//
// Mirrors the web's /settings profile form. Until it existed on mobile there
// was no way to set `User.countryCode` or `ArtistProfile.genres` from the app,
// so the Country and Genre ranks on the dashboard stayed blank with no way to
// fix them.
//
// The choices are fixed lists, fetched from GET /api/mobile/profile rather than
// copied into the app: free-text genres would splinter the genre leaderboard,
// and country names need Intl region data the server always has. Saved with
// PATCH /api/profile — the same endpoint the website uses.

import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { api } from "@/api/client";
import { errorMessage } from "@/api/errors";
// Sheet/action-sheet live beside the Kanban screens but are generic surfaces.
import { Sheet } from "@/components/boards/Sheet";
import { Button, Card, Field, Icon, Text, useToast } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import type { ProfileOptionsResponse } from "@/types/api";

const PATH = "/api/mobile/profile";
/** Writes go to the website's own endpoint, not a mobile mirror of it. */
const SAVE_PATH = "/api/profile";

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text variant="small">{label}</Text>
      <Text numberOfLines={1} style={{ flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

export function ArtistProfileCard() {
  const query = useApiQuery<ProfileOptionsResponse>(PATH);
  const [editing, setEditing] = useState(false);
  const d = query.data;

  const countryLabel = d?.countryCode
    ? (d.countries.find((c) => c.code === d.countryCode)?.name ?? d.countryCode)
    : "—";
  const genreLabel =
    d && d.genres.length > 0
      ? d.genres.map((g) => d.genreOptions.find((o) => o.value === g)?.label ?? g).join(", ")
      : "—";

  return (
    <Card style={{ padding: 20 }}>
      <Text weight="semibold" style={{ marginBottom: 4 }}>Artist profile</Text>
      <Text variant="small" style={{ marginBottom: 12 }}>
        Your artist name is what the leaderboard shows. Country and genre put you on the Country and
        Genre ranks — leave them blank and those stay empty.
      </Text>
      <View style={{ gap: 8 }}>
        <Line label="Artist name" value={d?.stageName?.trim() || "—"} />
        <Line label="Country" value={countryLabel} />
        <Line label="Genres" value={genreLabel} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <Button title="Edit profile" variant="ghost" disabled={!d} onPress={() => setEditing(true)} />
      </View>
      {/* Mounted only while open, the way Sheet.tsx renders its own prompt:
          the form then seeds from props and cancelling really discards. */}
      {d && editing ? <ProfileSheet data={d} onClose={() => setEditing(false)} /> : null}
    </Card>
  );
}

function ProfileSheet({ data, onClose }: { data: ProfileOptionsResponse; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidate();

  const [stageName, setStageName] = useState(data.stageName);
  const [countryCode, setCountryCode] = useState<string | null>(data.countryCode);
  const [genres, setGenres] = useState<string[]>(data.genres);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGenre(value: string) {
    setGenres((cur) => {
      if (cur.includes(value)) return cur.filter((g) => g !== value);
      // The first genre is the one that ranks, so the order of taps matters —
      // append rather than sort.
      if (cur.length >= data.maxGenres) return cur;
      return [...cur, value];
    });
  }

  async function save() {
    if (saving) return;
    const name = stageName.trim();
    if (!name) return setError("Enter the name you want on the leaderboard.");
    setError(null);
    setSaving(true);
    try {
      await api(SAVE_PATH, {
        method: "PATCH",
        body: { stageName: name, countryCode, genres },
      });
      await invalidate(PATH, "/api/mobile/me", "/api/mobile/dashboard", "/api/mobile/leaderboard");
      toast("Profile saved");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const countryName = countryCode
    ? (data.countries.find((c) => c.code === countryCode)?.name ?? countryCode)
    : "Not set";

  return (
    <>
      <Sheet visible onClose={onClose} title="Artist profile">
        <Field
          label="Artist / stage name"
          value={stageName}
          onChangeText={(t) => {
            setStageName(t);
            setError(null);
          }}
          placeholder="e.g. Nova"
          maxLength={60}
          autoCapitalize="words"
        />

        <View style={{ gap: 6 }}>
          <Text variant="caption">Country</Text>
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            accessibilityLabel={`Country, currently ${countryName}`}
            style={({ pressed }) => [styles.select, pressed && { borderColor: colors.brand }]}
          >
            <Text style={{ flex: 1 }} color={countryCode ? colors.foreground : colors.muted} numberOfLines={1}>
              {countryName}
            </Text>
            <Icon name="chevronRight" size={16} color={colors.muted} />
          </Pressable>
          {countryCode ? (
            <Button title="Clear country" variant="link" size="sm" style={{ alignSelf: "flex-start" }} onPress={() => setCountryCode(null)} />
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="caption">
            Genres — up to {data.maxGenres}. The first one is the genre you rank in.
          </Text>
          <View style={styles.genres}>
            {data.genreOptions.map((g) => {
              const index = genres.indexOf(g.value);
              const on = index >= 0;
              const full = genres.length >= data.maxGenres;
              return (
                <Pressable
                  key={g.value}
                  onPress={() => toggleGenre(g.value)}
                  disabled={!on && full}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !on && full }}
                  accessibilityLabel={g.label}
                  style={({ pressed }) => [
                    styles.genre,
                    on && styles.genreOn,
                    !on && full && { opacity: 0.4 },
                    pressed && { transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Text variant="caption" color={on ? colors.brand : colors.muted}>
                    {on && index === 0 ? "★ " : ""}{g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? (
          <Text variant="small" color={colors.danger} accessibilityLiveRegion="polite">{error}</Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title={saving ? "Saving…" : "Save profile"} onPress={() => void save()} loading={saving} />
          <Button title="Cancel" variant="ghost" disabled={saving} onPress={onClose} />
        </View>
      </Sheet>

      {picking ? (
        <CountryPicker
          countries={data.countries}
          selected={countryCode}
          onClose={() => setPicking(false)}
          onPick={(code) => {
            setCountryCode(code);
            setPicking(false);
          }}
        />
      ) : null}
    </>
  );
}

/** 200-odd countries is too many to scroll, so the list is searchable. */
function CountryPicker({
  countries,
  selected,
  onClose,
  onPick,
}: {
  countries: { code: string; name: string }[];
  selected: string | null;
  onClose: () => void;
  onPick: (code: string) => void;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase() === needle);
  }, [q, countries]);

  return (
    <Sheet visible onClose={onClose} title="Country" scroll={false}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Field
          value={q}
          onChangeText={setQ}
          placeholder="Search countries"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search countries"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(c) => c.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPick(item.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: item.code === selected }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
          >
            <Text style={{ flex: 1 }} numberOfLines={1}>{item.name}</Text>
            {item.code === selected ? <Icon name="check" size={18} color={colors.brand} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text variant="small" style={{ paddingVertical: 24, textAlign: "center" }}>No country matches that.</Text>
        }
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  genres: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genre: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genreOn: { borderColor: colors.brand, backgroundColor: colors.surface2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 4 },
});
