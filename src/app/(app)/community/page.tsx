import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth";
import { getCommunityStatus, SKOOL_COMMUNITY_URL } from "@/lib/community";
import { CommunityOnboarding } from "./CommunityOnboarding";

// Community is a gateway to Skool — Riff does not host its own community.
// Members go straight to Skool; everyone else sees the join onboarding.
// Access is granted by admin verification only.
export default async function CommunityPage() {
  const session = await requirePageSession();
  const status = await getCommunityStatus(session.id);
  if (status === "member") redirect(SKOOL_COMMUNITY_URL);
  return <CommunityOnboarding alreadyRequested={status === "pending"} />;
}
