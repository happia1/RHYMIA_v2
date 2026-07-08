# RYHMIA_v2
리미아 프로젝트 바이브코딩 구현 두번째 - 냉장고

# Fridge

> Reducing the questions families repeat every day, making home life run smoother.

**A family home dashboard that lets you understand your household's status in 5 seconds.**

---

## Overview

Fridge is a shared family life operating dashboard — think of it as a digital version of the notes and reminders stuck to your refrigerator door.

It brings together meals, schedules, shopping, and notices into a single home screen, so every family member can instantly see what's happening today without asking.

```
"What's for dinner?"     →  Today's Meal card
"When are you home?"     →  Routine-based Family Status
"What do I need to pack?" →  Schedule with supplies memo
"We're out of milk"      →  Shopping list
```

---

## Features

### Home Tab
- **What's for dinner?** — Upcoming meal summary with participation status
- **What's on today?** — Today / This Week toggle for shared schedules
- **Family right now** — Real-time status per member based on daily routines
- **Shopping list** — Check off items with date-based purchase archive
- **Board** — Sticky notes (expiring) / Memos / Notices

### Meal Tab
- Weekly calendar-based meal management
- Main dish + sides structure (menu-style entry)
- Participation check, likes, comments
- Ingredient-based meal suggestions
- Map integration (Kakao Maps) for dining out

### Schedule Tab
- Month / Week / Year view switching
- Filter by visibility (shared / private), member, and keyword
- Routine editor — per-day 24h circular clock or timetable view
- Grocery template — attach spend amount and receipt image
- Monthly household expense summary

### Settings Tab
- Family workspace management
- External share link (read-only view for grandparents / caregivers)
- Notification preferences

### Voice Agent (P0-B)
- Register meals, schedules, shopping items, and notices by voice
- Whisper STT → LLM intent routing → Slide card confirmation UI

---

## Design System — "Smart Home Mirror Display"

The fridge door as a metaphor for a smart mirror: a minimal dashboard that separates information with typography and whitespace instead of cards or containers. Dark mode is the default mood; light mode is also supported.

- **No blocks.** No cards, background boxes, or container borders. Sections are separated only by (1) a small uppercase-tracked label, (2) a 0.5px hairline, and (3) vertical spacing (30px between sections).
- **Theme via CSS variables** — `--bg-page`, `--text-primary`, `--text-secondary`, `--text-muted`, `--hairline` flip between dark (`#141417` background / white text) and light (`#F5F4F0` background / near-black text). Two shared accent colors regardless of theme: `--accent-honey` (`#E8A04A`, time/meals) and `--accent-sage` (`#5BAD7F`, participation/completion).
- **Typographic hierarchy carries depth** — hero time at 44px/300, primary info (e.g. menu name) at 26px/400, body 13–15px, secondary text 11–12px, section labels 10px with 0.14em letter-spacing. Numbers use tabular figures.
- **Minimal components** — icon-only buttons (no background/border), name-first avatars, emoji reserved for family status badges, active carousel dots as an elongated honey pill vs. small dots otherwise. No shadows, gradients, or blur.
- **Layout** — mobile is a vertical stack with hairline separators; tablet landscape (lg, 1024px+) switches to 3 columns (clock/profile · today's info · board/shopping). All spacing/sizing values are CSS variables or Tailwind tokens, never hardcoded.
- **Writing tone** — short and plain, no greetings or filler. Even empty states are a single line (e.g. "No schedule yet").

Full spec: `PRD_fridge` § 10 ("디자인 가이드").

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL + Realtime + Storage) |
| Document DB | MongoDB |
| AI Agent | FastAPI + LangGraph |
| STT | OpenAI Whisper |
| LLM | Gemini 2.5 Flash |
| Frontend Deploy | Vercel |
| Server Deploy | Render |
| Payments | Toss Payments |
| Maps | Kakao Maps API |

---

## Getting Started

### Prerequisites

- Node.js 18.17+
- Supabase account
- Kakao / Google OAuth app credentials

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/fridge.git
cd fridge
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OAuth
KAKAO_CLIENT_ID=your_kakao_rest_api_key
KAKAO_CLIENT_SECRET=your_kakao_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key

# Maps
NEXT_PUBLIC_KAKAO_MAP_KEY=your_kakao_map_api_key

# Payments
TOSS_CLIENT_KEY=your_toss_client_key
TOSS_SECRET_KEY=your_toss_secret_key
```

### Database Setup

Run `supabase/schema.sql` in your Supabase project's SQL Editor.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/         # Login
│   ├── (main)/
│   │   ├── layout.tsx        # Bottom nav
│   │   ├── home/             # Home tab
│   │   ├── food/             # Meal tab
│   │   ├── schedule/         # Schedule tab
│   │   └── settings/         # Settings tab
│   └── layout.tsx
├── components/
│   ├── home/
│   ├── food/
│   ├── schedule/
│   └── ui/                   # Shared components
├── lib/
│   └── supabase/
├── hooks/
└── types/
```

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| P0-A | Prototype — Home / Meal / Schedule / Settings | 🚧 In progress |
| P0-B | Voice agent (Whisper + LLM routing) | ⏳ Planned |
| P1 | Meal voting, expense chart, reorder alerts | ⏳ Planned |
| P2 | Receipt OCR, AI meal suggestions, daily briefing | ⏳ Planned |
| P3 | Utility bill automation, MyData integration | ⏳ Planned |

---

## Documentation

- [PRD v1.2](./RHYMIA_v2.md)

---

## License

Private repository — All rights reserved.
