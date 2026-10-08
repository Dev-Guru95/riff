// Resolves the publishable Skool links /courses/<slug>/quiz and
// /courses/<slug>/step/<n> the way the web pages do: the server enrols the
// artist and says where the page would redirect; we replace this screen with it.

import { useEffect } from "react";
import { router, Stack, type Href } from "expo-router";

import { LoadingState, QueryView, Screen } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import type { TrackLinkResolveResponse } from "@/types/api";

export function TrackLinkResolver({ path }: { path: string | null }) {
  const query = useApiQuery<TrackLinkResolveResponse>(path, undefined, { staleTime: 0, gcTime: 0 });
  const target = query.data?.redirectTo;

  useEffect(() => {
    if (target) router.replace(target as Href);
  }, [target]);

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: "Opening…" }} />
      <QueryView query={query} skeleton={<LoadingState label="Opening your track…" />}>
        {() => <LoadingState label="Opening your track…" />}
      </QueryView>
    </Screen>
  );
}
