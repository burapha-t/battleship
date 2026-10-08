# Setup

Every member installs three tools, whatever their lane, before starting their
first ticket:

| Tool | Version | Used for |
|---|---|---|
| .NET SDK | 8.0.x | Core, server, client and their tests |
| Node.js | LTS (v22 or later) | `web/`: the React + TS UI |
| Python | 3.10 or later | `bot/`: the AI client |

You can have newer .NET SDKs installed as well. The 8.0 SDK still has to be there.

## 1. Install

### Windows

```powershell
winget install Microsoft.DotNet.SDK.8
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.13
```

### macOS

```sh
brew install --cask dotnet-sdk@8
brew install python@3.13
```

For Node, run the LTS installer from https://nodejs.org/en/download.

No Homebrew? Use the installers from https://dotnet.microsoft.com/download/dotnet/8.0
and https://www.python.org/downloads/ instead.

### Linux (Ubuntu 22.04 / 24.04)

```sh
sudo apt-get update
sudo apt-get install -y dotnet-sdk-8.0 python3
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```

Ubuntu's own `nodejs` package is too old for Vite, so install Node through nvm.
Open a new terminal, then:

```sh
nvm install --lts
```

On another distro, follow https://learn.microsoft.com/dotnet/core/install/linux
and https://nodejs.org/en/download.

## 2. Verify

Open a **new** terminal, since one that was already open doesn't see the new
PATH. Then run:

```sh
dotnet --list-sdks    # needs a line starting with 8.0.
node -v               # v22 or later
python --version      # 3.10 or later. On macOS / Linux: python3 --version
```

Then build and test the repo with the commands in `AGENT.md` → *Commands*.

## 3. The expected Output

The output in each command in Verify section is similar to this:

```
OS: Windows 11
8.0.425 [C:\Program Files\dotnet\sdk]
v24.19.0
Python 3.13.15
```
