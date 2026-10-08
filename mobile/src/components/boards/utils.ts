// Shared helpers for the Projects / Kanban screens.

import type { BoardRole } from "@/lib/constants";
import { colors } from "@/theme/tokens";

/**
 * The template picker copy from the web's src/lib/board-templates.ts
 * (kind, name, icon, track, tagline). The server owns the columns/labels each
 * template seeds; the app only sends `kind`. Keep in sync with that file.
 */
export const BOARD_TEMPLATES: { kind: string; name: string; icon: string; track: number | null; tagline: string }[] = [
  { kind: "generic", name: "Blank board", icon: "🗂️", track: null, tagline: "A plain Kanban board — start from scratch." },
  { kind: "content_calendar", name: "Content Calendar", icon: "📅", track: 2, tagline: "Plan, draft, and schedule your social posts." },
  { kind: "release_planner", name: "Release Planner", icon: "🚀", track: 4, tagline: "Run a single/EP release from prep to launch." },
  { kind: "pitch_tracker", name: "Playlist Pitch Tracker", icon: "🎧", track: 3, tagline: "Track every playlist submission like a pipeline." },
  { kind: "outreach_crm", name: "Outreach CRM", icon: "🤝", track: 7, tagline: "Manage PR, partnerships, and networking contacts." },
  { kind: "collab_board", name: "Collaboration Board", icon: "🎹", track: 7, tagline: "Coordinate a track with producers and features." },
];

export function templateFor(kind: string) {
  return BOARD_TEMPLATES.find((t) => t.kind === kind) ?? BOARD_TEMPLATES[0]!;
}

/** UI_COLORS → token colour (labels and board colours). */
export const LABEL_COLOR: Record<string, string> = {
  brand: colors.brand,
  "brand-2": colors.brand2,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  muted: colors.muted,
};
export const labelColor = (c: string) => LABEL_COLOR[c] ?? colors.brand;

export const PRIORITY: Record<string, { color: string; label: string }> = {
  low: { color: colors.muted, label: "Low" },
  medium: { color: colors.accent, label: "Medium" },
  high: { color: colors.warning, label: "High" },
  urgent: { color: colors.brand2, label: "Urgent" },
};

/** Same ranks as the server's ROLE_RANK (src/lib/boards.ts). */
export const ROLE_RANK: Record<BoardRole, number> = { owner: 4, admin: 3, manager: 2, member: 1, guest: 0 };
export const ASSIGNABLE_ROLES: Exclude<BoardRole, "owner">[] = ["admin", "manager", "member", "guest"];

export function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
export function isOverdue(iso: string | null) {
  return !!iso && new Date(iso).getTime() < Date.now();
}
export function humanSize(n: number) {
  return n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
export const mentionHandle = (name: string) => name.replace(/\s+/g, "");
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
