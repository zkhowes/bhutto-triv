# Bhutto Wisdom — Product Specification

## Overview

Bhutto Wisdom is a competitive daily trivia game that combines sports metaphors with engaging gameplay. Players compete in leagues through seasons, taking turns creating questions while betting points on their ability to answer others' questions.

---

## Core Concepts & Terminology

### Sports Metaphors

| Term | Definition |
|------|-----------|
| **Commissioner** | League administrator with full control over settings and player management |
| **Players** | League participants who compete in games |
| **At Bat** | The player whose turn it is to submit today's question |
| **On Deck** | The player who submits tomorrow's question |
| **In The Hole** | The player who submits the day after tomorrow |
| **Your Shot** | The act of submitting your trivia question |
| **Batting Order** | The rotation of players for question submission |
| **Rounds** | Game segments styled like boxing rounds with round cards and timers |

### Structure Hierarchy

```
League
 └── Season (default: 10 games)
      └── Game (default: 5 rounds)
           └── Round (one At Bat per player)
```

| Level | Description |
|-------|-------------|
| **League** | A group of 2–10 players who compete together |
| **Season** | A series of games within a league (default: 10 games, configurable) |
| **Game** | A competition consisting of rounds (default: 5 rounds, configurable) |
| **Round** | One complete cycle where each player gets "At Bat" once |

---

## Authentication & User Setup

### Sign Up Flow

1. Google OAuth authentication
2. Collect required profile information:
   - **Nickname** — display name, doesn't have to match Google account
   - **Phone number** — for SMS notifications
   - **Timezone** — for scheduling notifications
   - **Avatar** — displayed on leaderboards
3. Accept privacy disclaimer: *"We only use your phone number for game notifications and do not share it with any other entity"*

### User Profile

- Google account (authentication)
- Nickname (display)
- Phone number (SMS)
- Timezone (scheduling)
- Avatar image (leaderboards)
- Can participate in multiple leagues simultaneously
- Can only have one entry per league

---

## League Creation & Management

### Creating a League

Three options:

- **Single Game** — Quick one-off game with default settings
- **League with Seasons** — Ongoing competitive structure
- **Test Mode** — Allows one person to be commissioner, create fake players, and act as those players to test all facets of the above modes. Should only be enabled in local development.

#### Test Mode Controls

Visible on the league page when in test mode:

| Control | Behavior |
|---------|----------|
| **Add Test Players** | Buttons to quickly add +3 or +5 fake players |
| **Advance Round Stage** | Move current round to next stage (`awaiting_question → question_submitted → category_revealed → graded`). Auto-generates fake data as needed (question, bets, answers, grades) |
| **Advance to Next Round** | Complete current round and move to next. Handles all scoring cleanup |
| **Advance to Next Game** | Complete all remaining rounds and start next game in season |
| **Switch User** | Dropdown to act as any fake player for testing (e.g. submit question as at-bat player, bet/answer as others) |

> **Goal:** Allow a single developer to walk through the entire game lifecycle with a single button click per stage — no real users or real-time deadlines required.

### League Setup (Commissioner)

- League name (required, with AI-generated suggestions)
- Number of players (2–10 max)
- Invite players via shareable invitation link
- Configure settings:
  - Games per season (default: 10)
  - Rounds per game (default: 5)
  - Daily question deadline (default: 10am PST)
  - Question submission window (default: 5pm to 7am next day)
  - Category reveal time (default: 7am)
  - Absentee Penalty (default: lose half points on second consecutive miss)

---

## Commissioner Tools

Accessible throughout the league lifecycle:

### Player Management
- Add new players (send invitation)
- Remove players
- Transfer Commissioner role to another player

### Game Controls
- Skip player's turn
- Go back to previous player
- Override AI grades (mark correct/incorrect)
- Start next season immediately (bypass 1-day delay)
- Pause season

### Settings *(between seasons only)*
- Modify rounds per game
- Change daily deadline
- Adjust absentee penalty
- Update games per season

---

## Game Flow & Daily Cycle

### Daily Timeline *(all times configurable)*

| Time | Event |
|------|-------|
| **5:00 PM** (Player's timezone) | Question submission opens — At Bat player notified: "You're Up!" |
| **7:00 AM** (next day) | Category revealed — all players notified, betting opens |
| **7:00 AM – 10:00 AM** | Players place bets, view question, submit answers |
| **10:00 AM PST** | Round closes — grading occurs, results posted, next At Bat notified |

### Betting Mechanics

- The **At Bat player does not bet or answer** their own question. They earn Season Points based on their current point total relative to other players.
- Players start each game with **20 points**
- Can bet any amount from **1 up to their total available points**
- **"All In"** button for quick max bet
- **Winning bet:** Gain points equal to bet amount
- **Losing bet:** Lose points equal to bet amount
- Cannot go negative (minimum 0 points)
- Points reset at the start of each new game

---

## Absentee Rules

### Missing Question Submission (At Bat)
- **First miss:** Skipped, moves to next player
- **Second consecutive miss in same game:** Lose half of current points (configurable penalty)

### Missing Daily Bet/Answer
- Automatic point deduction: `current points ÷ remaining rounds in game`
- Ensures players who never participate reach 0 by game end

### Reaching 0 Points
- Player loses that specific game
- Remains in league and can view all questions/results
- Eligible for next game in season
- Can only be permanently removed by Commissioner

---

## Question Creation System

### AI-Assisted Question Workshop

Available to players **anytime** (not just during At Bat):

- Chat interface for question ideation
- AI suggests question formats:
  - *"This would work well as multiple choice, would you like me to create that?"*
  - *"Free text seems best for this response type"*
- Question refinement assistance
- AI has access to question history and correct/incorrect responses — can flag if a question may be too hard or could be clarified
- Generate multiple choice options
- **Goal:** AI assists, not defaults — players should create questions themselves

### Question Management

- Save drafts (unlimited)
- Bank questions for future use
- **"Use on my next round"** — auto-submit when At Bat to avoid being skipped
- View question history from all seasons/leagues
- Replay past questions (not allowed in same season)

### Question Submission Requirements

**Category** (select from standard list or create league-specific):

> Geography · Sports · Politics · Science · History · Entertainment · Arts & Literature · Food & Drink · Technology · General Knowledge · *Create your own*

**Answer format:**
- **Multiple Choice** — provide 4 options, mark correct answer
- **Free Text** — provide correct answer(s) with acceptable variations

> Deadline: Must submit by 7am on your At Bat day (or banked question auto-submits)

### Answer Grading

| Format | Method |
|--------|--------|
| **Multiple Choice** | Automatic (instant results) |
| **Free Text** | AI fuzzy matching → question creator validates → if not validated by close, AI grade stands (`"Graded by AI"`) |

- AI captures intent: `"Barack Obama"` = `"Obama"` = `"President Obama"`
- Creator can override both correct and incorrect AI assessments

---

## Scoring System

### Season Points (F1-inspired placement scale, scaled to league size)

> Originally called "F1 Points" internally; renamed user-facing to **Season Points**. The placement scale below is still inspired by Formula 1's points system.


| Placement | Points |
|-----------|--------|
| 1st | 25 |
| 2nd | 18 |
| 3rd | 15 |
| 4th | 12 |
| 5th | 10 |
| 6th | 8 |
| 7th | 6 |
| 8th | 4 |
| 9th | 2 |
| 10th | 1 |

Scale adjusts for smaller leagues (e.g. 6 players: 25, 18, 15, 12, 10, 6) to maintain competitive balance.

### Fastest Lap Bonus

**+1 point** per round awarded to the player who:
- Wagered the most points **AND** answered correctly
- Tiebreaker: fastest answer timestamp after 7am category reveal

### Tiebreakers

Applied in order when players have identical points at round end:
1. Highest single bet won in that round
2. Fastest answer timestamp in that round
3. Alphabetical by nickname

---

## User Interfaces

### 1. Home Dashboard
- Active leagues list with quick status
- Current games in progress (round #, your position)
- Notifications badge (unanswered questions, your turn At Bat)
- Quick access to Commissioner Tools (if Commissioner)
- Hall of Fame link

### 2. League View
- League name and season number
- Current season standings (table view)
- Active game status
- Season history (past games clickable)
- Commissioner Tools button (if Commissioner)
- Invite players button (shareable link)

### 3. Game Leaderboard

**Boxing Round Card Style:**
- Current round displayed like a fight card (e.g. `ROUND 3 of 5`)
- Countdown timer styled like a boxing round clock
- Player standings table: Avatar · Nickname · Current points · Round placement · Total game points
- Batting Order sidebar: At Bat · On Deck · In The Hole

### 4. Round Status Dashboard

Accessed via shareable link, shows real-time status:
- Round number and time remaining
- At Bat / On Deck / In The Hole players
- All players with status indicators:

| Indicator | Meaning |
|-----------|---------|
| ✓ | Answered correctly (bet amount, points won) |
| ✗ | Answered incorrectly (bet amount, points lost) |
| ⏳ | Pending grade (bet amount) |
| 🎲 | Bet placed, not answered yet |
| ⚠ | Not bet yet |
| ❌ | Missed round |

- "Answer Now" button for players who haven't completed (deeplinks to question)

### 5. Question Submission Interface (At Bat)
- AI chat workshop (always accessible)
- Category selector
- Question text input
- Answer format selector (Multiple Choice / Free Text)
  - Multiple Choice: 4 option inputs + correct answer selector
  - Free Text: correct answer(s) with variations
- Draft management: save, load, view history
- "Use on next round" toggle (auto-submit when At Bat)
- Submit button
- Edit locked after first player places bet

### 6. Daily Question Interface (All Players)

**Phase 1 — Category Reveal (7am):**
- Display category
- Betting interface: slider (1 to max), "All In" button, current point balance, confirm button

**Phase 2 — Question & Answer (immediately after bet locked):**
- Category reminder
- Your bet amount (locked, displayed prominently)
- Question text
- Answer interface (Multiple Choice: radio buttons / Free Text: text input)
- Countdown timer

### 7. Round Results (After 10am close)

**Round Scorecard Style:**
- `Round X Complete` header
- Table: Avatar · Nickname · Bet amount · Answer (correct/incorrect) · Points won/lost · Season Points (placement) · Fastest Lap indicator
- Personal performance highlight
- Updated game leaderboard
- "Next Round" preview (who's At Bat)

### 8. Season Standings

Sortable table with:
- Avatar · Nickname · Games played · Total points · Average placement · Avg points/game · Correct answer % · Best finish · Worst finish

### 9. Hall of Fame *(Per League)*

**Career Statistics:**
- Average placement per player (across all seasons)
- Most points ever scored in a single game
- Most common category selected by player
- Highest single-round score
- Most consecutive correct answers (streak)
- Best season performance

**Advanced Stats:**
- **Clutch Factor** — % of all-in bets won
- **Consistency Rating** — standard deviation of placements (lower = more consistent)
- **Category Mastery** — best category by win percentage
- **Iron Man Streak** — longest active streak without missing a question
- **Risk Profile** — average bet size
- **Perfect Rounds** — rounds with 100% correct answers

### 10. End of Season Awards

Auto-generated when season completes:

| Award | Criteria |
|-------|----------|
| **MVP** | Most total points (correct answers × placement-based Season Points) |
| **Iron Man** | Perfect attendance — never missed question or answer |
| **Offensive Player of the Year** | Biggest bets, consistently wins |
| **Defensive Player of the Year** | Smallest bets, consistently wins |
| **Comeback Player of the Year** | Most improvement from previous season |
| **Rookie of the Year** | Best performance by first-season player |
| **Clutch Player** | Highest win % on all-in bets |
| **The Strategist** | Best risk/reward ratio |
| **Most Improved** | Biggest jump in average placement from previous season |

Each award displays: winner's avatar, nickname, relevant stat, and trophy icon.

### 11. Commissioner Tools

Dedicated admin interface with sections:
- **Player Management** — roster, remove, invite, transfer Commissioner role
- **Active Game Controls** — batting order, skip/go back, override grades, view pending AI grades
- **Season Management** — status, start next season, pause, view history
- **League Settings** *(between seasons only)* — all configurable parameters

### 12. Super Administrator View

Single dashboard for platform-wide oversight:
- View all commissioners, leagues, players, games, rounds, questions
- Statistics dashboard with charts over time: total players, total leagues, games started, and more
- Search function for players, games, questions
- Full question bank browser

### 13. Shareable Links

Every round, game, and season has unique shareable URLs for text, email, WhatsApp, and social media.

| Link Type | Behavior |
|-----------|----------|
| **Invitation** | Join league as player — shows league name, season, Commissioner |
| **View-Only** | Non-players can view standings and results (no bets revealed until locked) |
| **Player Deep Link** | Takes player directly to pending action (bet/answer) |

| Destination | Interface |
|-------------|-----------|
| Round link | Round Status Dashboard (#4) |
| Game link | Game Leaderboard (#3) |
| Season link | Season Standings (#8) |
| League link | League View (#2) |
| Invitation link | Sign up flow or league join (if already authenticated) |

---

## Season Lifecycle

### Season Start

**Automatic (1-day delay after previous season ends):**
- All players reset to 20 points for first game
- Batting Order randomized or continues from previous season
- First player's "At Bat" notification sent at 5pm

**Commissioner Override:**
- Can start immediately (no delay)
- Can pause indefinitely

### Season Progression
- Automatic game progression: round closes → next player At Bat → repeat
- Games complete when all rounds finish
- Next game starts automatically next day
- Season standings update after each game

### Season End
- Final game completes → standings finalized → awards generated
- 1-day pause before next season auto-starts
- Commissioner can: start immediately, modify settings, end league (with confirmation), or transfer role

### Commissioner Departure
- Must transfer Commissioner role before leaving (prevents orphaned leagues)
- Interface prompts: *"Select new Commissioner before leaving"*

---

## Technical Requirements

### MVP Feature Set

**In Scope:**
- Google OAuth authentication
- In-app notifications only (no SMS in MVP)
- League, season, game structure
- Question creation with AI assistance
- Multiple choice and free text questions
- Betting and scoring mechanics
- All described UIs and dashboards
- Shareable links
- Hall of Fame and season awards
- Commissioner tools

**Out of Scope (Future):**
- Playoffs and championships
- Player dispute resolution system
- Social features (trash talk, comments, online status)
- Video/audio questions
- Team competitions

### Platform
- Web-based application
- **Mobile-first** responsive design (phones primary, desktop secondary)
- Progressive Web App (PWA) for app-like mobile experience

### Data Storage
- User accounts and profiles
- League configurations and settings
- Game state and history
- Question bank (per player, per league)
- All historical statistics for Hall of Fame
- Shareable link tokens

### Notifications

**Notification Modes** *(commissioner-configurable per league, player can override in profile):*

| Mode | Behavior |
|------|----------|
| **None** | In-app bell only, no SMS |
| **Low** | Minimum SMS to progress the game |
| **High** | Verbose SMS including round results and deadline warnings |

> Global override in Super Admin: force all leagues to None or restore commissioner setting.

**Notification Triggers** *(SMS gated by mode):*

| Trigger | Mode | Recipients |
|---------|------|-----------|
| You're Up — submit your question | Low + High | At-bat player, on new round |
| New question ready — get your bets in | Low + High | All non-at-bat players |
| All answers in — time to grade | Low + High | At-bat player |
| You're On Deck — start preparing | Low | On-deck player |
| Round results | High | All players |
| You're about to be skipped | High | Last player without bet+answer (via cron, 30–90 min before deadline) |

- **SMS provider:** Mosio (`MOSIO_API_KEY`, `MOSIO_FROM_NUMBER`)
- **Click tracking:** SMS links go through `/api/notifications/click/[id]` before redirect
- **Cron:** Runs every 15 min to fire deadline-approaching alerts
- **Notification center:** `/notifications` with All/Unread filter, pagination
- **Bell dropdown:** Last 10 notifications, mark-all-read
- **Super Admin tab:** Total sent, SMS sent, click-through rate, by-type breakdown, global override control

### AI Integration
- Question workshop chat interface
- Question format suggestions
- Multiple choice option generation
- Free text fuzzy matching and grading
- League name suggestions
- Must be fast enough for real-time chat (30s timeout, fallback to manual entry)

---

## User Flows

### New User Journey
1. Land on homepage or invitation link
2. Click "Sign up with Google" → Google OAuth
3. Complete profile (nickname, phone, timezone, avatar)
4. Accept privacy disclaimer
5. If from invitation → automatically join league → League View
6. If new user → "Create League" or "Join League with code"

### Create League Flow
1. Choose Single Game or League with Seasons
2. Enter league name (AI suggestions appear)
3. Configure settings (or accept defaults)
4. Invite players (generate shareable link)
5. League lobby shows joined players
6. Commissioner clicks "Start Season" (or wait for auto-start)

### Daily Player Flow (Non-At-Bat)
1. Receive in-app notification at 7am
2. Open app → see today's category
3. Place bet (slider or "All In")
4. Immediately see question after bet locks
5. Submit answer
6. View Round Status Dashboard confirmation
7. Check back after 10am for results

### Daily At-Bat Player Flow
1. Receive "You're Up!" notification at 5pm
2. Open question submission interface
3. Workshop question via AI chat, load draft, select banked question, or replay past question
4. Select category, choose answer format, enter question details
5. Submit (or save draft)
6. Next morning: category revealed → place bet and answer like other players
7. After round closes: validate AI grades if free text

### Commissioner Managing Game Flow
1. Access Commissioner Tools from league view
2. Monitor active game progress via Round Status Dashboard
3. If needed: skip player, override AI grade, remove inactive player
4. Between seasons: review awards, adjust settings, start next season

---

## Design Principles

### Sports Metaphors Throughout
- Use sports terminology consistently in all UI copy
- Boxing round cards and timers for round progression
- Baseball batting order language (At Bat, On Deck, In The Hole)
- Season Points (F1-inspired placement scoring)
- Award ceremonies like professional sports
- Hall of Fame for legacy tracking
- Stat tracking similar to baseball cards / sports analytics

### Competitive & Engaging
- Real-time leaderboards create urgency
- Point betting adds risk/reward tension
- Daily cadence builds habit and anticipation
- Awards and Hall of Fame provide long-term goals
- Shareable links encourage social competition

### Mobile-First
- All interfaces optimized for phone screens first
- Quick actions (All In button, single-tap answers)
- Minimal scrolling required
- Large touch targets
- Fast loading times

### Clear Communication
- Always show current state (round #, time remaining, your turn status)
- Proactive notifications before deadlines
- Visual indicators for all player statuses
- Confirm destructive actions (bets, Commissioner overrides)
- Celebrate wins, soften losses with statistics

---

## Success Metrics

### Engagement
- Daily active users (DAU) per league
- Question submission rate (% of At Bat turns completed)
- Bet/answer completion rate
- Average time to answer after category reveal
- Retention rate season-over-season

### Quality
- AI grading accuracy (% of grades validated by question creators)
- Question replay rate (indicates quality of past questions)
- Average bet size (indicates confidence in questions)
- Commissioner tool usage (indicates issues needing intervention)

### Growth
- New league creation rate
- Average league size
- Invitation link conversion rate
- Players in multiple leagues (cross-engagement)

---

## Future Considerations (Post-MVP)

### Features
- Playoffs and championship structure
- Player dispute resolution (petition Commissioner for grade review)
- Social features (comments, reactions, trash talk)
- Team-based competitions
- Video/audio question formats
- Integration with trivia question databases
- Private betting (hide bets until round close)

### Enhancements
- Advanced AI question difficulty balancing
- Automated category recommendations based on player strength/weakness
- Predictive betting suggestions
- Mobile native apps (iOS/Android)
- Spectator mode for non-players
- Tournament bracket system for season playoffs
- Merchandise/prizes for top performers

---

## Edge Cases & Error Handling

### Player Scenarios

| Scenario | Behavior |
|----------|----------|
| Player joins mid-season | Enters next game with full points, no historical stats for current season |
| Player removed mid-game | Game continues; their questions remain but they cannot answer |
| All players at 0 points | Game ends immediately; placements by last positive point total |
| Tie in final standings | Tiebreaker rules applied recursively |

### Technical Scenarios

| Scenario | Behavior |
|----------|----------|
| Question submitted after first bet placed | Edit locked — question cannot change |
| AI grading fails | Question creator must manually grade (cannot remain pending) |
| Commissioner abandons league | Cannot delete account until Commissioner is transferred |
| Player misses timezone | Deadline based on league timezone, not player timezone |
| Shareable link used by existing player | Recognizes account, shows "Already in league" |

### Network / Performance

| Scenario | Behavior |
|----------|----------|
| Notification not delivered | Player can check in-app status anytime |
| Slow AI response in workshop | Loading state with 30s timeout, fallback to manual entry |
| Concurrent bets at deadline | First-come-first-served timestamp |
| Server downtime during round close | Extend deadline automatically, notify all players |

---

## Implementation Notes

### Priority 1 — Core Gameplay
- Authentication system (Google OAuth)
- League/Season/Game data models and relationships
- Question submission with AI chat interface
- Betting and answer submission flow
- Automatic grading (multiple choice) and AI grading (free text)
- Season Points scoring system with Fastest Lap (F1-inspired)
- Game and season leaderboards
- Basic notification system (in-app only)

### Priority 2 — Management & History
- Commissioner Tools interface
- Round Status Dashboard
- Question banking and replay system
- Season awards generation
- Hall of Fame statistics
- Shareable links for all entities

### Priority 3 — Polish & Optimization
- Mobile-responsive design with boxing/sports theming
- AI league name suggestions
- Advanced Hall of Fame stats
- Configurable absentee penalties
- Timezone handling for all notifications
- Error handling and edge cases

### Key Technical Decisions
- Database schema (relational — PostgreSQL/Neon via Prisma)
- AI service (Anthropic Claude API)
- Notification delivery (polling + SMS via Mosio)
- Image hosting for avatars
- Real-time updates (polling with Page Visibility API)

### Testing Focus Areas
- Concurrent bet submissions at deadline
- Timezone conversion accuracy
- AI grading fuzzy matching edge cases
- Commissioner role transfer integrity
- Point calculations with varying league sizes (Season Points scaling, F1-inspired)
- Question edit locking timing
- Absentee penalty calculations

---

## Glossary

| Term | Definition |
|------|-----------|
| **At Bat** | Player whose turn it is to create today's question |
| **On Deck** | Next player in batting order (tomorrow's question creator) |
| **In The Hole** | Player after On Deck (creates question day after tomorrow) |
| **Your Shot** | Submitting your trivia question |
| **Batting Order** | Rotation sequence for question creation |
| **Commissioner** | League administrator |
| **League** | Group of players competing together |
| **Season** | Series of games (default: 10) |
| **Game** | Competition with multiple rounds (default: 5) |
| **Round** | Complete cycle where each player gets At Bat once |
| **Fastest Lap** | Bonus point for highest bet + correct answer + fastest time |
| **All In** | Bet all available points |
| **Absentee Penalty** | Points lost for missing second consecutive question submission |
| **Hall of Fame** | All-time league statistics and records |
| **Round Card** | Boxing-style visual showing current round and timer |
| **Graded by AI** | Answer graded by AI without question creator validation |
