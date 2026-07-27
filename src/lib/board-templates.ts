// Board templates: each specialized "track tool" that is really a Kanban board
// with a purpose-built set of columns + labels. Shared by the server (to seed a
// new board) and the client (to render the template picker). Keep in sync with
// the `Board.kind` inline comment in schema.prisma.

export type BoardTemplate = {
  kind: string;
  name: string;
  icon: string;
  track: number | null;
  tagline: string;
  columns: string[];
  labels: { name: string; color: string }[];
};

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    kind: "generic",
    name: "Blank board",
    icon: "🗂️",
    track: null,
    tagline: "A plain Kanban board — start from scratch.",
    columns: ["To Do", "In Progress", "Review", "Done"],
    labels: [],
  },
  {
    kind: "content_calendar",
    name: "Content Calendar",
    icon: "📅",
    track: 2,
    tagline: "Plan, draft, and schedule your social posts.",
    columns: ["Ideas", "Drafting", "Scheduled", "Posted"],
    labels: [
      { name: "Instagram", color: "brand-2" },
      { name: "TikTok", color: "accent" },
      { name: "YouTube", color: "warning" },
      { name: "Reel/Short", color: "brand" },
    ],
  },
  {
    kind: "release_planner",
    name: "Release Planner",
    icon: "🚀",
    track: 4,
    tagline: "Run a single/EP release from prep to launch.",
    columns: ["8 Weeks Out", "4 Weeks Out", "Release Week", "Live", "Wrap-up"],
    labels: [
      { name: "Artwork", color: "brand" },
      { name: "Distribution", color: "accent" },
      { name: "Promo", color: "warning" },
      { name: "Press", color: "brand-2" },
    ],
  },
  {
    kind: "pitch_tracker",
    name: "Playlist Pitch Tracker",
    icon: "🎧",
    track: 3,
    tagline: "Track every playlist submission like a pipeline.",
    columns: ["To Pitch", "Pitched", "In Review", "Placed", "Passed"],
    labels: [
      { name: "Editorial", color: "brand" },
      { name: "Curator", color: "accent" },
      { name: "Blog", color: "warning" },
    ],
  },
  {
    kind: "outreach_crm",
    name: "Outreach CRM",
    icon: "🤝",
    track: 7,
    tagline: "Manage PR, partnerships, and networking contacts.",
    columns: ["Prospects", "Contacted", "In Conversation", "Won", "Lost"],
    labels: [
      { name: "Blog", color: "warning" },
      { name: "Playlist", color: "accent" },
      { name: "Collab", color: "brand" },
      { name: "Press", color: "brand-2" },
    ],
  },
  {
    kind: "collab_board",
    name: "Collaboration Board",
    icon: "🎹",
    track: 7,
    tagline: "Coordinate a track with producers and features.",
    columns: ["Ideas", "In Progress", "Feedback", "Done"],
    labels: [
      { name: "Beat", color: "brand" },
      { name: "Vocals", color: "accent" },
      { name: "Mix", color: "warning" },
      { name: "Master", color: "brand-2" },
    ],
  },
];

export function templateFor(kind: string): BoardTemplate {
  return BOARD_TEMPLATES.find((t) => t.kind === kind) ?? BOARD_TEMPLATES[0];
}
