// Response types for the read-only native-client endpoints under /api/mobile/*.
//
// Plain TypeScript with NO imports, so the Expo app can copy this file verbatim.
// Every Date is serialized by JSON as an ISO-8601 string (`ISODate`). JSON-string
// database columns (genres, goals, options, sourceUrls, plans…) are already
// parsed into arrays/objects here.
//
// Errors from every endpoint have the shape `ApiError` with an HTTP status:
// 401 (no/invalid session), 403 (forbidden / locked), 404 (not found), 500.

export type ISODate = string;

export type ApiError = { error: string; [extra: string]: unknown };

// ───────────────────────── shared ─────────────────────────

export type PlanKey = "free" | "pro" | "premium";
export type CommunityStatus = "member" | "pending" | "none";
export type LessonStatus = "locked" | "available" | "in_progress" | "completed";

/** Prefilled "Share to Skool" card. Copy `caption`, then open `url`. Never auto-posts. */
export type SharePayload = { headline: string; emoji: string; caption: string; url: string };

/** Where finishing a track sends the learner (normally the next Skool track). */
export type TrackReturnLink = { url: string; label: string; isFallback: boolean };

/** resolveLevel(totalXp) plus the raw XP total. */
export type LevelInfo = {
  totalXp: number;
  levelIndex: number;
  /** 1-based level number as the web shows it ("Level 3"). */
  levelNumber: number;
  levelKey: string;
  levelName: string;
  nextLevelName: string | null;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** xpForNextLevel - xpIntoLevel (0 at max level). */
  xpToNextLevel: number;
  progressPct: number;
  isMax: boolean;
};

export type StreakInfo = { currentLen: number; longestLen: number };

/**
 * Site-relative paths (e.g. "/badges/track.svg") are served by the web origin —
 * prefix them with the API base URL.
 */
export type SitePath = string;

export type ArtistProfileInfo = {
  stageName: string | null;
  genres: string[];
  careerStage: string;
  audienceSize: number;
  goals: string[];
  timezone: string;
};

export type ProgramProgress = {
  total: number;
  completed: number;
  complete: boolean;
  tracks: { slug: string; title: string; done: boolean }[];
};

export type CertificateInfo = {
  serial: string;
  title: string;
  programKey: string;
  issuedAt: ISODate;
};

export type ReviewResult = {
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  nextActions: string[];
  confidence: number;
};

// ───────────────────────── GET /api/mobile/me ─────────────────────────

export type MeResponse = {
  user: {
    id: string;
    email: string;
    /** Re-read from the database, not the token. */
    role: "artist" | "admin" | "reviewer" | "moderator" | string;
    status: string;
    countryCode: string | null;
    createdAt: ISODate;
    mfaEnabled: boolean;
    /** admin | reviewer | moderator — shows the Admin entry in the nav. */
    isStaff: boolean;
  };
  skool: {
    member: boolean;
    requestedAt: ISODate | null;
    joinedAt: ISODate | null;
    handle: string | null;
    status: CommunityStatus;
  };
  profile: ArtistProfileInfo | null;
  /** subscription?.plan ?? "free" — what the nav footer and Settings show. */
  plan: string;
  subscription: { plan: string; status: string } | null;
};

// ───────────────────────── GET /api/mobile/dashboard ─────────────────────────

export type Goal = {
  key: string;
  label: string;
  icon: string;
  progress: number;
  target: number;
  pct: number;
  done: boolean;
};

export type Milestone = {
  key: string;
  title: string;
  icon: string;
  achieved: boolean;
  progress: number;
  target: number;
};

export type BadgeWallItem = {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  orderIndex: number;
  earned: boolean;
  earnedAt: ISODate | null;
  /** Placeholder art path (badgeAsset(key)). */
  image: SitePath;
};

export type UserRanks = {
  globalRank: number;
  countryRank: number | null;
  genreRank: number | null;
  composite: number;
};

export type DashboardResponse = {
  stageName: string | null;
  level: LevelInfo;
  streak: StreakInfo;
  badgesEarned: number;
  ranks: UserRanks | null;
  /** First enrollment (oldest), drives "Your next move". */
  enrollment: { courseId: string; courseSlug: string; courseTitle: string } | null;
  nextLesson: { id: string; title: string; courseTitle: string } | null;
  courseProgress: number;
  /** enrollment exists but no lesson left → "Course complete!" state. */
  courseComplete: boolean;
  dailyGoal: Goal;
  weeklyGoals: Goal[];
  milestones: Milestone[];
  /** Every badge in wall order (orderIndex, key) with an `earned` flag. */
  badges: BadgeWallItem[];
  program: ProgramProgress;
  certificate: CertificateInfo | null;
  shares: {
    level: SharePayload;
    /** Only when the artist has a global rank. */
    leaderboard: SharePayload | null;
  };
};

// ───────────────────────── GET /api/mobile/courses ─────────────────────────

export type CourseCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  orderIndex: number;
  moduleCount: number;
  lessonCount: number;
  enrollment: { progressPct: number; startedAt: ISODate; completedAt: ISODate | null } | null;
};

export type CoursesResponse = { courses: CourseCard[] };

// ───────────────────────── GET /api/mobile/courses/[slug] ─────────────────────────

export type CourseTreeLesson = {
  id: string;
  title: string;
  estMinutes: number;
  xpReward: number;
  hasQuiz: boolean;
  hasAssignment: boolean;
  status: LessonStatus;
};

export type CourseTreeModule = { id: string; title: string; lessons: CourseTreeLesson[] };

export type TrackBadgeInfo = {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  image: SitePath;
};

export type CourseDetailResponse = {
  course: {
    id: string;
    slug: string;
    title: string;
    description: string;
    level: string;
    progressPct: number;
    lessonCount: number;
    completedCount: number;
  };
  modules: CourseTreeModule[];
  /** progressPct === 100 → show the "Track complete" card. */
  completed: boolean;
  badge: TrackBadgeInfo;
  /** Badge share — only when completed. */
  share: SharePayload | null;
  returnLink: TrackReturnLink;
  /** Lesson /courses/<slug>/quiz resolves to (first quiz-bearing lesson), or null. */
  quizLessonId: string | null;
  /** Lessons /courses/<slug>/step/<n> resolve to: stepLessonIds[n-1]. */
  stepLessonIds: string[];
};

/** GET /api/mobile/courses/[slug]/quiz and /step/[n] — deep-link resolution. */
export type TrackLinkResolveResponse = {
  lessonId: string | null;
  /** Web path the page would redirect to: "/learn/<id>" or "/courses/<slug>". */
  redirectTo: string;
};

// ───────────────────────── GET /api/mobile/lessons/[id] ─────────────────────────

export type LessonQuizQuestion = {
  id: string;
  /** single | multi | truefalse */
  type: string;
  prompt: string;
  options: { id: string; text: string }[];
};

export type LatestSubmission = {
  id: string;
  textContent: string;
  externalLink: string | null;
  artifactUrls: string[];
  status: string;
  aiScore: number | null;
  submittedAt: ISODate;
  review: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    nextActions: string[];
  } | null;
};

export type LessonResponse = {
  lesson: {
    id: string;
    title: string;
    /** Markdown. Empty for Skool-taught tracks → skip the reading step. */
    content: string;
    xpReward: number;
    estMinutes: number;
    courseSlug: string;
    courseTitle: string;
    alreadyCompleted: boolean;
  };
  /** Correct answers are NOT included — POST /api/quizzes/[id]/attempts grades. */
  quiz: { id: string; passThreshold: number; questions: LessonQuizQuestion[] } | null;
  assignment: { id: string; title: string; instructions: string; acceptedTypes: string[] } | null;
  prevLessonId: string | null;
  nextLessonId: string | null;
  /** Set only on the last lesson of a track. */
  returnLink: TrackReturnLink | null;
  /** Same as GET /api/assignments/[id]/submissions; null when no assignment/none yet. */
  latestSubmission: LatestSubmission | null;
};

/** 403 body when a lesson is locked. */
export type LessonLockedError = { error: string; locked: true; courseSlug: string };

// ───────────────────────── GET /api/mobile/certificates ─────────────────────────

export type CertificatesResponse = {
  programTitle: string;
  certificate: CertificateInfo | null;
  /** stageName ?? "you" — the name printed on the certificate. */
  recipient: string;
  stageName: string | null;
  program: ProgramProgress;
  share: SharePayload | null;
};

// ───────────────────────── GET /api/mobile/roadmaps ─────────────────────────

export type RoadmapHorizon = "30d" | "90d" | "6m" | "12m";
export type RoadmapPlan = { summary: string; milestones: { title: string; tasks: string[] }[] };

export type RoadmapsResponse = {
  /** Current plan per horizon; a missing key means "not generated yet". */
  plans: Partial<Record<RoadmapHorizon, RoadmapPlan>>;
};

// ───────────────────────── GET /api/mobile/leaderboard ─────────────────────────

export type LeaderboardRow = {
  userId: string;
  rank: number;
  stageName: string;
  countryCode: string | null;
  genres: string[];
  totalXp: number;
  avgQuiz: number;
  avgAssignment: number;
  streak: number;
  composite: number;
  isMe: boolean;
};

export type LeaderboardResponse = {
  page: number;
  pageSize: number;
  hasNext: boolean;
  total: number;
  rows: LeaderboardRow[];
  me: LeaderboardRow | null;
  /** "Share #N" — only when the artist is ranked. */
  share: SharePayload | null;
};

// ───────────────────────── GET /api/mobile/missions ─────────────────────────

export type MissionItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  xpReward: number;
  /** "available" when the artist has no UserMission row yet. */
  status: string;
};

export type MissionsResponse = { missions: MissionItem[]; completed: number; total: number };

// ───────────────────────── Studio ─────────────────────────

export type StudioBuilder = {
  kind: string;
  name: string;
  icon: string;
  track: number;
  tagline: string;
  placeholder: string;
  instructions: string;
  rubric: { criterion: string; weight: number }[];
};

export type StudioDraft = {
  id: string;
  kind: string;
  title: string;
  content: string;
  score: number | null;
  feedback: ReviewResult | null;
  scoredAt: ISODate | null;
  updatedAt: ISODate;
};

export type StudioGoal = {
  id: string;
  title: string;
  detail: string;
  targetDate: ISODate | null;
  progress: number;
  milestones: { text: string; done: boolean }[];
  status: string;
};

/** GET /api/mobile/studio — the AI builders (from src/lib/studio BUILDERS). */
export type StudioHubResponse = { builders: StudioBuilder[] };

/** GET /api/mobile/studio/[kind] */
export type StudioBuilderResponse = { builder: StudioBuilder; drafts: StudioDraft[] };

/** GET /api/mobile/studio/dashboard. Money is in cents. */
export type StudioDashboardResponse = {
  level: LevelInfo;
  streak: StreakInfo;
  badgeCount: number;
  finance: { income: number; expense: number; net: number };
  fanCount: number;
  boardCount: number;
  openTasks: number;
  gigCount: number;
  /** Active goals, first 5 (as the page shows). */
  activeGoals: StudioGoal[];
  activeGoalCount: number;
};

// ───────────────────────── GET /api/mobile/community ─────────────────────────

export type CommunityResponse = {
  status: CommunityStatus;
  skoolUrl: string;
  /** Members are sent straight to Skool (the web page redirects there). */
  redirectTo: string | null;
  alreadyRequested: boolean;
  skoolHandle: string | null;
};

// ───────────────────────── GET /api/mobile/coach ─────────────────────────

export type CoachMessageItem = {
  id: string;
  role: "user" | "assistant" | "system" | string;
  content: string;
  feedback: "up" | "down" | null | string;
  createdAt: ISODate;
};

export type CoachResponse =
  | {
      locked: true;
      status: Exclude<CommunityStatus, "member">;
      /** Membership requested, awaiting admin verification. */
      pending: boolean;
    }
  | {
      locked: false;
      status: "member";
      thread: { id: string; title: string; createdAt: ISODate };
      messages: CoachMessageItem[];
      stageName: string | null;
    };

// ───────────────────────── GET /api/mobile/audit ─────────────────────────

export type AuditResponse = {
  /** Platforms whose OAuth is configured server-side (else manual handle entry). */
  oauthProviders: string[];
  accounts: {
    id: string;
    platform: string;
    handle: string;
    connectVia: string;
    status: string;
    connectedAt: ISODate;
  }[];
  report: {
    marketingScore: number;
    brandingScore: number;
    growthScore: number;
    consistencyScore: number;
    deltas: Record<string, number>;
    recommendations: string[];
    createdAt: ISODate;
  } | null;
  runCount: number;
};

// ───────────────────────── GET /api/mobile/billing ─────────────────────────

export type PlanInfo = { key: PlanKey; name: string; priceMonthly: number; features: string[] };

export type BillingResponse = {
  /** free, pro, premium — display order. */
  plans: PlanInfo[];
  /** Effective plan (only active/trialing subscriptions count). */
  currentPlan: PlanKey;
  billingConfigured: boolean;
  entitlements: {
    plan: PlanKey;
    coachMessagesPerDay: number;
    socialConnections: number;
    allCourses: boolean;
    humanReview: boolean;
  };
  subscription: { plan: string; status: string; currentPeriodEnd: ISODate | null } | null;
};

// ───────────────────────── Admin (staff only) ─────────────────────────

export type AdminOverviewResponse = {
  counts: {
    artists: number;
    courses: number;
    lessons: number;
    submissions: number;
    flaggedSubmissions: number;
    quizAttempts: number;
    completedEnrollments: number;
    totalEnrollments: number;
    pendingContent: number;
  };
  completionRate: number;
  activationRate: number;
  kpis: {
    days: number;
    activeUsers: number;
    lessonCompletions: number;
    quizPasses: number;
    assignmentSubmits: number;
    coachMessages: number;
    auditRuns: number;
    missionCompletions: number;
    signups: number;
  };
  funnel: { label: string; value: number; pct: number }[];
  signupSources: { source: string | null; count: number }[];
};

export type AdminUserRow = {
  id: string;
  email: string;
  /** stageName ?? email local-part */
  name: string;
  stageName: string | null;
  role: string;
  status: string;
  createdAt: ISODate;
  plan: string;
  subscriptionStatus: string | null;
  totalXp: number;
  tracksDone: number;
  badgeCount: number;
  streak: number;
  skoolMember: boolean;
  skoolRequestedAt: ISODate | null;
  skoolHandle: string | null;
};

export type AdminUsersResponse = {
  q: string | null;
  pendingOnly: boolean;
  page: number;
  pageSize: number;
  hasNext: boolean;
  users: AdminUserRow[];
  /** Community access requests awaiting verification (all pages). */
  pendingCount: number;
};

export type AdminCoursesResponse = {
  courses: {
    id: string;
    slug: string;
    title: string;
    level: string;
    version: number;
    orderIndex: number;
    isPublished: boolean;
    moduleCount: number;
    lessonCount: number;
  }[];
};

export type AdminQuizQuestion = {
  id: string;
  type: string;
  prompt: string;
  options: { id: string; text: string }[];
  /** Correct option ids — admin only. */
  correct: string[];
  explanation: string;
  orderIndex: number;
};

export type AdminLesson = {
  id: string;
  title: string;
  orderIndex: number;
  content: string;
  xpReward: number;
  estMinutes: number;
  quiz: { id: string; passThreshold: number; xpReward: number; questions: AdminQuizQuestion[] } | null;
  assignment: {
    id: string;
    title: string;
    instructions: string;
    acceptedTypes: string[];
    rubric: unknown[];
    xpReward: number;
    minPassingScore: number;
  } | null;
};

export type AdminCourseDetailResponse = {
  course: {
    id: string;
    slug: string;
    title: string;
    description: string;
    level: string;
    isPublished: boolean;
    orderIndex: number;
    version: number;
    returnUrl: string | null;
    returnLabel: string | null;
  };
  /** Shown when returnUrl is unset. */
  fallbackReturnUrl: string;
  modules: { id: string; title: string; orderIndex: number; lessons: AdminLesson[] }[];
};

export type AdminContentSuggestion = {
  id: string;
  targetType: string;
  targetId: string | null;
  title: string;
  rationale: string;
  suggested: unknown;
  sourceUrls: string[];
  status: string;
  reviewedById: string | null;
  createdAt: ISODate;
};

export type AdminContentResponse = {
  pending: AdminContentSuggestion[];
  resolved: AdminContentSuggestion[];
};

export type AdminCouponsResponse = {
  coupons: {
    id: string;
    code: string;
    type: string;
    value: number;
    description: string;
    maxRedemptions: number;
    redeemed: number;
    active: boolean;
    expiresAt: ISODate | null;
    createdAt: ISODate;
  }[];
};

export type AdminModerationResponse = {
  /** open (default) | dismissed | resolved | all */
  status: string;
  reports: {
    id: string;
    reporterId: string;
    targetType: string;
    targetId: string;
    reason: string;
    status: string;
    reviewedById: string | null;
    createdAt: ISODate;
    /** Post body / thread title / user email, or "(deleted)". */
    preview: string;
  }[];
};

export type AdminSubmissionsResponse = {
  /** flagged (default) | reviewed | all — any other value filters by that literal status. */
  status: string;
  submissions: {
    id: string;
    status: string;
    artifactType: string;
    textContent: string | null;
    externalLink: string | null;
    artifactUrls: string[];
    aiScore: number | null;
    confidence: number | null;
    humanReviewed: boolean;
    createdAt: ISODate;
    assignment: { title: string; minPassingScore: number };
    user: { email: string };
  }[];
};

export type AdminSecurityResponse = { email: string; mfaEnabled: boolean };
