import { requirePageSession } from "@/lib/auth";
import { getBrandKit } from "@/lib/studio-tools";
import { BrandKitClient } from "./BrandKitClient";

export const metadata = { title: "Brand Kit — Riff" };

export default async function BrandKitPage() {
  const session = await requirePageSession();
  const kit = await getBrandKit(session.id);
  return <BrandKitClient initial={kit} />;
}
