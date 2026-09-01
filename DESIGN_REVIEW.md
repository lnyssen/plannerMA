# Design Review: Studio planner

Reviewed against: `docs/design-system.md` (no `.design/` brief exists for this
project — this doc is the closest thing to a brief: real Média Animation
brand tokens retro-engineered from media-animation.be, delivered as a
"registre visuel plat et éditorial" — flat fills, sharp corners, no shadows).

Philosophy: flat/editorial, Média Animation brand (Hanken Grotesk + Noka,
`#612DFA`).

Date: 2026-09-01

**Note on scope**: this environment doesn't have Playwright/cursor-ide-browser
MCP, so screenshots were captured with the in-app browser tool and reviewed
visually inline rather than saved as PNG files to a `screenshots/` folder —
there is no screenshot artifact to link to below, only the findings they
produced. Coverage was also cut short partway through (Projets at all three
breakpoints, one desktop pass) to respond to a more urgent live request from
the user; task-detail/project-detail pages, dark mode, and mobile/tablet
beyond Projets were not visually captured this pass.

## Summary

The app is visually consistent and clearly on-brand at the breakpoints
checked — no responsive breakage, no overflow, touch targets read as
adequate. The most significant finding isn't a bug: **the app has quietly
drifted from its own documented brief**. `docs/design-system.md` states
explicitly, twice, that this project uses *no border-radius and no shadows*
("angles vifs, aplats pleins, aucune ombre") — but the live app now uses
`rounded-*` in 26 files and a shadow on the newest UI element. The doc is
stale, not the app; it should be updated rather than the app rolled back.

## Must Fix

1. **`docs/design-system.md` no longer matches reality on corners/shadows**:
   the doc states "aucun `border-radius`" and "aucune ombre" as deliberate,
   explicit choices, but the app now uses `rounded-lg`/`rounded-md`/
   `rounded-full` across 26 component files (buttons, cards, badges, the
   modal shell, the new avatar circle) — this is now the actual, consistent,
   load-bearing visual language of the app, not a one-off. Left as-is, this
   doc actively misleads the next person (or agent) who reads it before
   touching the UI. _Fix: update `docs/design-system.md`'s "Mise en page"
   section to describe the current rounded-corner convention as the real
   one, and note the shadow exception (see next item) explicitly rather than
   claiming zero shadows._

## Should Fix

1. **Gantt dependency-line colors are hardcoded, not tokens** — `src/app/(app)/planning/gantt-view.tsx:559,563`
   uses literal `"#ff175e"` and `"#444444"` for the SVG `stroke`/`fill`
   instead of `"var(--color-alert)"` / `"var(--color-ink)"`. These are the
   *exact* values of those two tokens today, so it looks identical right
   now — but `--color-ink` changes in dark mode (`#e8e6ee`) and this
   hardcoded `#444444` doesn't, so the default (non-conflict) dependency
   line in the Gantt will render dark-grey-on-dark-background in dark mode,
   nearly invisible. _Fix: swap both literals for the CSS variables — SVG
   `stroke`/`fill` attributes accept `var(...)` directly._
2. **New sidebar user-menu popover uses a shadow, inconsistent with the
   app's other two floating panels** — `src/components/shell/app-shell.tsx`'s
   user-menu popover (added this session) uses `shadow-xl` plus a custom
   `boxShadow`. The two pre-existing floating panels that solve the exact
   same "make this stand out from what's behind it" problem —
   `notification-bell.tsx` and `global-search.tsx` — both explicitly set
   `shadow-none` and rely on `border border-heading` + opaque background
   instead, matching the flat/no-shadow brief. The popover's background fix
   (dark, blurred, semi-transparent) is what actually solved the reported
   contrast problem; the shadow on top is an unrelated, newly-introduced
   depth language. _Fix: drop the shadow, use the same `border-heading`
   border-only pattern as the other two panels for consistency._
3. **`app-shell.tsx:162` hardcodes `#FFFFFF`/`rgba(255,255,255,0.85)`** for
   active/inactive nav-item text color instead of using a token or the
   `text-white`/`text-white/85` Tailwind utilities already used everywhere
   else in the same file. Not a visible bug (rail color doesn't change
   between themes), but it's the one spot in that component that doesn't
   follow the file's own established pattern. _Fix: align with the
   surrounding code — `className` utility instead of inline hex._

## Could Improve

1. **Project cards grid looks sparse with 1 card per client group** — on
   tablet (768px), each "Clients internes"/"Clients externes" section is its
   own CSS grid (`auto-fill, minmax(260px,1fr)`), and with only one seeded
   project per group the single card sits at ~340px instead of stretching or
   wrapping predictably. This is a data-sparsity artifact of the demo
   dataset, not a layout bug — grid behaves correctly once a client group has
   more than one project — but worth a real screenshot with realistic data
   volume before calling the breakpoint fully verified.

## What Works Well

- **No responsive breakage found** across mobile (375px) → tablet (768px) →
  desktop (1280px) on Projets: header actions wrap cleanly, search field
  stays full-width, cards go single-column on mobile without any horizontal
  scroll, and the sidebar collapses to a hamburger drawer below the `md`
  breakpoint as designed.
- **Token discipline is strong everywhere except the two spots flagged
  above** — a repo-wide scan found only 3 hardcoded hex values outside of
  the legitimate per-record `studio.fillHex`/`colorHex`/status-color data,
  in a ~26-file surface area that uses color at all. That's a good ratio for
  a project this size.
- **The "at a glance" system added this session** (nav pill counts, red
  budget/lateness badges on cards and tables) reads clearly in the real
  desktop screenshot taken during this review — confirmed live and
  unprompted: the "Tâches" nav item already shows a real "1" badge from a
  genuinely overdue seeded task, not a synthetic test case.
