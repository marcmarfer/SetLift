# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**SetLift** is a personal gym webapp: plan your training, log sets between rest periods, and
see whether you are getting stronger. One account per person, mobile first (390px), installable
as a PWA.

The driving constraint is **the gym**: no signal, one hand free, and logging happens between
sets — or hours later, from the sofa. Everything writes to IndexedDB first and syncs when it can.

The guiding rule for features: if it does not help log faster or see progress better, it does
not ship.

## Commands

- `npm run dev` — Vite dev server on **5173** (`-- --host` to reach it from a phone).
- `npm run build` — `vue-tsc -b` type-check, then Vite build to `dist/`.
- `npm run preview` — serve the build.

No test suite yet. No lint step. `npx vue-tsc -b` is the check to run after every change.

`.env.local` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`).

## Stack

Vue 3 (`<script setup>`) + TypeScript + Vite · Tailwind v4 (`@tailwindcss/vite`) · vue-router ·
Pinia · Dexie (IndexedDB) · Supabase (auth + sync) · vite-plugin-pwa.

## Architecture

**Local first.** Dexie is the source of truth; screens read through `useLive` (a `liveQuery`
wrapper) so a write repaints every view. Supabase is backup and cross-device sync, never the
render path.

Tables (`src/db/index.ts`); booleans are not indexed because IndexedDB cannot:

- `exerciseFamilies` — groups the variants of one movement ("Press inclinado"). Catalogue only.
- `exercises` — mixed: no `ownerId` means catalogue (seeded on the server, read-only in the app),
  with `ownerId` it is the user's own. A variant has `familyId` and a short `variant` label.
  `bodyweight` exercises chart reps, not kilos.
- `exercisePreferences` — favourite and manual 1RM, per exercise id: the catalogue row can't hold
  them because it is not writable.
- `routines` — an ordered list of exercises, each with its set templates
  (`range` · `fixed` · `rir` · `failure` · `single`), rest, weight increment and alternatives.
- `plans` — a named, ordered selection of routine ids, with a `mode`
  (`weekly` resets every Monday · `rotation` advances only when you train, so it waits for you).
  Exactly one plan is `active`. Routines are shared: a plan only picks which ones and in what order.
- `sessions` — a dated sheet. **No open/closed state and no duration**: it is just a date, and the
  date is editable, which is what makes logging a past workout the same screen as logging today's.
- `sets` — one row per set, written the moment you tick it. On bodyweight exercises `weight` is the
  total moved and `bodyweightKg` the body's share of it, so history keeps the weight you had that day.
- `tombstones` — local deletions waiting to reach the server.

**Sync** (`src/lib/sync.ts`): each row wins by the highest `updatedAt`. New rows are pulled by
`synced_at`, stamped by the server on arrival, with one watermark per table. Deletions travel as
`deleted_at` (soft delete); a Dexie `deleting` hook writes the tombstone, so any delete anywhere
propagates. `src/lib/rows.ts` maps camelCase ↔ snake_case. The database schema lives only in
Supabase — there are no SQL files in the repo.

**Auth** (`src/stores/auth.ts`): the gate is a local marker, not the Supabase token, so the app
opens offline and stays signed in until an explicit sign-out. The marker is written only once the
second factor is done. Signing out empties the device (`src/lib/localData.ts`).

`src/lib/` holds the logic that has no UI: `dates.ts` (local `YYYY-MM-DD`, week starts on Monday),
`plan.ts` (which routine is due, the week strip), `session.ts` (opening, deferring and skipping
workouts), `progress.ts` (best set, trends, estimated 1RM), `targets.ts` (set types and their
labels), `bodyweight.ts` and `exercises.ts`.

## Design

The palette lives once in `src/style.css` as CSS custom properties mapped to Tailwind tokens
(`bg-app`, `text-muted`, `bg-accent`, `bg-hero`…). Orange is the only accent; green means "done";
grey means "below target"; black cards carry whatever matters most on the screen.

## Rules

@.claude/rules/comentarios-codigo.md
@.claude/rules/idioma-codigo.md
