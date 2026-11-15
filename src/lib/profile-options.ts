/**
 * Choices for the artist profile: country and genre.
 *
 * Both feed the leaderboard — `computeLeaderboard({ scope: "country" })` matches
 * on `User.countryCode` and `{ scope: "genre" }` on the first entry of
 * `ArtistProfile.genres`. They are stored as stable lowercase/uppercase codes
 * rather than free text so two artists who pick the same thing actually rank
 * against each other.
 */

/**
 * ISO 3166-1 alpha-2. Codes only — names are rendered with Intl.DisplayNames so
 * they arrive localised and we don't ship (or have to maintain) 250 English
 * strings.
 */
export const COUNTRY_CODES: readonly string[] = (
  "AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ " +
  "CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR " +
  "GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH " +
  "KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR " +
  "MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PT PW PY QA RO RS RU " +
  "RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW " +
  "TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW"
).split(" ");

const COUNTRY_SET = new Set(COUNTRY_CODES);

export function isCountryCode(value: string): boolean {
  return COUNTRY_SET.has(value);
}

/** Localised country name, falling back to the raw code if Intl can't resolve it. */
export function countryName(code: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Countries as {code, name}, sorted by name for a <select>. */
export function countryOptions(locale = "en"): { code: string; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}

/**
 * Genres an artist can pick. Values are the stored form; labels are shown.
 * Deliberately a fixed list — free text would splinter the genre leaderboard
 * into one-person rankings ("hiphop" vs "hip-hop" vs "Hip Hop").
 */
export const GENRES: readonly { value: string; label: string }[] = [
  { value: "afrobeats", label: "Afrobeats" },
  { value: "alternative", label: "Alternative" },
  { value: "amapiano", label: "Amapiano" },
  { value: "ambient", label: "Ambient" },
  { value: "blues", label: "Blues" },
  { value: "classical", label: "Classical" },
  { value: "country", label: "Country" },
  { value: "dancehall", label: "Dancehall" },
  { value: "drill", label: "Drill" },
  { value: "edm", label: "EDM" },
  { value: "electronic", label: "Electronic" },
  { value: "folk", label: "Folk" },
  { value: "funk", label: "Funk" },
  { value: "gospel", label: "Gospel" },
  { value: "grime", label: "Grime" },
  { value: "hip-hop", label: "Hip-hop" },
  { value: "house", label: "House" },
  { value: "indie", label: "Indie" },
  { value: "jazz", label: "Jazz" },
  { value: "k-pop", label: "K-pop" },
  { value: "latin", label: "Latin" },
  { value: "lo-fi", label: "Lo-fi" },
  { value: "metal", label: "Metal" },
  { value: "pop", label: "Pop" },
  { value: "punk", label: "Punk" },
  { value: "rnb", label: "R&B" },
  { value: "reggae", label: "Reggae" },
  { value: "reggaeton", label: "Reggaeton" },
  { value: "rock", label: "Rock" },
  { value: "soul", label: "Soul" },
  { value: "techno", label: "Techno" },
  { value: "trap", label: "Trap" },
  { value: "world", label: "World" },
  { value: "other", label: "Other" },
];

const GENRE_SET = new Set(GENRES.map((g) => g.value));

export function isGenre(value: string): boolean {
  return GENRE_SET.has(value);
}

export function genreLabel(value: string): string {
  return GENRES.find((g) => g.value === value)?.label ?? value;
}

/** How many genres an artist may pick. The first one is their ranked genre. */
export const MAX_GENRES = 3;
