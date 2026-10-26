# battleship

## Run the demo

Demo machines need nothing installed: the published folders carry their own .NET
runtime and the built web UI.

### 1. Build the folders (once, on a machine with the .NET 8 SDK and Node)

1. Build the UI: in `web/`, run `npm ci`, then `npm run build`.
2. From the repo root, run
   `powershell -ExecutionPolicy Bypass -File scripts/publish.ps1` (Windows) or
   `sh scripts/publish.sh` (macOS / Linux). Add a target to build only one OS,
   e.g. `... scripts/publish.ps1 -Rids win-x64` or `sh scripts/publish.sh osx-arm64`.
3. You get `publish/<os>/server/` and `publish/<os>/client/` for each OS:
   `win-x64` (Windows), `osx-arm64` (Apple-silicon Mac), `linux-x64` (Linux).
   Copy the folder that matches each demo machine (USB stick or zip).

### 2. Computer A: start the server

1. In `publish/<os>/server/`, run `Battleship.Server` (`Battleship.Server.exe` on Windows).
2. When Windows or macOS asks whether to allow incoming connections, allow it.
   Without that, other computers can't connect.
3. The console prints this computer's LAN addresses, e.g. `192.168.1.20`. Write one down.
4. The dashboard (players online, current match, RESET button) is at
   <http://localhost:8080>, on this computer only.

### 3. Every player computer: start the client

1. Open `publish/<os>/client/client.json` in a text editor and set `"serverHost"` to the
   address from step 2.3. On Computer A itself, keep `127.0.0.1`. Leave `serverPort`
   at `5050` and `webPort` at `3000`.
2. Run `Battleship.Client` (`Battleship.Client.exe` on Windows). The game opens in the
   default browser by itself: nobody types an IP address or a port.

`client.json` is set once by the team before the demo; players never see it.

### macOS notes

- If a copied file lost its execute permission (zips do that), run
  `chmod +x Battleship.Server Battleship.Client` in its folder.
- The apps aren't signed, so macOS blocks the first run. Either right-click the
  file → **Open** → **Open**, or run `xattr -dr com.apple.quarantine publish/osx-arm64`.

### Two clients on one computer (testing)

The second client needs its own web port: `Battleship.Client --web-port 3001`.
`--no-browser` skips opening the browser.

### Playing from another device

1. Start the client with `--lan`: `Battleship.Client --lan`.
2. Find the link the client prints, e.g. `http://192.168.1.20:3000`. The number
   after the colon is the port: `3000` by default, or whatever `--web-port` or
   `"webPort"` in `client.json` sets.
3. On the other device, connect to the same Wi-Fi.
4. Open that link in its browser.

This is for casual games only. For the graded demo, the second computer runs
`Battleship.Client` itself (step 3 above), since browser players type the
address by hand.

## Run from source

### 1. Install the tools (once)

Follow [docs/setup.md](docs/setup.md). Run every command below from the repo root.

### 2. Build the UI (first time, and after changing `web/`)

```sh
cd web && npm ci && npm run build && cd ..
```

### 3. Start the server

Open a terminal and run:

```sh
dotnet run --project src/Battleship.Server
```

Leave it open.

### 4. Start your client

Open a second terminal and run:

```sh
dotnet run --project src/Battleship.Client -- --lan
```

The game opens in your browser. The terminal prints a link like
`Other devices on the same Wi-Fi: http://192.168.1.20:3000`.

How to read that link:

- `192.168.1.20` is your computer's address on the Wi-Fi. Yours will be different.
- `3000` is the port. It's `3000` unless you changed it, either with
  `--web-port <n>` or with `"webPort"` in `src/Battleship.Client/client.json`.
- The terminal always prints the right address and port, so just copy the whole link.

Friends only need this link. The server's port (`5050`) is used by the client
behind the scenes, and nobody types it.

### 5. Let friends join

1. Send them the link from step 4.
2. They connect to the same Wi-Fi as you.
3. They open the link in a browser, starting with `http://`.

### 6. Play

1. Each player logs in or signs up, or picks **Play as guest** and enters a nickname.
   Only matches between two logged-in players are saved.
2. Each player clicks **Start game**.
3. The server pairs two waiting players and the match starts.

### 7. Stop

Press Ctrl+C in each terminal.

### Notes

- `dotnet` not found on macOS? Use `~/.dotnet/dotnet` instead.
- Playing against yourself: in a third terminal, run
  `dotnet run --project src/Battleship.Client -- --web-port 3001`, then open
  <http://localhost:3001>.
- A friend can't open the link:
  1. Check they're on the same Wi-Fi, not mobile data or a guest network.
  2. Check they typed `http://`, not `https://`.
  3. Check you clicked Allow when your computer asked about incoming connections.
  4. Still nothing? Some networks (campus, guest Wi-Fi) block this. Use a hotspot instead.
