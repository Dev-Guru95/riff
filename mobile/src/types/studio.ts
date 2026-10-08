// Studio tool types, copied from the web repo. Re-copy when these change:
//   src/lib/studio-tools.ts   BrandKitDTO, FinanceDTO, MerchDTO, GigDTO
//   src/lib/studio-growth.ts  GoalDTO, FanDTO, BroadcastDTO, BookingDTO, LinkPageDTO
//   src/lib/caption.ts        CaptionResult
// and the enums from the zod schemas in src/app/api/studio/** and the
// *Client.tsx components under src/app/(app)/studio/**.
// Money amounts are integer cents; dates are ISO strings.

import type { StudioDraft } from "./api";

// ── studio-tools.ts ──
export type BrandColor = { name: string; hex: string };
export type BrandFont = { name: string; usage: string };
export type BrandAsset = { id: string; name: string; url: string };
export type BrandKitDTO = {
  colors: BrandColor[];
  fonts: BrandFont[];
  guidelines: string;
  assets: BrandAsset[];
};

export type FinanceEntryDTO = {
  id: string;
  kind: string;
  category: string;
  label: string;
  amount: number;
  currency: string;
  date: string;
};
export type FinanceDTO = {
  entries: FinanceEntryDTO[];
  totals: { income: number; expense: number; net: number };
  byCategory: { category: string; net: number }[];
};

export type MerchDTO = { id: string; name: string; status: string; cost: number; price: number; stock: number; notes: string };
export type GigDTO = { id: string; venue: string; city: string; date: string | null; status: string; fee: number; notes: string };

// ── studio-growth.ts ──
export type Milestone = { text: string; done: boolean };
export type GoalDTO = {
  id: string;
  title: string;
  detail: string;
  targetDate: string | null;
  progress: number;
  milestones: Milestone[];
  status: string;
};
export type FanDTO = { id: string; name: string; email: string; location: string; tags: string[]; source: string; notes: string };
export type FansResponse = { fans: FanDTO[]; segments: { tag: string; count: number }[]; total: number };
export type BroadcastDTO = { id: string; subject: string; body: string; segment: string; recipientCount: number; sentAt: string | null };
export type BookingDTO = { id: string; title: string; contact: string; date: string | null; status: string; fee: number; notes: string };
export type LinkItem = { label: string; url: string };
export type LinkPageDTO = { handle: string; title: string; bio: string; theme: string; links: LinkItem[]; published: boolean };

// ── caption.ts ──
export type CaptionResult = { captions: string[]; hashtags: string[] };

// ── Route responses (src/app/api/studio/**) ──
export type DraftResponse = { draft: StudioDraft };
export type CreatedResponse = { id: string };
export type BrandKitResponse = { kit: BrandKitDTO };
export type BrandAssetResponse = BrandAsset;
export type UploadResponse = { url: string; category: string; size: number };
export type MerchGigsResponse = { merch: MerchDTO[]; gigs: GigDTO[] };
export type GoalsResponse = { goals: GoalDTO[] };
export type BroadcastsResponse = { broadcasts: BroadcastDTO[] };
export type SendBroadcastResponse = { recipientCount: number };
export type BookingsResponse = { bookings: BookingDTO[] };
export type LinkPageResponse = { page: LinkPageDTO };

// ── Enums (zod schemas / client constants) ──
export const BOOKING_STATUS = ["inquiry", "held", "confirmed", "done", "declined"] as const;
export const MERCH_STATUS = ["idea", "design", "production", "for_sale", "sold_out"] as const;
export const GIG_STATUS = ["inquiry", "confirmed", "done", "cancelled"] as const;
export const GOAL_STATUS = ["active", "done", "archived"] as const;
export const FINANCE_CATEGORIES = ["streaming", "merch", "shows", "ads", "gear", "other"] as const;
export const CAPTION_PLATFORMS = ["instagram", "tiktok", "youtube", "x", "facebook"] as const;
export const CAPTION_TONES = ["authentic", "hype", "playful", "professional", "moody"] as const;
export const LINK_THEMES = ["brand", "brand-2", "accent", "success", "warning"] as const;
