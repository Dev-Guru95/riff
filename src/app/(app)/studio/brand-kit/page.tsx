import { getSession } from "@/lib/auth";
import { getBrandKit } from "@/lib/studio-tools";
import { BrandKitClient } from "./BrandKitClient";

export const metadata = { title: "Brand Kit — Riff" };

export default async function BrandKitPage() {
  const session = (await getSession())!;
  const kit = await getBrandKit(session.id);
  return <BrandKitClient initial={kit} />;
}
