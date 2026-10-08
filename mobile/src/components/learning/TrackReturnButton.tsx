// Native TrackReturnButton (web: src/components/TrackReturnLink.tsx). The
// destination is external (normally the next Skool track), so it opens in the
// in-app browser via openLink.

import { Button } from "@/components/ui";
import { openLink } from "@/lib/links";
import type { TrackReturnLink } from "@/types/api";

export function TrackReturnButton({
  link,
  variant = "primary",
  size = "md",
  fullWidth,
}: {
  link: TrackReturnLink;
  variant?: "primary" | "ghost";
  size?: "md" | "sm";
  fullWidth?: boolean;
}) {
  return (
    <Button
      title={`${link.label} ↗`}
      accessibilityLabel={`${link.label}, opens in browser`}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      onPress={() => void openLink(link.url)}
    />
  );
}
