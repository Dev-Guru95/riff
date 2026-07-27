import { getSession } from "@/lib/auth";
import { listBroadcasts } from "@/lib/studio-growth";
import { BroadcastsClient } from "./BroadcastsClient";

export const metadata = { title: "Broadcasts — Riff" };

export default async function BroadcastsPage() {
  const session = (await getSession())!;
  return <BroadcastsClient initial={await listBroadcasts(session.id)} />;
}
