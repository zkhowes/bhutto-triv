# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bhutto Wisdom is a competitive daily trivia game built with Next.js 14, featuring:
- Season Points scoring (F1-inspired placement scale) with betting mechanics. **Customer-facing term is "Season Points"** — internal code still uses `totalF1Points` / `getF1PointsForPlacement` / `F1_POINTS_SCALE` (no DB migration). When touching UI copy, use "Season Points" / "Season Pts".
- Round-based gameplay where players take turns submitting questions
- AI-powered answer grading using Claude (Anthropic API)
- Seasonal league structure with awards and hall of fame
- Real-time game state management and notifications

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma ORM, PostgreSQL (Neon), NextAuth, Tailwind CSS, Anthropic SDK

## Development Commands

```bash
# Development
npm run dev                    # Start dev server on localhost:3000

# Database
npm run db:generate           # Generate Prisma client
npm run db:push              # Push schema changes to database (use in dev)
npm run db:seed              # Seed database with test data
npm run db:studio            # Open Prisma Studio GUI

# Build & Deploy
npm run build                # Production build
npm run start                # Start production server
npm run lint                 # Run ESLint
```

**Database Schema Changes:**
- Use `npx prisma db push` for development (directly modifies database)
- For production migrations, create proper migration files
- Always run `prisma generate` after schema changes to update Prisma Client

## Architecture

### Game Flow & Round Status Lifecycle

The game engine (`src/lib/game-engine.ts`) manages the core gameplay loop. Understanding round status transitions is critical:

```
awaiting_question → question_submitted → category_revealed → graded
                                                                ↓
                                                           under_review → graded (flag denied)
                                                                       → cancelled (flag upheld)
```

**Round Status Transitions:**
1. `awaiting_question` - At-bat player submits question (auto-submitted from bank if available)
2. `question_submitted` - Other players can now see category and place bets
3. `category_revealed` - Betting locks, players answer the question, timer starts
4. `graded` - All answers in, AI auto-grades and finalizes immediately. Scores calculated, Season Points awarded (internally still called F1 points in code)

**Key Functions:**
- `submitAnswer()` - Handles answer submission and triggers AI grading
- `closeRound()` - Calculates scores, assigns placements, updates player states
- `advanceGame()` - Progresses to next round or completes game

### Test Mode (Critical Pattern)

Test mode allows commissioners to simulate gameplay with fake players. **This is essential for testing:**

- Enabled by setting league `type: "test"` in database
- All fake players share the commissioner's `userId`
- **Use `leaguePlayerId` for player-specific lookups, NOT `userId`**
- `actAs` query parameter switches between players: `/rounds/123?actAs=player_id`
- Must thread `actAs` through all API calls in test mode

**Common Bug:** Using `userId` instead of `leaguePlayerId` breaks test mode because fake players share the same `userId`.

### AI Grading System

AI grading happens automatically during answer submission (`src/lib/ai.ts`):

- **Multiple choice:** Auto-graded by comparing options
- **Free text:** AI (Claude Sonnet) performs fuzzy matching against correct answer and acceptable answers
- Grading result stored with `gradedBy: "ai"` or `"auto"`
- Rounds auto-grade and finalize when all answers are in (no manual review step)
- Commissioners can re-grade from the graded state if needed

### Authentication & Roles

NextAuth with Google OAuth (`src/lib/auth.ts`):
- Custom session includes: `userId`, `nickname`, `avatarUrl`, `profileComplete`, `isSuperAdmin`
- **Roles per league:** commissioner (1 per league) or player
- Super admin access: Set `isSuperAdmin: true` in User table
- Profile completion required before accessing main app

### Database Structure

Key relationships (see `prisma/schema.prisma`):
```
League → Season → Game → Round → RoundAnswer
       ↓
   LeaguePlayer → GamePlayerState
```

- **League:** Settings, invite codes, auto-skip toggle
- **Season:** Container for multiple games, awards at completion
- **Game:** Single game instance, maintains batting order and player states
- **Round:** Individual trivia round with one question and multiple answers
- **GamePlayerState:** Tracks current points and elimination status per game
- **BattingOrderEntry:** Determines who's at bat each round

### Scoring System

Season Points — F1-inspired placement scale (`src/lib/scoring.ts`, internal identifiers still use F1):
- Scale: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] for top 10 placements
- Players bet points (1-max available) on their answer
- **Correct answer:** Win bet amount × placement multiplier
- **Wrong answer:** Lose bet amount
- **Fastest correct answer:** +1 bonus point
- **Absent player:** Penalty based on `absenteePenaltyType` setting
- **Elimination:** Occurs when points reach 0

## Key Files & Patterns

### Core Logic
- `src/lib/game-engine.ts` - All game state transitions, scoring, round management
- `src/lib/scoring.ts` - Season Points calculation, placement assignment (functions/constants still named F1: `getF1PointsForPlacement`, `F1_POINTS_SCALE`)
- `src/lib/ai.ts` - AI grading, question workshop, fun fact generation
- `src/lib/constants.ts` - All status enums, default settings, Season Points scale (still exported as `F1_POINTS_SCALE`)

### API Routes (Next.js App Router)
- `src/app/api/rounds/[id]/route.ts` - Get round data (hides question until bet placed)
- `src/app/api/rounds/[id]/answer/route.ts` - Submit answer, triggers AI grading
- `src/app/api/rounds/[id]/close/route.ts` - Finalize round scoring (supports re-grading)
- `src/app/api/leagues/[id]/test-advance/route.ts` - Test mode game progression

### UI Components
- `src/components/game/BettingInterface.tsx` - Betting slider UI
- `src/components/game/AnswerInterface.tsx` - Answer submission with timer
- `src/components/game/GradingInterface.tsx` - Manual grading review (question submitter)
- `src/components/game/RoundResults.tsx` - Round scorecard, question reveal

## Important Patterns

### API Request Pattern (Test Mode)
Always include `actAs` query param when in test mode:
```typescript
const actAsParam = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";
const res = await fetch(`/api/rounds/${roundId}${actAsParam}`);
```

### Player Identification
```typescript
// ❌ Wrong - breaks test mode
const myPlayer = players.find(p => p.userId === session.user.id);

// ✅ Correct - use leaguePlayerId
const myPlayer = game.playerStates.find(ps => ps.leaguePlayerId === myPlayerId);
```

### Round Status Checks
Use constants from `src/lib/constants.ts`:
```typescript
import { ROUND_STATUS } from "@/lib/constants";
if (round.status === ROUND_STATUS.CATEGORY_REVEALED) { ... }
```

## Environment Variables

Required for development (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string (Neon for production)
- `NEXTAUTH_URL` - Application URL
- `NEXTAUTH_SECRET` - Random string for session encryption
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `ANTHROPIC_API_KEY` - For AI grading and question workshop

## Common Tasks

### Adding a New Round Status
1. Update `ROUND_STATUS` in `src/lib/constants.ts`
2. Add transitions in `src/lib/game-engine.ts`
3. Update UI conditionals in round page components
4. Consider impact on test mode

### Modifying Scoring Logic
1. Edit `calculateF1Scoring()` in `src/lib/scoring.ts`
2. Test with various player counts (scale adjusts for <10 players)
3. Verify placement ties are handled correctly
4. Check absentee penalty calculation

### Adding New League Settings
1. Add field to `League` model in `prisma/schema.prisma`
2. Run `npx prisma db push`
3. Add to `allowedFields` in `src/app/api/leagues/[id]/settings/route.ts`
4. Update Commissioner Tools settings UI
5. Apply logic where setting is checked (e.g., game engine)

## Deployment

## Kanban

> Last updated: 2026-05-13 (Submit-button glitch + busted-player flow + answer-timer at submit)

### Backlog
- [ ] View-only public round dashboard — *currently requires auth, no anonymous mode*
- [ ] Season pause (functional) — *stub exists, shows alert()*
- [ ] [ZKH-39] Commissioner: no feedback after closing a round — *button has no in-flight state, no confirmation toast; users re-click and get confused*

### Up Next
- [ ] Commissioner settings editing UI — *API supports writes for answerTimerSeconds/gamesPerSeason/maxPlayers, UI is read-only*
- [ ] Shareable link generation UI — *API + model exist, needs Share buttons on game/round/season pages*

### In Progress

### Done
- [x] Submit-button glitch + busted-player flow + answer-timer at submit — *Three related round-lifecycle fixes. (1) Submit buttons (answer, question) were re-enabling mid-redirect because `setSubmitting(false)` ran in the `finally` block before the parent `fetchGame()` completed, so users saw a flash of editable state and double-clicked into "already submitted" errors. Moved the reset into the `catch` so success paths stay disabled until the parent unmounts the form. BetSlider gained a `disabled` prop wired to `placing || betPlaced` — the actual "controls release" complaint on betting was the slider remaining draggable after submit (the submit button was already disabled via `betPlaced`). (2) Busted players can now answer from `question_submitted` onward (previously gated to `category_revealed`, which most commissioners never trigger). API (`src/app/api/rounds/[id]/route.ts:175`) reveals the question to busted players in both phases; `submitAnswer` engine gate (`src/lib/game-engine.ts:587`) accepts both phases; GuideControl shows a "Busted but Not Out" guide card with an explicit "Answer Question" button that opens AnswerInterface (per-round opt-in, so each new round starts back at the guide). AnswerInterface's busted-mode gating of power-ups + bet display was already correct. (3) Answer countdown now starts at question-submit time — `submitQuestion` stamps `categoryRevealAt: new Date()` alongside the status update (`src/lib/game-engine.ts:434`), so a slow at-bat player can no longer squeeze everyone else's effective answer window. Status stays `question_submitted`; the commissioner Reveal Category endpoint still works but is no longer required for the countdown to begin. All other `categoryRevealAt` consumers (GuideControl deadline, BoxScore answer time, GradingInterface answer time, Hall of Fame answer stats) interpret the field as "when the answer clock started" and need no other changes.*
- [x] Season Points rename + admin Reviewer tab — *Customer-facing "F1 Points" → "Season Points" across hall-of-fame champion subtitle, hall-of-fame table column, league season-champion subtitle, terms page, demo page; CLAUDE.md + REQUIREMENTS.md updated to keep "F1-inspired" inspiration note while standardizing the user-facing term. Internal `totalF1Points` / `getF1PointsForPlacement` / `F1_POINTS_SCALE` left as-is (no DB migration). New admin "Reviewer" tab surfacing the at-submit question reviewer agent's `QuestionReviewLog` rows: summary cards (total reviewed, % changed, errors, unavailable, avg latency), filters (status, changed-only, text search), paginated table with status/changed badges + notes, and a side-by-side Before/After JSON diff modal. New /api/admin/question-reviews endpoint. Cross-links: each Questions-tab row now shows a colored review badge (green ✓ clean / yellow ✎ changed / red ⚠ error / gray · unavailable / — none) that jumps to the Reviewer tab filtered to that question; Question Details modal includes a Reviewer Log section listing every log entry for that question with status badges and click-to-open-diff.*
- [x] Busted-but-not-out question reveal fix — *GET /api/rounds/[id] was hiding the question from busted players because the gate keyed solely on betPlacedAt — busted players never bet, so they got "[Place your bet to see the question]" with null options even after category reveal. Route now exempts isEliminated players at round.status === "category_revealed", falling through to the standard post-bet branch that scrubs only the correct answer. Pre-reveal still shows the placeholder, matching the "Wait for the category to be revealed" copy in GuideControl. AnswerInterface (already rendered in busted mode by GuideControl.tsx:406) now receives a real question and can submit for the +1 next-game bank.*
- [x] Profile completion gate everywhere — *useRequireProfile() hook bounces signed-in-but-incomplete users to /profile?returnTo=<current path+query> on dashboard, games, leagues, league-commissioner, hall-of-fame, leagues/create, questions/workshop, questions/history, notifications. Auth JWT callback now re-reads profileComplete/nickname/isSuperAdmin from DB on every request (no more 30-day JWT staleness, no re-login required when admin flips a flag). Profile page shows a yellow banner + autoFocus + ring on the phone field when profile is incomplete, with copy clarifying that "phone required, but pick None below to opt out of texts." One-shot backfill script (scripts/reset-incomplete-profiles.ts) flips profileComplete=false for any User where phoneNumber is null/empty — applied 2026-05-06, affected 3 real users (Daniel S, Jeff Sebastian, Sean Flannigan) and 2 test fakes; they'll be prompted on next page load. Note: Gary Hanson (not Hansen, in Triangle Fellas not "Triangle Hood Fellas") DOES have a phone on file (2064079199, profileComplete=true, isActive=true) but every notification record for him has smsStatus=null while peers in the same league get smsStatus=sent — separate Mosio-side bug, not a data-completeness issue, tracked for future investigation.*
- [x] Admin overhaul — *Players tab is now paginated/server-searched (was capped at 20-most-recent users, hiding most of a 34-user roster). Each player row expands to show all league memberships with active/paused/fake/effective-notification-level badges, last 5 SMS statuses with per-attempt outcome, and a yellow diagnostic banner when phone is missing, prefs are "none", or any LeaguePlayer.isActive=false — these are the four gates a Mosio SMS has to pass, so root-causing "X isn't getting texts" no longer requires DB access. New endpoints: /api/admin/players (paginated, q + leagueId filters, returns phoneNumber/notificationPreference/profileComplete/memberships/recentNotifications), /api/admin/games (leagueId/status filters), /api/admin/rounds (gameId/leagueId/playerId filters). /api/admin/questions accepts creatorUserId so player → questions cross-link works. /api/admin/route.ts trimmed to just monitoring stats + full leagues + commissioners (each tab loads its own paginated data instead of relying on the dashboard payload). Admin page rewritten around a goTo(tab, filter) helper and a filter chip with ✕ — every cross-link goes through it: league name → players in that league, player count → same, commissioner → that user's row, current S#G# → rounds for that game, Q% → questions by that creator, round R# → opens /games/[id]?round=… in a new tab, recent-notification player → players filter. Per-tab text filter inputs added to Leagues, Players, Commissioners, Games, Rounds, Questions. League rows now also show notificationMode badge so "set to none" is visible at a glance.*
- [x] Blind bet asymmetry + closest-guess scoring — *Blind bet rebalanced to 2x upside / 1x downside (was symmetric 2x both ways): scoring multiplier now applies only on correct answers (game-engine.ts:994), BettingInterface confirmation/labels updated, BLIND 2x badges → BLIND across RoundControl + games page. Closest-guess scoring replaces Price-is-Right rules: determinePirWinners now picks min absolute distance with floating-point tolerance — going over no longer auto-loses (real example: target 1907, guess 1911 was losing to 1200; now wins). New correctAnswerUnit field on Question + QuestionDraft (Prisma schema, drafts allowedFields, submitQuestion plumbing, autoSubmit pickup) so submitters can specify "miles", "tons", etc. Submit form: format button relabeled "Closest Guess", new Unit input next to numeric answer, help text updated. Answerer UI: unit shown as badge above input + suffix inside input ("Your guess in miles"); high/low power-up copy reworded since over isn't fatal. Grading + preview cards: target shown with unit, "closest without going over" copy purged. AI workshop (system prompt + WorkshopVariation + suggestFormat) now asks for + propagates correctAnswerUnit. answerFormat string kept as "price_is_right" under the hood to avoid migrating existing rows. 16 new/updated test cases including the 1907/1911/1200 scenario; all 154 tests pass.*
- [x] Ordering grading hardening — *root-caused Yap S4G2R1 bug (items stored smallest→largest while direction said largest→smallest, so grader's canonical answer was inverted; only the lone player who answered the wrong direction "won"). validateOrderingPayload now requires orderingItemValues (length-matched, no nulls); direction-vs-values monotonicity check runs unconditionally. Workshop system prompt + QuestionSubmitForm preflight + drafts API all enforce the requirement. Defense-in-depth at grade time: closeRound + fun-fact rendering now derive canonical order from values+direction via new deriveCanonicalOrder() helper (falls back to stored orderingCorrectOrder when values absent or direction unrecognized). New shared classifyOrderingDirection() helper deduped between scoring.ts and ai.ts. 23 new tests across validate-ordering.test.ts and scoring.test.ts (152 total passing).*
- [x] Dashboard tile polish + redundant Back removed — *Question submit: AssistButton's "Back" button removed (the brainstorm toggle already opens/closes the panel); auto-trigger of generate("") for build_answer/refine modes preserved via useEffect. Dashboard: at-bat player now sees "Waiting for all answers" on question_submitted/category_revealed (was buggy "place your bet" / "Answer the question!"). Tile header: word badges replaced — "Commissioner" → C circle, "Active" → green/yellow/red dot (season+game active / between games / not started). Player count removed; status condensed to "S:1 · G:3 · Round 5 of 7". New auto-skip countdown line under the action when autoSkipEnabled and round is in skippable state, reusing AutoSkipCountdown's 3h amber / 1h red+pulse thresholds. New standings line shows ordinal place "1st of 8" or red "Busted". /api/leagues now returns updatedAt, autoSkipEnabled, currentGame.totalRounds, and computed myStanding (loads playerStates, bounded by maxPlayers ≤10).*
- [x] Submit form mobile polish — *alt-start row split into label/Workshop link header above the draft chips so chips wrap cleanly without weird right-side gap; "Help me brainstorm" tall side-button replaced with a horizontal toggle row (sparkle icon + label + switch) above the form fields, swapping in the brainstorm panel when on; image-attach icon moved below the question textarea (was overlaid bottom-left, which pushed text right of the icon on mobile).*
- [x] Auto-submit reliability — *tryAutoSubmitFromBank now also fires on revertSkip (both first- and second-skip revert paths) and resolveFlagDisagree (paused-round wake). Draft-selection logic extracted into pure pickAutoSubmitDraft helper; new auto-submit.test.ts covers eligibility, newest-first ordering, league-scoped dedup, case/whitespace insensitivity, and full-duplicate flag clearing (8 tests).*
- [x] Submit form polish — *alt-start row (drafts + Question Workshop link) sits above a hairline divider so it reads as an optional starting point; brainstorm button vertically centered between Category and Question with a larger sparkle icon and two-line "Help me / brainstorm" label so its dual scope is obvious; image-attach icon moved to bottom-LEFT of the question textarea with a touch more bottom padding (avoids the resize grip and the icon no longer crowds the focus ring).*
- [x] Question workshop revamp + AI assist — *new AssistButton + CategorySelect components; workshop page split into Suspense'd inner with searchParams support for league/round context; "Pick up where you left off" surfacing of recent drafts in the submit form; expanded edit chips and conversational AI flow in src/lib/ai.ts.*
- [x] Replay past questions — *isReplay/originalQuestionId now wired through workshop UI and questions/history API; past questions surface playedLeagues so users can pick a question to replay and the system tracks the link back to the original.*
- [x] Ordering ties (orderingItemValues) — *Question + QuestionDraft now carry parallel comparable scalars (years, populations) alongside orderingItems; scoring treats equal values as ties so multiple correct positions are accepted. game-engine + scoring updated; workshop captures values during composition.*
- [x] Auto-submit league-scope dedup — *tryAutoSubmitFromBank now dedupes against the entire league (was per-game), walks bank drafts newest-first and clears useOnNextRound on any draft whose text was already played in the league. Drafts API (POST/PUT) refuses to set useOnNextRound:true if the text was already played in any of the user's leagues (returns 409). Workshop UI surfaces the 409 via alert and falls back to saving without auto-submit.*
- [x] What's New refresh (2026-04-28) — *modal now surfaces Busted but Not Out, 24-Hour Auto-Skip, and Pause Yourself; release date bumped to 2026-04-28 so existing users see it again*
- [x] Busted but Not Out — *busted players (0 pts) can still answer questions for +1 bonus per correct, applied to next-game starting points (same season). Schema: GamePlayerState.startingPoints + bonusEarned. Engine: submitAnswer bypasses bet gate when isEliminated; closeRound zeroes their game-points/F1 and increments bonusEarned. End-of-game F1 sort tiebreaks by bonusEarned. resolveFlagAgree decrements bonus when a busted-correct round is cancelled. Chart uses per-player startingPoints (no regression, mid-game freeze-at-0 preserved). Box score adds Busted ✓ +1 / Busted ✗ states. GuideControl renders AnswerInterface in busted mode (no bet/power-ups). Cron 24h reminder includes busted players. test-advance simulates busted answers.*
- [x] League delete + betting polish — *manual cascade helper for league shutdown (covers Question/RoundAnswer/FlagReview relations missing onDelete), custom BetSlider with pointer-captured oversized hit area (bubble + thumb both grabbable, no first-touch delay), snappier btn-* disabled state with "Submitting..." immediately visible, format badge on its own line under category*
- [x] 24hr rule improvements — *auto-skip extended to answerers (warn 24h, close 27h), revert skip control, in-game countdown timer, announcement popup + SMS on enable, absentee penalty capped at 50%*
- [x] Settings cleanup + nav simplification — *removed unused settings (daily deadline, submission window, category reveal, absentee penalty type) from UI/API; removed redundant Dashboard + Create League nav links*
- [x] Game flow improvements — *auto-grade rounds (removed Lightning Mode/conclude step), auto-submit banked questions server-side, 24h auto-skip with 3h warning for at-bat players*
- [x] Usability improvements — *floating bet slider label, game status on dashboard tiles, home+workshop icons in nav, dashboard layout cleanup, season standings link, submit button spinners*
- [x] Apple Sign-In — *fixed Service ID mismatch, PKCE→state check, sameSite=none cookies for cross-site POST*
- [x] Player roster on commissioner start buttons — *shows active players with avatars before starting game/season*
- [x] League edit/delete + commissioner shutdown — *admin can rename/delete any league; commissioners can shutdown their league with 3-step confirmation (type league name to confirm)*
- [x] Self-pause + shorter invite codes — *players can pause/unpause themselves between games; invite codes now 5 chars (old codes still work)*
- [x] Busted label fix + 24h action reminders — *scorecard shows "Busted" for eliminated players; cron sends reminder after 24h of inactivity for question/answer/grading*
- [x] Triangle Fellas launch fixes — *11 fixes: invite flow, late joiners, busted label, graph freeze, SMS league name, category deselect, AI category check, PiR UX, tooltip overflow, text accessibility*
- [x] What's New popup — *shows 5 recent features to existing users on first visit after release, tracked via lastSeenWhatsNew DB field, new users excluded*
- [x] Ordering questions — *new answer format: arrange 3-4 items in correct order, PiR-style competitive grading, First Place power-up, AI workshop support*
- [x] Blind Bet — *once per game, bet before seeing category for 2x multiplier, visible to all players, cannot use on own at-bat*
- [x] Soft-deprecate plain text questions — *MC default, AI format advisor suggests MC/PiR with one-click convert, workshop biased toward structured formats, +0.5 quality boost for MC/PiR*
- [x] Image questions — *optional image attachment via Unsplash/Google search, device upload, or URL paste; AI workshop suggests images; admin moderation; needs prisma db push + env vars*
- [x] Demo click-through — */demo route, 6-step guided walkthrough with AI workshop, game phases, mock data*
- [x] Branding/lore section — *"The Order of Bhutto" monks mythology on landing page*
- [x] Pause player status — *commissioner can pause/resume players, preserves history, excludes from active play*
- [x] Cross-game round recap — *show previous game's last round results on new game start*
- [x] Throw a Flag — *NFL-style challenge system: contest rounds, player voting, score reversal*
- [x] Google OAuth + profile setup flow
- [x] Full data model (League/Season/Game/Round/Answer/Player/BattingOrder)
- [x] Game engine — question submission, betting, answering, grading, round close, scoring
- [x] Season Points scoring system (F1-inspired) + Fastest Lap bonus
- [x] AI grading — fuzzy match for free text, auto for MC
- [x] AI question workshop — 3-variation cards, edit flow, draft bank
- [x] AI league name suggestions + avatar generation
- [x] Lightning Mode (removed — now default behavior) — AI auto-grade, skip manual review
- [x] Price-is-Right answer format — *beyond spec*
- [x] Power-ups (hint, elimination, high-low) — *beyond spec*
- [x] Question quality ratings + bonus — *beyond spec*
- [x] Notification system — in-app + SMS via Mosio
- [x] Cron-based deadline warning (every 15 min)
- [x] Notification center page + NavBar bell
- [x] Commissioner tools — players, game controls, season mgmt, auto-skip toggle
- [x] Hall of Fame — 9 season awards + career stats table
- [x] Test mode — fake players, advance controls, act-as switching
- [x] Super Admin dashboard — stats, charts, search, question bank, notification stats
- [x] Shareable link infrastructure — model, API, redirect handler
- [x] Invitation link flow (join via code/link)
- [x] Absentee penalty system (two-strike skip + point deduction)
- [x] Fun facts after round close

## Deployment

Production deployed to Vercel (bwiz.zkhowes.fun):
- **Auto-deploys via GitHub Action** (`.github/workflows/deploy.yml`) on every push to `main`
- Do NOT rely on Vercel's built-in git integration for production — it only creates preview builds
- Database: Neon PostgreSQL (serverless)
- Environment variables configured in Vercel dashboard
- Prisma generates on build via `postinstall` script

**Required GitHub Secrets** (Settings → Secrets → Actions):
- `VERCEL_TOKEN` — Vercel API token
- `VERCEL_ORG_ID` — `team_q19bRUQXcAoAVjfrhi1gxRr9`
- `VERCEL_PROJECT_ID` — `prj_gKAasKGXZ0UEVzqhKqo5lWSV6nnr`

**If bwiz.zkhowes.fun stops updating:** Check GitHub Actions tab for failed runs. If the action is green but the site is stale, use `vercel promote <deployment-id>` with the token.

### Neon Transfer Budget (5 GB/month)

Polling loops and unbounded queries are the primary risk. Always follow these rules:

**Polling intervals (minimum):**
- Active gameplay page (round): 45s
- Overview pages (game, league): 90s
- NavBar notifications: 90s

**Always use Page Visibility API on polling loops** — pause when tab is hidden, refresh immediately on focus:
```typescript
let interval: ReturnType<typeof setInterval>;
const startPolling = () => { interval = setInterval(fetch, 45000); };
const handleVisibilityChange = () => {
  if (document.hidden) clearInterval(interval);
  else { fetch(); startPolling(); }
};
startPolling();
document.addEventListener("visibilitychange", handleVisibilityChange);
return () => { clearInterval(interval); document.removeEventListener("visibilitychange", handleVisibilityChange); };
```

**Stop polling for terminal states:**
- Round page: skip if `round.status === "graded"`
- Game page: skip if `game.status === "completed"`

**Always add `take:` limits to Prisma queries** — never leave a `findMany` unbounded, especially on nested includes. Current caps:
- Rounds in leagues list: `take: 20`
- Hall-of-fame answers: `take: 2000`
