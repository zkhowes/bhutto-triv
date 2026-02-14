Bhutto Wisdom - Product Specification 

Overview 

Bhutto Wisdom is a competitive daily trivia game that combines sports metaphors with engaging gameplay. Players compete in leagues through seasons, taking turns creating questions while betting points on their ability to answer others' questions. 

Core Concepts & Terminology 

Sports Metaphors 

Commissioner: League administrator with full control over settings and player management 

Players: League participants who compete in games 

At Bat: The player whose turn it is to submit today's question 

On Deck: The player who submits tomorrow's question 

In The Hole: The player who submits the day after tomorrow 

Your Shot: The act of submitting your trivia question 

Batting Order: The rotation of players for question submission 

Rounds: Game segments styled like boxing rounds with round cards and timers 

Structure Hierarchy 

League: A group of 2-10 players who compete together 

Season: A series of games within a league (default: 10 games, configurable by Commissioner) 

Game: A competition consisting of rounds (default: 5 rounds, configurable by Commissioner) 

Round: One complete cycle where each player gets "At Bat" once 

 

Authentication & User Setup 

Sign Up Flow 

Google OAuth authentication 

Collect required information:  

Nickname (display name, doesn't have to match Google account) 

Phone number (for future SMS notifications) 

Timezone (for scheduling notifications) 

Avatar upload (displayed on leaderboards) 

Privacy disclaimer: "We only use your phone number for game notifications and do not share it with any other entity" 

User Profile 

Google account (authentication) 

Nickname (display) 

Phone number (future SMS) 

Timezone (scheduling) 

Avatar image (leaderboards) 

Can participate in multiple leagues simultaneously 

Can only have one entry per league 

 

League Creation & Management 

Creating a League 

Three Options: 

Single Game: Quick one-off game with default settings 

League with Seasons: Ongoing competitive structure 

Test Mode: Allows one person to be commissioner, create fake players, act as those players, in order to test all facets of the two modes above. This should only be enabled when deployed to a local development environment.

Test Mode Controls (visible on league page when in test mode):

Add Test Players: Buttons to quickly add +3 or +5 fake players to the league

Advance Round Stage: Button to move the current round to its next stage in the workflow (awaiting_question → question_submitted → category_revealed → graded). When advancing through stages, the system should auto-generate fake data as needed (e.g., auto-create a question when moving past awaiting_question, auto-submit bets/answers for fake players when moving past category_revealed, auto-grade when moving to graded).

Advance to Next Round: Button to complete the current round and move to the next round in the game. Should handle all cleanup (scoring, F1 points, etc.) for the current round before advancing.

Advance to Next Game: Button to complete all remaining rounds in the current game and start the next game in the season. Should properly score and close everything.

Switch User: In test mode, the commissioner can act as any fake player. A user-switcher dropdown should let the commissioner select which player they are "acting as" for testing purposes (e.g., submitting a question as the at-bat player, placing bets and answering as other players).

The goal of test mode controls is to allow a single developer to quickly walk through the entire game lifecycle without needing multiple real users or waiting for real-time deadlines. Every stage transition should be achievable with a single button click from the league page.

League Setup (Commissioner): 

League name (required, with AI-generated suggestions) 

Number of players (2-10 max) 

Invite players (shareable invitation link) 

Configure settings:  

Games per season (default: 10) 

Rounds per game (default: 5) 

Daily question deadline (default: 10am PST, configurable) 

Question submission window (default: 5pm to 7am next day) 

Category reveal time (default: 7am) 

Absentee Penalty (default: lose half points on second consecutive miss) 

 

 

Commissioner Tools 

Accessible throughout league lifecycle: 

Player Management:  

Add new players (send invitation) 

Remove players 

Transfer Commissioner role to another player 

Game Controls:  

Skip player's turn 

Go back to previous player 

Override AI grades (mark correct/incorrect) 

Start next season immediately (bypass 1-day delay) 

Pause season 

Settings (between seasons only):  

Modify rounds per game 

Change daily deadline 

Adjust Absentee Penalty 

Update games per season 

 

Game Flow & Daily Cycle 

Daily Timeline (Default, all times configurable) 

5:00 PM (Player's Timezone) - Question Submission Opens 

"At Bat" player receives in-app notification: "You're Up!" 

Player accesses AI-assisted question creation interface 

Can workshop questions, save drafts, or use banked questions 

7:00 AM (Next Day) - Category Reveal & Betting Opens 

All players receive in-app notification 

Category is revealed to all players 

Players have until deadline (default 10am PST) to:  

Place their bet (1 to all available points) 

View question immediately after bet is locked 

Submit their answer 

10:00 AM PST (Configurable) - Round Closes 

All bets and answers must be submitted 

Auto-grading occurs for multiple choice 

AI grading with creator validation for free text 

Results posted 

Next player moves to "At Bat" 

New Players can be added at the end of a round and will go to the end of the batting order.  

Betting Mechanics

The "At Bat" player (question creator) does NOT place a bet or answer their own question for that round. They still earn F1 placement points based on their current betting points relative to other players, but they do not participate in the bet/answer cycle for the question they created.

Players start each game with 20 points

Can bet any amount from 1 up to their total available points

"All In" button for quick max bet 

Winning bet: Gain points equal to bet amount 

Losing bet: Lose points equal to bet amount 

Cannot go negative (minimum 0 points) 

Points reset at the start of each new game 
 

 

Absentee Rules 

Missing Question Submission (At Bat): 

First miss: Skipped, moves to next player 

Second consecutive miss in same game: Lose half of current points (configurable penalty) 

Missing Daily Bet/Answer: 

Automatic point deduction: Current points ÷ Remaining rounds in game 

Ensures players who never participate reach 0 by game end 

Reaching 0 Points: 

Player loses that specific game 

Remains in league and can view all questions/results 

Eligible for next game in season 

Can only be permanently removed by Commissioner 

 

Question Creation System 

AI-Assisted Question Workshop 

Available to players anytime (not just during their At Bat window): 

Features: 

Chat interface for question ideation 

AI suggests question formats:  

"This would work well as multiple choice, would you like me to create that?" 

"Free text seems best for this response type" 

Question refinement assistance 

AI has both questions, answers, and history of correct and incorrect responses. It can use this to give feedback on “this may be too hard of a question for your players” or “this question could be clarified with the following”. The goal here is for AI to assist though and not to be the default for creating questions.  

Generate multiple choice options 

Question Management: 

Save drafts (unlimited) 

Bank questions for future use 

"Use on my next round" - auto-submit when At Bat to avoid skip 

View question history from all seasons/leagues 

Replay past questions (not allowed in same season) 

Question Submission Requirements 

Select category from standard list: 

Geography 

Sports 

Politics 

Science 

History 

Entertainment 

Arts & Literature 

Food & Drink 

Technology 

General Knowledge 

Create your own – These will be available within a league and not shared more broadly 

Submit question text 

Choose answer format: 

Multiple Choice: Provide 4 options, mark correct answer 

Free Text: Provide correct answer(s) with acceptable variations 

Deadline: Must submit by 7am on your At Bat day (or banked question auto-submits) 

Answer Grading 

Multiple Choice: 

Automatic grading (instant results) 

Free Text: 

AI fuzzy matching (captures intent: "Barack Obama" = "Obama" = "President Obama") 

Question creator validates AI grade 

If creator doesn't validate by round close: AI grade stands, marked as "Graded by AI" 

Creator can override both correct and incorrect AI assessments 

 

Scoring System 

Round Scoring (F1-Style, Scaled) 

Points awarded based on placement within each round: 

Standard 10-Player Scale: 

1st place: 25 points 

2nd place: 18 points 

3rd place: 15 points 

4th place: 12 points 

5th place: 10 points 

6th place: 8 points 

7th place: 6 points 

8th place: 4 points 

9th place: 2 points 

10th place: 1 point 

Scaled for Smaller Leagues: 

If 6 players: 1st gets 25, 2nd gets 18, 3rd gets 15, 4th gets 12, 5th gets 10, 6th gets 6 

Maintains competitive balance regardless of league size 

Fastest Lap Bonus 

+1 point awarded per round to: 

Player who wagered the most points AND answered correctly 

If multiple players tie on wager amount, fastest timestamp wins 

Timestamp = earliest answer submission after 7am category reveal 

Tiebreakers 

If players have identical points at round end: 

Highest single bet won in that round 

Fastest answer timestamp in that round 

Alphabetical by nickname 

 

User Interfaces 

1. Home Dashboard 

Active leagues list with quick status 

Current games in progress (round #, your position) 

Notifications badge (unanswered questions, your turn At Bat) 

Quick access to Commissioner Tools (if Commissioner) 

Hall of Fame link 

2. League View 

League name and season number 

Current season standings (table view) 

Active game status 

Season history (past games clickable) 

Commissioner Tools button (if Commissioner) 

Invite players button (shareable link) 

3. Game Leaderboard 

Boxing Round Card Style: 

Current round number displayed like fight round card (e.g., "ROUND 3 of 5") 

Countdown timer showing time remaining in round (styled like boxing round clock) 

Player standings table:  

Avatar 

Nickname 

Current points 

Round placement 

Total game points (accumulated across all rounds) 

Batting Order sidebar:  

At Bat (today's question creator) 

On Deck (tomorrow) 

In The Hole (day after) 

4. Round Status Dashboard 

Accessed via shareable link, shows real-time status: 

Round number and time remaining 

At Bat, On Deck, In The Hole players 

All players with status indicators:  

✓ Answered correctly (show bet amount, points won) 

✗ Answered incorrectly (show bet amount, points lost) 

⏳ Pending grade (show bet amount) 

🎲 Bet placed, not answered yet (show bet amount) 

⚠ Not bet yet 

❌ Missed round (no bet/answer) 

"Answer Now" button for players who haven't completed (deeplink to question) 

5. Question Submission Interface (At Bat) 

AI chat workshop (always accessible, not just during At Bat) 

Category selector 

Question text input 

Answer format selector (Multiple Choice / Free Text) 

If Multiple Choice: 4 option inputs + correct answer selector 

If Free Text: Correct answer(s) input with variations 

Draft management:  

Save draft 

Load saved draft 

View question history (replay past questions) 

"Use on next round" toggle (auto-submit when At Bat) 

Submit button 

Edit capability (until first player places bet and sees question) 

6. Daily Question Interface (All Players) 

Phase 1 - Category Reveal (7am): 

Display category 

Betting interface:  

Slider or input (1 to max available points) 

"All In" quick button 

Current point balance display 

Confirm bet button 

Phase 2 - Question & Answer (immediately after bet locked): 

Category reminder 

Your bet amount (locked, displayed prominently) 

Question text 

Answer interface:  

Multiple Choice: Radio buttons for 4 options 

Free Text: Text input field 

Submit answer button 

Countdown timer (time remaining until round close) 

7. Round Results (After 10am close) 

Round Scorecard Style: 

"Round X Complete" header 

Table showing all players:  

Avatar 

Nickname 

Bet amount 

Answer (correct/incorrect) 

Points won/lost 

Round placement points (F1 scoring) 

Fastest Lap indicator (if earned) 

Personal performance highlight 

Updated game leaderboard 

"Next Round" preview (who's At Bat) 

8. Season Standings 

Table with seasonal statistics:  

Avatar 

Nickname 

Games played 

Total points (accumulated F1 scores) 

Average placement 

Average points per game 

Correct answer percentage 

Best finish 

Worst finish 

Sortable by any column 

9. Hall of Fame (Per League) 

Accessible from league view, tracks all-time records: 

Career Statistics: 

Average placement per player (across all seasons) 

Most points ever scored in a single game (note: scales with rounds) 

Most common category selected by player 

Highest single-round score 

Most consecutive correct answers (streak) 

Best season performance 

Advanced Stats: 

Clutch Factor: Percentage of all-in bets won 

Consistency Rating: Standard deviation of placements (lower = more consistent) 

Category Mastery: Best category by win percentage 

Iron Man Streak: Longest active streak without missing a question 

Risk Profile: Average bet size 

Perfect Rounds: Rounds with 100% correct answers 

10. End of Season Awards 

Automatically generated when season completes, displayed on dedicated awards page: 

Award Categories: 

MVP: Player with most total points (correct answers × F1 placements) 

Iron Man Award: Perfect attendance (never missed question or answer) 

Offensive Player of the Year: Player who makes biggest bets and consistently wins 

Defensive Player of the Year: Player who makes smallest bets and consistently wins 

Comeback Player of the Year: Most improvement from previous season 

Rookie of the Year: Best performance by first-season player (if applicable) 

Clutch Player: Highest win percentage on all-in bets 

The Strategist: Best risk/reward ratio (points earned vs points wagered) 

Most Improved: Biggest jump in average placement from previous season 

Each award shows: 

Winner's avatar and nickname 

Relevant stat (e.g., "98% attendance" for Iron Man) 

Trophy icon or badge 

11. Commissioner Tools 

Dedicated admin interface accessible only to Commissioner: 

Navigation Sections: 

Player Management 

Current roster with avatars 

Remove player button (with confirmation) 

Invite new player (generates shareable link) 

Transfer Commissioner role (dropdown to select new Commissioner) 

Active Game Controls 

Current Batting Order visualization 

Skip player button (moves to next in order) 

Go back button (return to previous player) 

Override grade (for any answered question, mark correct/incorrect) 

View all pending AI grades requiring validation 

Season Management 

Current season status 

Start next season immediately (bypass 1-day delay) 

Pause current season 

View season history 

League Settings (editable between seasons only) 

Games per season 

Rounds per game 

Daily question deadline time 

Question submission window (start and end times) 

Category reveal time 

Absentee Penalty configuration 

 

12. Super Administrator View  

We need a single place to see all commissioners, leagues, players, games, rounds, questions. We need to see some basic statistics such as:  
 
* Total players, total leagues, games started, come up with more.  

Shareable Links 

Every round, game, and season has unique shareable URLs for: 

Text messaging 

Email 

WhatsApp 

Social media 

Link Types: 

Invitation Links (League/Game Join) 

Allows recipient to join league as player 

Shows league name, current season, Commissioner 

"Join League" button 

View-Only Links (Round/Game/Season Status) 

Non-players can view standings and results 

Cannot participate or see internal details (bets until locked) 

Useful for spectators or promoting league 

Player Deep Links (Round Status with Action) 

Takes player directly to pending action (bet/answer) 

Used for "hey go answer your question" reminders 

Shows Round Status Dashboard with "Answer Now" button 

Link Destinations: 

Round link → Round Status Dashboard (interface #4) 

Game link → Game Leaderboard (interface #3) 

Season link → Season Standings (interface #8) 

League link → League View (interface #2) 

Invitation link → Sign up flow or league join (if authenticated) 

 

Season Lifecycle 

Season Start 

Automatic (1-day delay after previous season): 

All players reset to 20 points for first game 

Batting Order randomized or continues from previous season 

First player's "At Bat" notification sent at 5pm 

Commissioner Override: 

Can start immediately (no delay) 

Can pause indefinitely 

Season Progression 

Automatic game progression (round closes → next player At Bat → repeat) 

Games complete when all rounds finish 

Next game starts automatically next day 

Season standings update after each game 

Season End 

Final game completes 

Season standings finalized 

Awards automatically generated and displayed 

1-day pause before next season auto-starts 

Commissioner can:  

Start next season immediately 

Modify settings before next season 

End league (requires confirmation) 

Transfer Commissioner role 

Commissioner Departure 

If Commissioner wants to leave: 

Must transfer Commissioner role to existing or newly invited player 

Cannot leave without transferring (prevents orphaned leagues) 

Interface prompts: "Select new Commissioner before leaving" 

 

Technical Requirements 

MVP Feature Set 

In Scope: 

Google OAuth authentication 

In-app notifications only (no SMS) 

League, season, game structure 

Question creation with AI assistance 

Multiple choice and free text questions 

Betting and scoring mechanics 

All described UIs and dashboards 

Shareable links 

Hall of Fame and season awards 

Commissioner tools 

Out of Scope (Future Versions): 

SMS notifications via Twilio 

Playoffs and championships 

Player dispute resolution system (petitioning Commissioner for grade review) 

Social features (trash talk, comments, online status) 

Video/audio questions 

Team competitions 

Platform 

Web-based application 

Mobile-first responsive design (optimized for phone screens) 

Desktop accessible but secondary priority 

Progressive Web App (PWA) for app-like mobile experience 

Data Storage 

User accounts and profiles 

League configurations and settings 

Game state and history 

Question bank (per player, per league) 

All historical statistics for Hall of Fame 

Shareable link tokens 

Notifications 

In-app notification system 

Trigger points:  

5pm: "You're Up!" (At Bat) 

7am: "Category revealed - time to bet!" 

2 hours before deadline: Reminder if not answered 

Round close: "Results are in!" 

Season end: "Awards announced!" 

Badge counters for pending actions 

AI Integration 

Question workshop chat interface 

Question format suggestions 

Multiple choice option generation 

Free text fuzzy matching and grading 

League name suggestions 

Must be fast enough for real-time chat experience 

 

User Flows 

New User Journey 

Land on homepage / invitation link 

Click "Sign up with Google" 

Google OAuth flow 

Complete profile (nickname, phone, timezone, avatar) 

Accept privacy disclaimer 

If from invitation: Automatically join league → League View 

If new user: Options → "Create League" or "Join League with code" 

Create League Flow 

Choose "Single Game" or "League with Seasons" 

Enter league name (AI suggestions appear) 

Configure settings (or accept defaults) 

Invite players (generate shareable link, send via any channel) 

League lobby appears showing joined players 

Commissioner clicks "Start Season" (or wait for auto-start after minimum players) 

Daily Player Flow (Non-At-Bat) 

Wake up to in-app notification (7am) 

Open app → see category for today's question 

Review category, consider bet 

Place bet (use slider or "All In") 

Immediately see question after bet locked 

Answer question (multiple choice or free text) 

Submit answer 

View confirmation and current Round Status Dashboard 

Check back after 10am for results and updated leaderboard 

Daily At-Bat Player Flow 

Receive "You're Up!" notification (5pm their time) 

Open question submission interface 

Either:  

Use AI chat to workshop new question 

Load saved draft 

Select banked question ("Use on next round") 

Replay past question from history 

Select category 

Choose answer format (multiple choice / free text) 

Enter question and answer details 

Submit question (or save draft for later) 

Next morning (7am): Category revealed to all players 

Place bet and answer like other players 

After round closes: Validate AI grades if free text (if time permits) 

Commissioner Managing Game Flow 

Access Commissioner Tools from league view 

Monitor active game progress 

View Round Status Dashboard 

If needed:  

Skip player who missed deadline 

Override AI grade 

Remove inactive player 

Between seasons:  

Review season standings and awards 

Adjust settings if desired 

Start next season (immediately or let auto-start) 

 

Design Principles 

Sports Metaphors Throughout 

Use sports terminology consistently in all UI copy 

Boxing round cards and timers for round progression 

Baseball batting order language (At Bat, On Deck, In The Hole) 

F1 scoring system for placements 

Award ceremonies like professional sports 

Hall of Fame for legacy tracking 

Stat tracking similar to baseball cards / sports analytics 

Competitive & Engaging 

Real-time leaderboards create urgency 

Point betting adds risk/reward tension 

Daily cadence builds habit and anticipation 

Awards and Hall of Fame provide long-term goals 

Shareable links encourage social competition 

Mobile-First 

All interfaces optimized for phone screens first 

Quick actions (All In button, single-tap answers) 

Minimal scrolling required 

Large touch targets 

Fast loading times 

Clear Communication 

Always show current state (round #, time remaining, your turn status) 

Proactive notifications before deadlines 

Visual indicators for all player statuses 

Confirm destructive actions (bets, Commissioner overrides) 

Celebrate wins, soften losses with statistics 

 

Success Metrics 

Engagement 

Daily active users (DAU) per league 

Question submission rate (% of At Bat turns completed) 

Bet/answer completion rate 

Average time to answer after category reveal 

Retention rate season-over-season 

Quality 

AI grading accuracy (% of grades validated by question creators) 

Question replay rate (indicates quality of past questions) 

Average bet size (indicates confidence in questions) 

Commissioner tool usage (indicates issues needing intervention) 

Growth 

New league creation rate 

Average league size 

Invitation link conversion rate 

Players in multiple leagues (cross-engagement) 

 

Future Considerations (Post-MVP) 

Features 

SMS notifications via Twilio 

Playoffs and championship structure 

Player dispute resolution (petition Commissioner for grade review) 

Social features (comments, reactions, trash talk) 

Team-based competitions 

Video/audio question formats 

Integration with trivia question databases 

Private betting (hide bets until round close) 

Enhancements 

Advanced AI question difficulty balancing 

Automated category recommendations based on player strength/weakness 

Predictive betting suggestions 

Mobile native apps (iOS/Android) 

Spectator mode for non-players 

Tournament bracket system for season playoffs 

Merchandise/prizes for top performers 

 

Edge Cases & Error Handling 

Player Scenarios 

Player joins mid-season: Enters next game with full points, no historical stats for current season 

Player removed mid-game: Game continues, their questions remain but they cannot answer 

All players at 0 points: Game ends immediately, placements by last positive point total 

Tie in final standings: Tiebreaker rules applied recursively 

Technical Scenarios 

Question submitted after first bet placed: Edit locked, question cannot change 

AI grading fails: Question creator must manually grade (cannot remain pending) 

Commissioner abandons league: Cannot delete account until Commissioner transferred 

Player misses timezone: Deadline based on league timezone, not player timezone 

Shareable link used by existing player: Recognizes account, shows "Already in league" 

Network/Performance 

Notification not delivered: Player can check in-app status anytime 

Slow AI response in question workshop: Loading state with timeout (30s), fallback to manual entry 

Concurrent bets at deadline: First-come-first-served timestamp 

Server downtime during round close: Extend deadline automatically, notify all players 

 

Implementation Notes for Claude Code 

Priority 1 (Core Gameplay) 

Authentication system (Google OAuth) 

League/Season/Game data models and relationships 

Question submission with AI chat interface 

Betting and answer submission flow 

Automatic grading (multiple choice) and AI grading (free text) 

F1 scoring system with Fastest Lap 

Game and season leaderboards 

Basic notification system (in-app only) 

Priority 2 (Management & History) 

Commissioner Tools interface 

Round Status Dashboard 

Question banking and replay system 

Season awards generation 

Hall of Fame statistics 

Shareable links for all entities 

Priority 3 (Polish & Optimization) 

Mobile-responsive design with boxing/sports theming 

AI league name suggestions 

Advanced Hall of Fame stats 

Configurable absentee penalties 

Timezone handling for all notifications 

Error handling and edge cases 

Key Technical Decisions Needed 

Database schema (relational vs NoSQL) 

AI service (OpenAI API, Anthropic API, etc.) 

Notification delivery system (WebSocket, polling, push) 

Image hosting for avatars 

URL shortening for shareable links 

Real-time updates mechanism (WebSocket vs polling) 

Testing Focus Areas 

Concurrent bet submissions at deadline 

Timezone conversion accuracy 

AI grading fuzzy matching edge cases 

Commissioner role transfer integrity 

Point calculations with varying league sizes (F1 scaling) 

Question edit locking timing 

Absentee penalty calculations 

 

Glossary of Terms 

At Bat: Player whose turn it is to create today's question 

On Deck: Next player in batting order (tomorrow's question creator) 

In The Hole: Player after On Deck (creates question day after tomorrow) 

Your Shot: Submitting your trivia question 

Batting Order: Rotation sequence for question creation 

Commissioner: League administrator 

League: Group of players competing together 

Season: Series of games (default: 10 games) 

Game: Competition with multiple rounds (default: 5 rounds) 

Round: Complete cycle where each player gets At Bat once 

Fastest Lap: Bonus point for highest bet + correct answer + fastest time 

All In: Bet all available points 

Absentee Penalty: Points lost for missing second consecutive question submission 

Hall of Fame: All-time league statistics and records 

Round Card: Boxing-style visual showing current round and timer 

Graded by AI: Answer graded by AI without question creator validation 

 

End of Specification 

This specification provides a complete blueprint for building Bhutto Wisdom MVP. All core features, user flows, interfaces, and technical requirements are defined. Sports metaphors are integrated throughout to create a competitive and engaging experience. 

Next Steps: 

Review and confirm technical architecture decisions 

Set up development environment 

Implement Priority 1 features (core gameplay) 

Iterate based on testing and user feedback 

Plan Priority 2 and 3 rollout 

Questions? Refer back to this spec or flag areas needing clarification. 

 