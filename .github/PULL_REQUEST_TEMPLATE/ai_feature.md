## Summary

Describe the AI feature and the user-visible behavior.

## AI / data behavior

- What data does the model use?
- What is the model/fallback?
- Does the feature avoid reading the current opponent's hidden board?
- Where is any history stored?

## Architecture impact

- [ ] Frozen TCP protocol unchanged
- [ ] Server remains authoritative
- [ ] Base game still works if the optional AI helper is unavailable

## Test plan

- [ ] `npm run build`
- [ ] `dotnet build`
- [ ] `dotnet test`
- [ ] Tested human-vs-human
- [ ] Tested human-vs-Ghost
- [ ] Tested cold-start behavior
- [ ] Tested personalized/history behavior
- [ ] Tested rematch
- [ ] Tested Sonar/Decoy

## Demo notes

Add the exact steps needed to demonstrate the feature.
