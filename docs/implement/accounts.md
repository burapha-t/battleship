# Local accounts

## Run

1. In `web`, run `npm run build`.
2. From the repository root, run `dotnet run --project src/Battleship.Server`.
3. In another terminal, run `dotnet run --project src/Battleship.Client`.
4. Open http://localhost:3000, create an account, log in, then Join.

Vite development on :5173 proxies `/api/auth` and `/ws` to the client on :3000.
The server starts the account service on localhost:5080 alongside TCP :5050 and
the dashboard :8080. `ClientConfig.AuthPort` defaults to 5080.

## Files and responsibilities

- `Server/Auth/AuthDbContext.cs`: Identity account model (email + display name) and SQLite context.
- `Server/Auth/AuthServer.cs`: registration, login, current user and logout endpoints.
- `Client/AccountProxy.cs`: forwards account requests/cookies to the server; checks sessions before accepting WebSockets.
- `web/src/auth.ts` and `screens/AuthScreen.tsx`: account requests and login/register forms.
- `web/src/App.tsx`: restores the session, gates the game screen, logs out and rechecks the session on focus/every 30 seconds.

The account database and data-protection keys live in `data/` beside the server
executable. A Debug source build uses
`src/Battleship.Server/bin/Debug/net8.0/data/battleship-accounts.db`.
The startup console prints the exact path. Inspect `AspNetUsers` with a SQLite
viewer. Back up the entire `data/` directory. Rebuilding keeps accounts; deleting
`data/` deletes them. Do not commit or share real account databases or keys.
`EnsureCreated` bootstraps Identity. An idempotent additive schema initializer creates
`AccountScores`, `AccountMatchTotals` and `RecordedMatches` without deleting or altering existing accounts.

## Account behavior

Register with a nickname (1–16 characters), email and password (8–128 characters,
uppercase, lowercase, number and symbol). Duplicate emails are rejected regardless
of case. Registration creates the account and returns to login. Password hashing
and verification use ASP.NET Core Identity. Five failed login attempts lock the
account for five minutes. Email verification and password reset are not implemented.

Login sets an HttpOnly, SameSite=Strict session cookie with an eight-hour ticket
lifetime. Passwords and session tokens are not stored in browser localStorage.
Refresh restores the account, but starts a fresh game connection, as before.
Logout changes the security stamp, invalidating existing cookies for that account,
and asks the game loop to close every active game connection for the account. Other open frontend tabs detect
revocation on focus or within 30 seconds. Browsers share cookies across localhost
ports: use separate browser profiles/private windows for different accounts.

Requests use same-origin JSON with a required custom header. The client rejects
foreign browser origins; :5173 loopback is allowed for Vite development. Auth cookies
are forwarded per request, never shared through a server-side HttpClient cookie jar.

## Scope

This is a local account feature for the existing assignment architecture. The account
API binds only to localhost. A client process on another computer cannot reach it.
With `--lan`, browsers on the same Wi-Fi can use the client running beside the server. Deploying account
authentication across machines requires an explicitly configured HTTPS endpoint and
transport security; do not simply expose this HTTP account service publicly.

The relay obtains a single-use, 30-second game ticket from the authenticated account
service and sends `authenticate` before browser commands. The game host validates
it against the account security stamp and binds the connection to Account ID. A
nickname is a display name, never an account key. One active connection per account
is allowed. A rejected connection must close before retrying.

`AccountScores` stores the current score. One completed win adds one point; losses
and disconnects add none. Scores are restored in `welcome` and displayed in the
game header and server dashboard. `RecordedMatches` deduplicates commits per account by server-run
UUID plus match ID. Both players’ completed-match counts and the winner’s point commit atomically before the match-end event.
Existing accounts remain valid and start at zero unless already saved. Old
session-only points cannot be recovered after being discarded.

The dashboard marks account players `(account)` and exposes Account ID in a tooltip.
RESET persists zero for connected accounts, cancels matches, and leaves offline
accounts unchanged. Reconnecting cannot undo a reset.

Raw TCP clients/bots may join as guests; their scores are not saved. Game rules and
per-match wire messages are unchanged except for the additive `authenticate` verb
and `welcome.score`; see `protocol.md`. There is no public hosting or password recovery. Match history is available from
the lobby when the archive database is enabled; completed matches between two
authenticated accounts are saved. Replay and preview need no account.

## Verification

- `dotnet test`: account validation, password storage, login, lockout, logout/revocation,
  database persistence after restart, proxy behavior, anonymous WebSocket denial,
  authenticated relay, full-match scoring, restart/reconnect, rematch, reset,
  forged/replayed/revoked tickets, duplicate connections and existing game tests.
- `npm test` and `npm run build`: frontend tests and strict TypeScript/bundle checks.
- In a restricted macOS runner, set `DOTNET_USE_POLLING_FILE_WATCHER=1` before
  running .NET commands if native filesystem watching hangs on startup.

Framework reference: https://learn.microsoft.com/aspnet/core/security/authentication/identity


## Matches played

Every completed match increments `MatchesPlayed` for both players, including the
loser. Rematches count when completed. Disconnects, abandoned games and resets
mid-game do not count. Guest statistics last only for their connection; authenticated
players persist in `AccountMatchTotals`. This also counts an account losing to a guest.

The server dashboard has a **Matches played** column. The game header displays the
account count below the nickname; `welcome.matchesPlayed` restores it and the
player entries in `matchStart`/`matchEnd` update it. `/api/auth/score` returns both
`score` and `matchesPlayed` for the current account.

RESET clears points but preserves lifetime matches played. Upgrading a score-only
database preserves its accounts and points and adds tables automatically. Match
counts start at zero because historical losses cannot be reconstructed reliably.
The legacy `RecordedWins` table, if present, is left intact and is no longer written.

## Match archive integration

Identity accounts and scores remain in the account database. The separate
`GameDatabase.DefaultPath()` file stores match history. Its additive `identity_users`
table maps each Identity account ID to a stable archive user ID; nicknames are display
names and never identify accounts. Archive user rows have empty credential fields
and cannot authenticate through Identity. The latest joined nickname is copied into
opponents’ history when each match is saved. Keep both databases when backing up.
A history database failure is logged without blocking login or gameplay.
