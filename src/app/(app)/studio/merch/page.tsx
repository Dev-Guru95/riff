import { requirePageSession } from "@/lib/auth";
import { listMerchAndGigs } from "@/lib/studio-tools";
import { MerchGigClient } from "./MerchGigClient";

export const metadata = { title: "Merch & Gigs — Riff" };

export default async function MerchPage() {
  const session = await requirePageSession();
  const data = await listMerchAndGigs(session.id);
  return <MerchGigClient initial={data} />;
}
