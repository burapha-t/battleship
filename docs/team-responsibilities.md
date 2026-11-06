# Team responsibilities

Who did what in this project. Taken from the GitHub issues, merged pull requests and commit history.

| Member | GitHub | Role |
| --- | --- | --- |
| P (Burapha) | burapha-t, G1thubGrinder | Tech lead, project setup, login |
| Guy (Khammanat) | khammanat-limpanapongthep | Server, core rules, database, match history, code review, presentation |
| Peace (Pirawich) | Paceyfishy | Server and web: protocol, leaderboard, badges, profile |
| Gam | siprapap | Core game, AI Ghost Fleet bot, login server |
| Niner (Watewasin) | watewasin | Frontend: game UI, sound, kill streak |
| Fern (Lalitpat) | fernlalit | Frontend: Thai/English, settings, UI design |
| Prae (Natcha) | praenatchaa | AI: Sonar, ghost fleet research |

## P (Burapha): burapha-t, G1thubGrinder

- Set up the project: C# solution, test project, CI (GitHub Actions), code owners and the match transcript test (#2).
- Wrote the team docs: AGENT.md, naming convention, setup guide, user flow, PR template.
- Set up the web project with Vite + React + TypeScript and the protocol types (UIF-1 #16, UIF-2 #17).
- Joined the first full version of the game together (PR #20).
- Login page, server and web (#35, LOGIN-1 #46, LOGIN-2 #47, PR #69).
- AI Sonar help button and fixes to the sonar rules.
- Many UI fixes: match history header (PR #67), screen centering and guest screen (PR #74), settings, leaderboard wording, Thai fixes.
- Reviewed and merged most pull requests.

## Guy (Khammanat): khammanat-limpanapongthep

- Placement rules: check a fleet layout is valid (CORE-3 #12, PR #18).
- Random valid fleet placement (CORE-4 #13, PR #19).
- Client: let other devices on the same Wi-Fi join with `--lan` (CLI-1 #22, PR #23).
- Server dashboard status key (SRV-1 #24, PR #30) and activity log that says how the first player was chosen (SRV-3, PR #76).
- Back to lobby / Home button after a match (SRV-2 #25, PR #31).
- Pause on the final board before the Win/Lost screen (PR #29).
- SQLite database for accounts and match history (DB-1 #32, PR #33).
- Match history: save every finished match, send it to the player, and the history screen (#36, DB-2 #48, HIST-1 #49, HIST-2 #50).
- Wrote the PR template and the database guide.
- Reviewed the team's code and pull requests.
- Made and gave the final presentation.

## Peace (Pirawich): Paceyfishy

- Nickname rules: trim, length limit, duplicates (CORE-5 #14).
- Protocol messages: read and write all message types (CORE-6 #15).
- Global leaderboard, server and web (#34, LB-1 #44, LB-2 #45, PR #63).
- Achievements / badges, server and web (#41, ACH-1 #51, ACH-2 #52).
- Profile screen and profile picture (#42, PR #65).
- Fixed the profile picture not showing on Home, Matching and Gameplay (#77, PR #78).

## Gam: siprapap

- Ship: track hits and sunk state (CORE-1 #10).
- Board: fire a shot, report hit / miss / sunk (CORE-2 #11).
- First login and player record work on the server (#35, LOGIN-1 #46).
- AI Ghost Fleet bot: rule-based targeting with fleet probability, then a trained ML model (#72, PR #71).
- Cancel search and quit buttons for bot mode.
- Reorganized the web source folders (#68, PR #70).

## Niner (Watewasin): watewasin

- Web UI foundation and gameplay screens (#7, #8).
- First login / sign-up screen and Home button design (PR #26).
- Background music and sound effects (PR #53).
- Kill streak notification with streak sound (#40, PR #64).

## Fern (Lalitpat): fernlalit

- UI designs for the extra features (profile, Thai/English).
- In-game language, English and Thai (#38, PR #66).
- Settings menu saved in the browser (#43, PR #61).
- Sound effect and music planning (#39) and leaderboard screen (with Peace, #45).

## Prae (Natcha): praenatchaa

- AI implementation (#9, with Gam).
- AI Sonar suggestions (#73, PR #75).
- First ghost fleet, sonar and deception work (PR #21).
