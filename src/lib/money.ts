// Parse a user-typed money string into integer minor units (cents), tolerant of
// thousands separators and comma-decimal locales. Client-safe (pure).
//  "1,50"      -> 150     (trailing ,NN → decimal comma)
//  "2,500"     -> 250000  (,NNN → thousands separator)
//  "1,000.50"  -> 100050  (dot present → commas are thousands)
//  "1 000"     -> 100000
//  "" / junk   -> 0
export function toCents(v: string): number {
  let s = (v ?? "").trim().replace(/\s/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, ""); // 1,000.50 -> 1000.50
  } else if (s.includes(",")) {
    // A comma followed by exactly two trailing digits is a decimal separator;
    // otherwise treat commas as thousands grouping.
    s = /,\d{2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
}
