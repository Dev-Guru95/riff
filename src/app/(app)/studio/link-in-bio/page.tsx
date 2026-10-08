import { requirePageSession } from "@/lib/auth";
import { getLinkPage } from "@/lib/studio-growth";
import { LinkInBioClient } from "./LinkInBioClient";

export const metadata = { title: "Link-in-Bio — Riff" };

export default async function LinkInBioPage() {
  const session = await requirePageSession();
  return <LinkInBioClient initial={await getLinkPage(session.id)} />;
}
