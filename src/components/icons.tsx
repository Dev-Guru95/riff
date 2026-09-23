// Line-icon set for the redesigned User and Admin shells.
//
// Hand-rolled rather than pulled from an icon package: the nav configs key off
// short strings (they used to hold emoji), so a registry keeps those configs
// unchanged in shape, and there is no new dependency to carry. Every glyph is
// drawn on the same 24x24 grid with a 1.5 stroke so they sit together evenly.
//
// No hooks here — this file must stay importable from Server Components.

export type IconName = keyof typeof PATHS;

const PATHS = {
  // — user navigation —
  home: (
    <>
      <path d="M3 9.6 12 3l9 6.6V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M9.5 21v-6.5h5V21" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.2A2.8 2.8 0 0 1 6.8 16.4H20" />
      <path d="M6.8 3H20v18H6.8A2.8 2.8 0 0 1 4 18.2V5.8A2.8 2.8 0 0 1 6.8 3Z" />
    </>
  ),
  chat: (
    <path d="M20.5 11.6a7.9 7.9 0 0 1-8.5 7.9 9 9 0 0 1-2.5-.4L4 21l1.4-4.2a7.6 7.6 0 0 1-1.4-4.4A7.9 7.9 0 0 1 12 4.1a7.9 7.9 0 0 1 8.5 7.5Z" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  kanban: (
    <>
      <rect x="3.5" y="4" width="4.5" height="16" rx="1.2" />
      <rect x="9.75" y="4" width="4.5" height="10.5" rx="1.2" />
      <rect x="16" y="4" width="4.5" height="13.5" rx="1.2" />
    </>
  ),
  disc: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
    </>
  ),
  route: (
    <>
      <path d="M3.5 20.5 9 12l3.5 4L20.5 4" />
      <path d="M15.5 4h5v5" />
    </>
  ),
  community: (
    <>
      <path d="M15.5 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.9a3.4 3.4 0 0 0-3.4 3.4V20" />
      <circle cx="9.5" cy="8" r="3.4" />
      <path d="M20.5 20v-1.6a3.4 3.4 0 0 0-2.6-3.3" />
      <path d="M15.5 4.7a3.4 3.4 0 0 1 0 6.6" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 5.5H5A2 2 0 0 0 5 9.5h2.5M16.5 5.5H19a2 2 0 0 1 0 4h-2.5" />
      <path d="M12 13.5V17M9 20h6M10 17h4" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.2" />
      <path d="M3 10h18" />
    </>
  ),

  // — admin navigation —
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11" />
      <path d="m7.5 10.5 4.5 4 4.5-4" />
      <path d="M4 17v2.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V17" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4.5H7.4a1.9 1.9 0 0 0-1.9 1.9v12.2a1.9 1.9 0 0 0 1.9 1.9h9.2a1.9 1.9 0 0 0 1.9-1.9V6.4a1.9 1.9 0 0 0-1.9-1.9H15" />
      <rect x="9" y="2.8" width="6" height="3.6" rx="1.1" />
      <path d="M8.8 11.5h6.4M8.8 15.2h4.4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V6z" />
      <path d="m9.3 12 1.9 1.9 3.5-3.6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20v-1.2A4.3 4.3 0 0 1 9.3 14.5h5.4a4.3 4.3 0 0 1 4.3 4.3V20" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 14.5a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 0 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1.1v.3a1.8 1.8 0 0 1-3.6 0v-.2a1.5 1.5 0 0 0-2.7-1.1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.6h-.3a1.8 1.8 0 0 1 0-3.6h.2a1.5 1.5 0 0 0 1.1-2.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 2.6-1.1v-.3a1.8 1.8 0 0 1 3.6 0v.2a1.5 1.5 0 0 0 2.7 1.1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1.1 2.6h.3a1.8 1.8 0 0 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9Z" />
    </>
  ),
  ticket: (
    <>
      <path d="M3.5 9.2V7a1.5 1.5 0 0 1 1.5-1.5h14A1.5 1.5 0 0 1 20.5 7v2.2a2.8 2.8 0 0 0 0 5.6V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17v-2.2a2.8 2.8 0 0 0 0-5.6Z" />
      <path d="M13.5 5.5v13" strokeDasharray="2 2.4" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3.5 1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z" />
      <path d="M18.5 15.5 19.4 18l2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <path d="M12 14.5v2.2" />
    </>
  ),

  // — chrome —
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8.6a6 6 0 1 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4Z" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronLeft: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  chevronDown: <path d="m5.5 9 6.5 6.5L18.5 9" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18.5" cy="12" r="1.3" />
    </>
  ),
  check: <path d="m5 12.5 4.8 4.8L19 8" />,
  pencil: (
    <>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 5.5 3 3" />
    </>
  ),
  logout: (
    <>
      <path d="M9.5 20H5.5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5.5 4h4" />
      <path d="m15 8 4 4-4 4M19 12H9.5" />
    </>
  ),

  // — stat / status glyphs —
  flame: (
    <path d="M12 21c3.6 0 6-2.3 6-5.5 0-3.6-3-5-4-8.5-2.4 1.6-2 4-2 4S10 9.5 8.6 8C7 10 6 12.4 6 15.5 6 18.7 8.4 21 12 21Z" />
  ),
  zap: <path d="M13.5 3 5.5 13.5h5L10 21l8.5-10.5h-5z" />,
  award: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.8 13.7-1.3 7 4.5-2.4 4.5 2.4-1.3-7" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17Z" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6.5-5.6 6.5-10a6.5 6.5 0 1 0-13 0c0 4.4 6.5 10 6.5 10Z" />
      <circle cx="12" cy="10.8" r="2.4" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6.5l10-2V16" />
      <circle cx="6.8" cy="18" r="2.4" />
      <circle cx="16.8" cy="16" r="2.4" />
    </>
  ),
  dollar: (
    <>
      <path d="M12 3v18" />
      <path d="M16.5 7.2A3.8 3.8 0 0 0 13 5.5h-1.6a3.2 3.2 0 0 0 0 6.4h1.2a3.2 3.2 0 0 1 0 6.4H11a3.8 3.8 0 0 1-3.5-1.8" />
    </>
  ),
  flag: (
    <>
      <path d="M5.5 21V4" />
      <path d="M5.5 5h11l-1.8 3.6 1.8 3.6h-11" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.5 13.5h4l1.4 2.6h6.2l1.4-2.6h4" />
      <path d="M6 4.5h12l2.5 9v4.4a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V13.5z" />
    </>
  ),
  graduation: (
    <>
      <path d="m12 4 9.5 4.4L12 12.8 2.5 8.4 12 4Z" />
      <path d="M6.5 10.6v4.9c0 1.5 2.5 2.9 5.5 2.9s5.5-1.4 5.5-2.9v-4.9" />
    </>
  ),
  cactus: (
    <>
      <path d="M10 21h4" />
      <path d="M12 21V6.5a2.5 2.5 0 0 1 5 0V9" />
      <path d="M12 13.5H9.5A2.5 2.5 0 0 1 7 11V9" />
      <path d="M17 9a2 2 0 0 1 0 4h-.5" />
      <path d="M7 9a2 2 0 0 0-2 2v.5" />
    </>
  ),
} as const;

export function Icon({
  name,
  size = 18,
  className,
  strokeWidth = 1.5,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
