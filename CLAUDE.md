# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A gamified habit tracker ("Solo Leveling"-style system windows): daily habits become quests that grant EXP/gold, feeding a JRPG layer (ATB boss battles, a 12-chapter story campaign, shadow companions, jobs/creeds, shops). Also tracks real-world data: savings (JPY, with bank/card CSV import), meals (with Gemini BYOK AI estimation), and weight (via iOS Shortcut → Firestore inbox).

- React 18 + TypeScript + Vite + Tailwind + Framer Motion, PWA (`public/sw.js`, manifest).
- **No backend server.** The client talks directly to Firebase (Google Auth + Firestore); `firestore.rules` is the entire security layer.
- Deployed to GitHub Pages by `.github/workflows/deploy.yml` on push to `main` (Firebase config comes from repo Actions secrets).
- UI text and design docs are Japanese; code identifiers and comments are English.
- The primary target device is **iPhone / iOS Safari** — memory-heavy features (e.g. in-browser LLM inference) have been tried and reverted because iOS kills the tab (see `docs/redesign/IMPLEMENTATION-LOG.md`, v3). Don't reintroduce on-device LLM inference.

## Commands

```bash
npm install
npm run dev            # http://localhost:5173/solo-level-up/ (note the base path)
npm run build          # tsc -b && vite build — this is also the typecheck
npm run test           # vitest run (all tests)
npm run test:watch     # vitest watch mode
npx vitest run src/lib/battle/__tests__/engine.test.ts   # single test file
npx vitest run -t "break gauge"                          # by test name
```

- There is no lint setup; `tsc -b` (via `npm run build`) is the check to run before committing.
- Local dev needs `.env.local` (copy `.env.example`, fill Firebase web config). Without it the app renders a "not configured" login screen — the demo harness (below) is how you exercise the app without Firebase.
- Vite base path is `/solo-level-up/` (`vite.config.ts`); override with `VITE_BASE=/` when needed (the demo harness requires it).

## Architecture

### Layering: pure `lib/`, stateful `hooks/`, rendering `components/`

- `src/lib/` is pure logic — no React, no Firestore imports (except `lib/firestore.ts`, the single CRUD wrapper around all Firestore access). **All tests live here** (`__tests__/` dirs); anything with rules/math (EXP curves, battle formulas, streaks, CSV parsing, AI-response parsing) goes in `lib` as a pure function so it's testable. Date/randomness are passed in as arguments, never read from `Date.now()`/`Math.random()` inside the logic.
- `src/hooks/` owns Firestore subscriptions and mutation flows, one hook per domain (`useShadows`, `useSavings`, `useMeals`, `useWeights`, `useItems`, …). **`useGameData.ts` (~1,500 lines) is the core**: character doc subscription, quest completion → EXP/level/gold/streak/achievement/skill-unlock/campaign-Will side effects, and the `pendingEvents` queue that drives toasts/level-up animations.
- `src/components/` renders. `App.tsx` is a simple state machine: login → character creation → `Dashboard`. `Dashboard.tsx` owns the tab bar and mounts one panel per tab; `SystemWindow.tsx` is the shared window shell.

### Battle engine and story campaign

- `src/lib/battle/engine.ts` is a **pure, deterministic reducer** `(state, input) → (state, events)`; all randomness is injected. `components/adventure/BattleScene.tsx` ticks it on a timer and replays emitted events as animations. Mechanics are split into modules (`elements`, `status`, `break`, `will`, `formulas`, `loadout`) with per-module tests plus `campaign-integration`/`balance` tests.
- Enemies are defined per chapter in `src/lib/enemies/ch01.ts`…`ch12.ts` and aggregated by `enemies/registry.ts`. Sprites are code-drawn pixel art (`spriteKit`, `sprites`, `bossSprites`, `playerSprites`, `PixelArt.tsx`).
- Story/campaign lives in `src/lib/story/` (chapters, regions, dialogue, medals, chapter gates). **Campaign save-state is persisted on the character doc itself** (`story/campaign.ts`), not a subcollection — a deliberate deviation from the design docs; keep it additive/optional so old saves load.
- "Will"(戦意)is the fuel connecting habits to battles: completing quests earns Will (with a per-day cap that rolls over in `ensureCampaign`), battles spend it.

### Firestore data model

Top-level collections, all owned by `uid` field (or doc id = uid for `characters`): `characters`, `quests`, `completions`, `weightEntries`, `meals`, `mealPresets`, `shadows`, `bossAttempts`, `items`, `savingsEntries`, `apiKeys`, `gates`, `weightInbox`.

- **Adding a collection requires editing `firestore.rules` AND manually re-publishing it in the Firebase console** — rules are not deployed by CI. Call this out in the README/commit when you touch it.
- `weightInbox` is written unauthenticated by an iOS Shortcut using a per-user API key (`apiKeys/{secret}.uid` is validated by rules); `useGameData` drains it into `weightEntries` on startup.
- `src/lib/masterConfig.ts` auto-provisions a maxed-out "master" character for allow-listed emails on first sign-in (used for testing every system).

### Demo harness (run the app without Firebase)

`demo/` + root `adventure-demo.html` / `character-demo.html` mount panels with mock in-memory state — no auth needed. Not part of the build (Vite only bundles `index.html`; tsconfig only checks `src/`).

```bash
npx vite --base=/ --port 5175
npm i --no-save playwright-core
node demo/drive.mjs        # Playwright walkthrough + screenshots (see demo/README.md)
```

The drive scripts hard-code the sandbox Chromium path; adjust `executablePath` elsewhere.

## Conventions and gotchas

- **`docs/redesign/` is the design-doc set and changelog.** Significant feature work is specified there (numbered docs 01–09) and recorded in `IMPLEMENTATION-LOG.md` with what was built, test counts, and what was deferred/reverted — read the relevant doc before touching battle/story/character systems, and append to the log for major changes.
- In `vite.config.ts` manualChunks: **keep all of firebase in a single vendor chunk** — splitting auth/firestore apart causes "cannot access before initialization" at runtime.
- Framer Motion animations must respect reduced motion; the app-wide `<MotionConfig reducedMotion="user">` in `App.tsx` handles this — don't bypass it.
- Firestore writes from game flows are merge-patches on the character doc; new character fields must be optional with migration handled on read (see `migrateAppearance`, `ensureCampaign` for the pattern).
- Gemini usage is BYOK (user-supplied key via `useAiSettings`, free tier) and only for explicit user actions (meal estimation) — never on a background/automatic path.
