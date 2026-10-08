import { requirePageSession } from "@/lib/auth";
import { listFans } from "@/lib/studio-growth";
import { FansClient } from "./FansClient";

export const metadata = { title: "Fan CRM — Riff" };

export default async function FansPage() {
  const session = await requirePageSession();
  return <FansClient initial={await listFans(session.id)} />;
}
