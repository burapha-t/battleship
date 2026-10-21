# English and Thai text (#38)

Settings is the only place to choose English or ไทย. Its existing browser setting
is the source of truth. Language changes redraw text without remounting screens,
resetting drafts, restarting timers, or changing game state/protocol messages.

## Add text to a screen

1. Put both complete phrases in `web/src/translations.ts`, under the feature's
   scope. Every entry is `[English, Thai]`; never leave one language empty.
2. Import `useTranslation` and add one line in the component:

   ```tsx
   const { t } = useTranslation('game')
   return <button>{t('startGame')}</button>
   ```

3. For changing values, use named placeholders in the whole phrase:

   ```tsx
   t('welcome', { name: myName })
   ```

   Both translations must use the same placeholder names. Each language controls
   its own word order. Do not build sentences from translated fragments.
4. Translate placeholders, tooltips, aria-labels, loading/empty/error states and
   notifications too. Keep nicknames, badge/avatar codes, board coordinates and
   protocol values unchanged. Battleship is the product name; English/ไทย are
   the language choices' native names.
5. Keep pure rules and the reducer language-independent. Display server errors
   through `localizeError` (error code first), existing placement reasons through
   `localizePlacement`, and stored notices/version errors through
   `localizeMessage`. Add any new public error code or reason to the catalogue.
6. Run `npm test`, `npm run build`, `npm run lint`, then switch languages while
   the screen is open and refresh. Check Thai labels at narrow widths.

`Language` is defined in `settings.ts`. History's re-export remains for compatibility;
do not define another Language type. `percent` and `localTime` in `historyText.ts`
format numbers/dates. No new translation package, router or provider is needed.

## PR #65: prepared, not included in this branch

The catalogue contains `profile`, `badges`, `profileValues` and `badgeValues`
from PR #65 at `1997f5d`. That PR's server/UI code is not merged into feat/38.
After #65 merges, connect it as follows (keep feature logic and layouts intact):

- ProfileScreen: replace its `useSettings` + `profileText(language)` lines with
  `const { language, t } = useTranslation('profile')`.
- BadgesScreen and UnlockCard: use `useTranslation('badges')`.
- Keep public helper APIs in profileText.ts/badgesText.ts if the screens use them;
  replace their TEXT tables with `translator(language, 'profile' | 'badges')`.
- Route rankLine/chosenText/bestText through `profileValues`, and
  badgeLabel/earnedText/statText/nextText through `badgeValues`. The table already
  includes every tier-independent template; pass numbers as `count` and formatted
  accuracy as `accuracy`. Use game.winsOne/winsMany for singular/plural wins.
- Header's icon labels use game.history/leaderboard/profile/badges/settings.
  PlayerChip uses game.you/opponent/score/versus, as it does on main here.
- Preserve the shared adapters in historyText.ts and leaderboardText.ts when
  resolving any merge overlap. Do not restore their old duplicate dictionaries.
- Recheck all new PR screens in English and Thai after integration; prepared
  phrases do not make absent components run automatically.

Future phrases need both language entries. An existing phrase need not be
translated again unless its wording changes. The C# dashboard/console is a
separate server application; this setting controls the player's React game UI.
