// /courses/<slug>/step/<n> — the publishable Skool link to step n of a track.
// Resolves via GET /api/mobile/courses/[slug]/step/[n], then replaces itself
// with /learn/<id> (or the course page when the track has no such step).

import { useLocalSearchParams } from "expo-router";

import { TrackLinkResolver } from "@/components/learning/TrackLinkResolver";

export default function CourseStepLink() {
  const { slug, n } = useLocalSearchParams<{ slug: string; n: string }>();
  return (
    <TrackLinkResolver
      path={slug && n ? `/api/mobile/courses/${encodeURIComponent(slug)}/step/${encodeURIComponent(n)}` : null}
    />
  );
}
