#!/usr/bin/env sh
# Builds self-contained server and client folders for the demo machines (CLI-5).
# They bring their own .NET runtime, so a demo machine needs no SDK and no Node.
#
# Usage (from anywhere):  sh scripts/publish.sh                   # every demo OS
#                         sh scripts/publish.sh osx-arm64         # just one
# Output: publish/<rid>/server/ and publish/<rid>/client/
set -e

root="$(cd "$(dirname "$0")/.." && pwd)"
[ $# -gt 0 ] || set -- win-x64 osx-arm64 linux-x64

if [ ! -f "$root/web/dist/index.html" ]; then
  echo "warning: web/dist is missing, so the client will only show 'UI not built'. Run 'npm ci' and 'npm run build' in web/ first." >&2
fi

for rid in "$@"; do
  for app in Server Client; do
    out="$root/publish/$rid/$(echo "$app" | tr '[:upper:]' '[:lower:]')"
    rm -rf "$out"
    dotnet publish "$root/src/Battleship.$app" -c Release -r "$rid" --self-contained true -o "$out"
  done
done

echo "Done. Copy publish/<rid>/ to each demo machine; see 'Run the demo' in README.md."
