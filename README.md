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

From source, with the SDK: `dotnet run --project src/Battleship.Server`, then
`dotnet run --project src/Battleship.Client` and
`dotnet run --project src/Battleship.Client -- --web-port 3001`.
