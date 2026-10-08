import { requirePageSession } from "@/lib/auth";
import { listGoals } from "@/lib/studio-growth";
import { GoalsClient } from "./GoalsClient";

export const metadata = { title: "Goals — Riff" };

export default async function GoalsPage() {
  const session = await requirePageSession();
  return <GoalsClient initial={await listGoals(session.id)} />;
}
