# Battleship UI handout

This handout covers the UI work done so far for the Battleship socket programming assignment, the design language every screen follows, and the UI work still needed for the 10 planned extra features. It covers the UI only; server logic, sockets and AI behaviour are out of scope here.

## 1. What was done in this session

| Step | Result |
| --- | --- |
| Read the assignment and score criteria | Mapped every client and server requirement to a screen |
| Picked a visual direction | Playful cartoon style with a naval colour palette |
| Built static UI mockups | Eight plain HTML files, one per screen or state, fixed at 1280×800 for desktop |
| Merged the screens into a PDF | `battleship_ui.pdf`, one page per HTML file |
| Recommended a tech stack | Vite + React + TypeScript client, Node.js + Express + Socket.IO server |
| Wrote a design guide | [Battleship UI design guide](https://claude.ai/code/artifact/5d91dd65-6f4e-4804-a28c-ab76858bc58b) (Claude Doc) |
| Result page change | Added a Home button with a small house icon beside Rematch |
| Home page change | Greeting now reads "Ahoy, captain Alice", and the nickname field was removed |
| Login and sign up | Captain's ID card with Log in / Sign up tabs, a welcome statement for each case, and a loading state |

### The screens

| File | Screen | Requirements it shows |
| --- | --- | --- |
| `0_login.html` | Login (returning player) | "Welcome back, captain!", username, password, Log in button, ID card with the player's photo |
| `0_signup.html` | Sign up (new player) | "Welcome aboard, captain!", username, password, Sign up button, empty photo slot |
| `0_login_loading.html` | Logging in | "Cleared to sail" stamp, pressed "Logging in…" button, "Raising the anchor…" progress bar |
| `1_home.html` | Home and lobby | Greeting with the player's name, automatic server connection, list and count of connected players |
| `2_ship_placement.html` | Ship placement | "Welcome, Alice." message, 8×8 grid, 4 ships of 4 slots, opponent's placement progress |
| `3_gameplay.html` | Match | Names and scores, 10-second turn timer, hit and miss marks, sunk ship, your fleet and the enemy waters |
| `4_result_rematch.html` | Match over | "Win" and "Lost" status, current scores, Rematch button, Home button, winner-starts note |
| `5_server.html` | Server window | Online client count, client list, Reset game and scores button, random first player, rematch rule |

All mockups use the same sample data: Alice, Bob and Chloe are online, Alice wins match 3 with a score of 2 to 1, and Dan is the new player signing up.

> **Rubric note.** The home page no longer has a nickname field, so the login username now counts as the nickname for the "each player enters a nickname" item (0.5 points). Confirm this with your instructor.

## 2. Design language

The game looks like a picture book of the sea: flat bright colours, thick navy outlines on every shape, and solid offset shadows that make each piece look like a sticker or toy. The full rules are in the design guide; this is the short version.

### Five principles

1. **Ink outlines everything.** Every card, button, ship, grid, pill and avatar has a 3px navy border.
2. **Shadows are solid blocks.** Shadows are flat navy offsets with no blur.
3. **Each colour has one job.** Yellow means "you" or "act now", coral means a hit or danger, and green means OK or online.
4. **One loud thing per screen.** Only one hero element per screen, such as the outlined title, the timer, or the Win/Lost word.
5. **The sea is always there.** The sky background and wave band at the bottom appear on every screen.

### Colour tokens

| Token | Hex | Job |
| --- | --- | --- |
| `--ink` | #14325A | Outlines, shadows, text |
| `--sky` | #DDF0FF | Page background |
| `--paper` | #FFFFFF | Cards and inputs |
| `--mist` | #E6F1FB | Quiet surfaces, disabled states |
| `--muted` | #5B7493 | Secondary text |
| `--sea` | #2F8FE0 | Your grid, waves |
| `--sea-deep` | #1E6FBF | Enemy grid |
| `--sun` | #FFC83D | Main buttons, your turn, winner |
| `--coral` | #FF4F5E | Hits, danger, destructive actions |
| `--kelp` | #34C3A0 | Online, success |
| `--lilac`, `--peach` | #A98BFF, #FFA26B | Telling ships and player avatars apart only |

### Type, shape and layout

- **Fonts.** Baloo 2 (weight 800) for titles, buttons and numbers. Nunito (weight 700 to 900) for everything people read. Nothing is lighter than weight 600.
- **Hero headline.** White text, 5px navy stroke, 7px solid shadow, tilted 3 to 4 degrees. Used once per screen.
- **Shape scale.** Cards have a 3px border, 6px shadow and 20px radius. Buttons have a 3px border, 6px shadow pointing straight down, and 16px radius. Pills, avatars and ships are fully rounded.
- **States.** A pressed button drops its shadow and moves down 4px. A disabled button turns pale and its label says what's missing. A dashed outline means "not final yet".
- **Layout.** Fixed 1280×800 frame, with a header, a hero zone, content in a main column plus a side column (about 470px), and a 110px wave band kept clear of content.
- **Voice.** A friendly ship's mate. Use real nicknames, name actions plainly ("Rematch", "Reset game and scores"), and make waiting states say who you're waiting for.

### Reusable components

Button, card, pill with status dot, avatar, player card, board (8×8 grid with labels), ship capsule, hit, miss and aim markers, turn timer dial, banner, and window card. New screens should be built from these first.

## 3. UI still to design for the extra features

The plan has 10 extra features: 8 non-AI features worth 1 point each and 2 AI features worth 2 points each. That adds up to 12, but the extra-features score is capped at 10, so the two AI features plus at least six others are enough for full marks. Extra features also only count once the fundamental implementation is complete.

### Overview

| # | Feature | Type | UI status | New screens | Changes to existing screens |
| --- | --- | --- | --- | --- | --- |
| 1 | AI Sonar & Decoy | AI | Not started | Mode picker | Placement, gameplay, result |
| 2 | AI Ghost Fleet | AI | Not started | Mode picker (shared) | Gameplay, result |
| 3 | Global leaderboard | Non-AI | Not started | Leaderboard | Home navigation |
| 4 | Match history | Non-AI | Not started | Match history | Home navigation, result |
| 5 | Achievements and badges | Non-AI | Not started | Achievements | Result, home, player cards |
| 6 | English and Thai language support | Non-AI | Not started | Settings panel | Every screen |
| 7 | Sound effects and music | Non-AI | Not started | Settings panel (shared) | Header on every screen |
| 8 | Kill-streak notifications | Non-AI | Not started | None | Gameplay |
| 9 | Elo rating system | Non-AI | Not started | None | Lobby, player cards, result, leaderboard |
| 10 | Login page | Non-AI | Mostly done | Login, sign up, loading (done) | Error state still needed |

### Shared work first: navigation and mode picker

Several features need screens the current design has no way to reach. Design these two pieces before the individual features.

- **Home navigation.** Add a row of small white icon buttons in the home page header: Leaderboard, History, Achievements and Settings. Use the same small icon style as the house icon on the result page.
- **Mode picker.** The rubric says a feature that changes the game design can be a separate mode. Add a mode choice on the home page, for example "Classic", "Sonar & Decoy" and "Ghost Fleet", as three `.btn.white` options with the selected one in sun. Show the active mode as a pill in the gameplay header so both players know which rules apply.

### 1. AI Sonar & Decoy (AI feature)

Adds sonar detection and decoy deception to a separate game mode.

- **Ability bar on the gameplay page.** Put a row of ability buttons under the enemy board: "Sonar" and "Decoy", each showing how many uses are left. Using an ability should cost the turn or share the 10-second timer, so the timer dial stays the hero.
- **Sonar result on the enemy grid.** Show the scanned area as expanding rings in `--kelp`, then leave a small numbered marker or tinted area showing what the sonar found. It needs its own legend entry next to hit, miss and sunk.
- **Decoy during placement.** Add a decoy piece to the fleet panel on the placement page, visibly different from real ships (for example a flat outline with no portholes).
- **Decoy reveal.** When a player hits a decoy, show a distinct marker and a short banner such as "That was a decoy!". It must not look like a hit or a miss.
- **AI feedback.** Show a short line explaining what the AI did, for example "Sonar picked up a strong echo near D5". This is where the AI's work becomes visible to the player.

**Open questions to settle before designing:** the size of the sonar area, whether sonar gives an exact count or a vague strength, how many decoys each player gets, and what exactly the AI decides (where sonar points, where decoys go, or how accurate the reading is).

### 2. AI Ghost Fleet (AI feature)

Adds AI-controlled ghost ships to a separate game mode.

- **Ghost ship style.** Ghost ships need a look that can't be confused with real ships, sunk ships, or the dashed "not final" preview. One option is a translucent lilac capsule with a wavy bottom edge and no portholes. Add it to the design guide's token and component tables before using it.
- **Ghost turn.** If the ghost fleet acts between player turns, show it in the banner ("The ghost fleet is moving…") and animate the ghost ships briefly so players see what changed.
- **Ghost markers.** Hitting or missing a ghost ship needs its own marker and legend entry.
- **Result page.** Add a line summarising the ghost fleet's effect on the match, for example how many shots it absorbed.

**Open questions to settle before designing:** whether ghost ships move, whether they can be sunk, whose board they appear on, whether they can attack, and whether players can see them before they're hit.

### 3. Global leaderboard

- **New screen.** A podium for the top 3 players (the winner's block in sun), then a table ranked by Elo rating with columns for rank, avatar and name, Elo, wins, losses and win rate.
- **Your row.** Highlight the current player's row in sun, and pin it to the bottom of the table if they're outside the visible ranks.
- **States.** An empty state for a new server ("No matches played yet") and a loading state.

### 4. Match history

- **New screen.** A list of past matches, newest first. Each row has the opponent's avatar and name, a Win or Lost pill, the final score, the Elo change (+16 or −16), the game mode and the date.
- **Match detail.** Selecting a row could show both final boards using the existing board component, read-only.
- **Result page link.** Add a small "View match history" link under the Rematch and Home buttons.

### 5. Achievements and badges

- **New screen.** A grid of badges. Unlocked badges are full colour with an ink outline; locked badges are `--mist` with a pale border and a short hint about how to earn them.
- **Badge style.** Round sticker-style badges with a simple ink-outline icon, matching the house and anchor icons.
- **Unlock moment.** When a badge unlocks, show it on the result page as a small card that pops in. Don't let it compete with the Win/Lost hero.
- **Showing off.** Optionally show one chosen badge next to the player's name in the lobby and player cards.

### 6. English and Thai language support

- **Language switch.** An "EN | TH" toggle in the settings panel, also reachable from the login page.
- **Thai fonts.** Baloo 2 and Nunito don't include Thai characters. Pair them with Thai fonts of a similar feel, for example Mitr for titles and Sarabun for body text.
- **Line height.** Thai vowel and tone marks sit above and below the line, so raise line height to about 1.3 for Thai text. The hero headline's current 1.05 would clip them.
- **Longer text.** Translated labels can be longer, so check every button and pill in Thai, especially "Rematch requested" and "Reset game and scores".
- **Required words.** Keep "Win", "Lost", "hit", "miss" and "Welcome, Alice." in English where the rubric needs them, or confirm with your instructor that translations count.

### 7. Sound effects and music

- **Header control.** A small speaker icon button in the header of every screen, with a crossed-out state when muted.
- **Settings panel.** Separate sliders or toggles for music and sound effects.
- **Visual pairing.** Every sound must have a visual equivalent (hit marker, banner, timer colour), so the game still works with sound off. This also helps accessibility.
- **Sound list to design for:** hit, miss, sink, your turn, last 3 seconds of the timer, win, lose, rematch accepted.

### 8. Kill-streak notifications

- **Streak callout.** A sticker-style banner that pops in over the enemy board, such as "Double hit!" or "Triple hit!", in sun with an ink outline and a slight tilt like the hero headline.
- **Timing.** Show it briefly and keep it out of the way of the next shot. It must not cover the timer.
- **Opponent view.** The other player should see a calmer version, such as a line in the shot log.

**Open question:** whether a streak counts consecutive hits or consecutive ships sunk.

### 9. Elo rating system

- **Where ratings show.** Next to the name in the lobby list, the player cards in the gameplay header, the server client table, and the leaderboard.
- **Result page.** Show the rating change under each player's score, for example "1,216 (+16)" in `--kelp` and "1,184 (−16)" in `--coral`.
- **New players.** Show "Unranked" or a starting rating until a player has finished a set number of matches.

### 10. Login page

The login is designed as a ticket-style captain's ID card: a navy "Battleship fleet" header, a stub on the left with the player's photo, name, ID number and barcode, and the form on the right past a perforated edge. Three states are done: login (`0_login.html`), sign up (`0_signup.html`) and logging in (`0_login_loading.html`). Still to design:

- **Error state.** A wrong username or password turns the fields' border to `--coral` and shows a short message under the button, such as "That username and password don't match".
- **Sign-up errors.** A taken username or an empty field needs its own message, in the same style.
- **Photo slot.** Decide what fills the photo after sign up: the player's initial on their avatar colour, as on the login card, or a picture they choose.

## 4. Suggested design order

1. Navigation and the settings panel, since several features depend on them.
2. Mode picker, which both AI features need.
3. AI Sonar & Decoy and AI Ghost Fleet, since they carry 4 points and at least one AI feature is required.
4. Elo rating, then the leaderboard and match history, which reuse Elo values.
5. Achievements, kill-streak notifications, sound, and Thai language support.
6. Login and sign-up error states.

Before calling any new screen done, run it through the checklist in the design guide: ink outlines on everything, solid shadows, one loud element, colours matching their jobs, and nothing in the wave band.
