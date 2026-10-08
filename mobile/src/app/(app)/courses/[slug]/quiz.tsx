// /courses/<slug>/quiz — the publishable Skool link to a track's quiz.
// Resolves via GET /api/mobile/courses/[slug]/quiz, then replaces itself with
// /learn/<id> (or the course page when the track has no quiz).

import { useLocalSearchParams } from "expo-router";

import { TrackLinkResolver } from "@/components/learning/TrackLinkResolver";

export default function CourseQuizLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <TrackLinkResolver path={slug ? `/api/mobile/courses/${encodeURIComponent(slug)}/quiz` : null} />;
}
