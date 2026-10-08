import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth";
import { builderFor, listDrafts } from "@/lib/studio";
import { AiBuilder } from "./AiBuilder";

export default async function BuilderPage({ params }: { params: Promise<{ kind: string }> }) {
  const session = await requirePageSession();
  const { kind } = await params;
  const builder = builderFor(kind);
  if (!builder) notFound();
  const drafts = await listDrafts(session.id, kind);
  return <AiBuilder builder={builder} initialDrafts={drafts} />;
}
