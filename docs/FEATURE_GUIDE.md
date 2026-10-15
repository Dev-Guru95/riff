# Riff — Feature Guide (how to use the new tools)

> **Who this is for:** anyone learning the platform — artists, the team, a designer, or your boss.
> **What this covers:** the native **Projects** (Kanban) and **Studio** tools that turn Riff from "learn it" into "learn it *and* do it." Each feature has a one-line purpose + a step-by-step flow.

**The core loop:** **Learn** a skill (a course lesson) → **do the work** in the matching Studio tool or a board → **get AI-scored** (the builders) → **track it** on your Career Dashboard.

Everything is behind login. Two areas live in the top nav: **Projects** and **Studio**.
Sign in as `demo@riff.app` / `password123` (artist) or `admin@riff.app` / `admin12345` (admin) to follow along.

---

## Part 1 — Projects (Kanban boards)

Native project management — no Trello needed. Route: `/boards`.

### Create a board
1. Top nav → **Projects** → **+ New board**
2. Pick a **template** — Content Calendar, Release Planner, Playlist Pitch Tracker, Outreach CRM, Collaboration, or Blank. The template auto-creates the right columns and labels.
3. Name it → **Create** → you land on the board.

### Work the board
- **Add a card:** **+ Add a card** at the bottom of a column → type a title → Enter.
- **Move a card:** **drag** it between/within columns. (On mobile, open the card → **Move to column**.)
- **Columns:** **+ Add column**; click a column title to rename; **⋯** to delete.

### Card details (click a card → drawer opens)
- **Description** — markdown editor with Write/Preview.
- **Labels · Priority · Due date** — set at the top of the drawer.
- **Assignees** — click a member to assign (they're notified).
- **Checklists** — add a checklist → items → tick them (progress bar fills).
- **Attachments** — upload files (image/PDF/etc.).
- **Comments + @mentions** — comment; tap a member chip to `@mention` (they're notified).
- **Watch (👁)** — follow a card for change notifications.
- **Duplicate / Archive** — at the bottom. Restore from the board's **Archived** panel.

### Board-level (header buttons)
- **Members** — add teammates by email/stage-name, set role (Owner → Admin → Manager → Member → Guest).
- **Activity** — full history of changes.
- **Filter bar** — narrow cards by text, label, assignee, or priority.

### Projects dashboard + search
- The `/boards` landing page shows **due today / overdue / upcoming**, **project progress**, **team workload**, and **recently active** boards.
- The **search box** finds tasks, labels, comments, attachments, and people across all your boards.

---

## Part 2 — Studio (execution tools)

Route: `/studio` — a hub grouping the tools; **Career Dashboard** is the featured card.

### 📊 Career Dashboard (`/studio/dashboard`)
Open it — a read-only overview aggregating XP/level, streak, badges, net revenue, fans, boards, open tasks, and goal progress.

### 🪪 Bio & Brand-Statement Builder · 🎧 Editorial Pitch Writer (AI-scored)
1. Open the tool → **+ New draft**.
2. Write your bio / pitch.
3. **Get Riff Score** → a **0–100 score** + strengths, weaknesses, recommendations, next actions.
4. Revise and re-score; keep multiple drafts in the left list.

### ✍️ Caption & Hashtag Generator (`/studio/caption`)
1. Describe the post → pick **platform** + **tone**.
2. **Generate** → captions + hashtags.
3. **Copy** any caption, or **Copy all** hashtags.

### 🎨 Brand Kit (`/studio/brand-kit`)
Add **colours** (name + picker), **fonts** (name + usage), upload **logos/assets**, write **guidelines** (markdown) → **Save**. Your reusable brand reference.

### 👥 Fan CRM + segments (`/studio/fans`)
1. Add a fan (name, email, comma-separated **tags**).
2. Tags become **segments** — click a segment chip to filter.
3. Edit a fan's tags inline anytime.

### 📣 Broadcasts (`/studio/broadcasts`)
1. **+ New broadcast** → subject + markdown body.
2. Set a **segment** (a fan tag; blank = all).
3. **Send** → records the broadcast + audience size.
   *Note: real email delivery needs an email provider connected — until then it records the send (mirrors how billing/social degrade until keys are set).*

### 🔗 Link-in-Bio (`/studio/link-in-bio`)
1. Set **handle**, title, bio, theme, and **links** (label + URL).
2. **Publish** → public page goes live at **`/u/<handle>`** (no login — share anywhere).
3. Edit anytime; unpublish to take it down.

### 💰 Revenue & Budget (`/studio/finance`)
Add an entry (Income/Expense, category, description, amount) → see totals (income · expenses · net) and a per-category breakdown.

### 🧢 Merch & Gigs (`/studio/merch`)
- **Merch:** add items → set status/price/stock inline.
- **Gigs:** add a venue → set city/date/status/fee inline.

### 📆 Booking Scheduler (`/studio/bookings`)
Add a booking → fill contact/date/fee → move status: inquiry → held → confirmed → done.

### 🎯 Goals & Milestones (`/studio/goals`)
Add a goal → break it into **milestones** (checklist). Ticking milestones auto-fills the progress bar; set status active/done/archived.

---

## Part 3 — Admin: Course Import

1. Admin (`admin@riff.app`) → **Admin → Import**.
2. Upload a **.docx / .pdf** (sample: `docs/sample-course-import.docx`).
3. Review the **preview** — it auto-fills modules, lessons, quiz questions, and assignments → edit → **Import**.
4. The course starts as **Draft** → go to **Admin → Courses** and click the grey **"Draft"** pill to **Publish** (then it appears for students at `/courses`).

> Import works offline via a heuristic parser (recognizes `Module 1:`, `Topic 1:`, `Q1:` + `A./B./C.`, `Correct Answer:`, `True or False`/`Answer:`, and `Question:`/`Answer:`). Set `DEEPSEEK_API_KEY` for AI parsing that handles any formatting.
