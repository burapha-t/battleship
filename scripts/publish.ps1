# Builds self-contained server and client folders for the demo machines (CLI-5).
# They bring their own .NET runtime, so a demo machine needs no SDK and no Node.
#
# Usage (from anywhere):  scripts/publish.ps1                     # every demo OS
#                         scripts/publish.ps1 -Rids win-x64        # just one
# Output: publish/<rid>/server/ and publish/<rid>/client/
param([string[]]$Rids = @('win-x64', 'osx-arm64', 'linux-x64'))

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path (Join-Path $root 'web/dist/index.html'))) {
    Write-Warning "web/dist is missing, so the client will only show 'UI not built'. Run 'npm ci' and 'npm run build' in web/ first."
}

foreach ($rid in $Rids) {
    foreach ($app in 'Server', 'Client') {
        $out = Join-Path $root "publish/$rid/$($app.ToLower())"
        if (Test-Path $out) { Remove-Item -Recurse -Force $out }
        dotnet publish (Join-Path $root "src/Battleship.$app") -c Release -r $rid --self-contained true -o $out
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

Write-Host "Done. Copy publish/<rid>/ to each demo machine; see 'Run the demo' in README.md."
