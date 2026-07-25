# Riff — AI-Powered Music Artist Education Platform

> Positioning: Duolingo's engagement × Coursera's structure × ChatGPT's intelligence, applied to the *business and marketing* of an independent music career.

---

## Current Features

These are the full features of the app as of now.

- **Structured courses** — Lessons, quizzes, and assignments that unlock step by step as artists progress.
- **Gamification** — XP, badges, levels, and daily streaks to keep artists engaged and finishing courses (Duolingo-style).
- **AI assignment review** — Artists submit work (text, links, images, audio, video, PDFs) and instantly get a score plus strengths, weaknesses, and next steps.
- **Social media audit** — Connects an artist's socials and scores their marketing, branding, growth, and consistency, tracked month over month.
- **Weekly missions** — Real-world challenges that reward XP and badges.
- **Leaderboards** — Global, country, and genre rankings, with rewards for top performers.

## User Flow

### 1. Download → First Value (Free)
```mermaid
flowchart TD
  A[Download app on iOS / Android] --> B[Sign up / sign in]
  B --> C[Goal & Genre intake]
  C --> D[Audience size + current links]
  D --> E{Connect socials?}
  E -- Yes --> F[Initial Social Audit + Scores]
  E -- Skip --> G[Manual baseline entry]
  F --> H[Unlock Module 1 Lesson 1]
  G --> H
  H --> I[First lesson + first weekly mission assigned]
```

### 2. Free Learning Loop
```mermaid
flowchart LR
  L[Lesson] --> Q[Quiz]
  Q -->|pass| AS[Assignment submit]
  Q -->|fail| L
  AS --> AI[AI assignment review: score + feedback]
  AI --> XP[Earn XP / Badge / Streak]
  XP --> LB[Leaderboards update: global / country / genre]
  XP --> M[Weekly missions progress]
  XP --> NEXT[Next lesson unlocks]
```

All of the above runs entirely inside the **free** app — courses, gamification, AI assignment review, social audit, weekly missions, and leaderboards.

### 3. Unlocking Pro (Join the Skool)
```mermaid
flowchart TD
  U[Artist taps AI Coach or Community] --> C{Joined the Skool community?}
  C -- Yes --> UNLOCK[Access granted]
  UNLOCK --> COACH[AI coach: personal chat mentor]
  UNLOCK --> COMM[Community: forums, peer feedback, accountability groups]
  C -- No --> PROMPT[Prompt: Join the Skool to unlock Pro]
  PROMPT --> JOIN[Join Skool community]
  JOIN --> LINK[Link Skool membership to app account]
  LINK --> UNLOCK
```

**Pro gate rule:** the AI coach and Community are the two Pro features. Tapping either while on Free surfaces a single, honest prompt to join the Skool community; joining links the membership to the app account and unlocks both. Everything else stays free.
