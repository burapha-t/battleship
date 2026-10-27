import { BADGES, GROUPS, groupProgress } from '../rules/badges'
import type { BadgeGroup } from '../rules/badges'
import { Medal } from '../components/Medal'
import { ScreenHead } from '../components/ScreenHead'
import type { AchievementsView } from '../protocol'
import { useSettings } from '../settings/useSettings'
import { badgeLabel, badgesText, earnedText, nextText, statText } from '../i18n/badgesText'
import type { Language } from '../i18n/historyText'
import './BadgesScreen.css'

type Props = {
  /** Null while loading. */
  achievements: AchievementsView | null
  failed: boolean
  onBack: () => void
  onRetry: () => void
}

/** The three badge groups (#41): my stat, progress to the next badge, then all five medals. */
export function BadgesScreen({ achievements, failed, onBack, onRetry }: Props) {
  const { language } = useSettings()
  const t = badgesText(language)

  return (
    <main className="badges">
      <ScreenHead title={t('title')} subtitle={t('subtitle')} home={t('home')} onHome={onBack} />

      {achievements === null ? (
        <section className="card badges-note" role={failed ? 'alert' : 'status'}>
          <p>{failed ? t('failed') : t('loading')}</p>
          {failed && <button type="button" className="btn small" onClick={onRetry}>{t('retry')}</button>}
        </section>
      ) : (
        <>
          {achievements.badges.length === 0 && <p className="badges-empty">{t('empty')}</p>}
          {GROUPS.map((group) => (
            <Group key={group} group={group} achievements={achievements} language={language} />
          ))}
        </>
      )}
    </main>
  )
}

function Group({ group, achievements, language }: { group: BadgeGroup; achievements: AchievementsView; language: Language }) {
  const t = badgesText(language)
  const progress = groupProgress(group, achievements)
  const owned = new Set(achievements.badges.map((b) => b.code))
  const id = `badges-${group}`

  return (
    <section className={`card badge-group ${group}`} aria-labelledby={id}>
      <div className="badge-group-head">
        <div>
          <h2 id={id}>{t(group)}</h2>
          <p>{t(`${group}Hint`)}</p>
        </div>
        <span className="badge-count">{earnedText(progress.earned, language)}</span>
      </div>

      <div className="badge-progress">
        <span className="badge-stat">{statText(progress, language)}</span>
        <span className="meter" aria-hidden>
          <i style={{ width: `${progress.fraction * 100}%` }} />
        </span>
        <span className="badge-next">{nextText(progress, language)}</span>
      </div>

      <ol className="badge-row">
        {BADGES.filter((b) => b.group === group).map((badge) => {
          const earned = owned.has(badge.code)
          const label = badgeLabel(badge.code, language)
          return (
            <li key={badge.code} className={earned ? 'earned' : 'locked'}>
              <Medal code={badge.code} earned={earned} />
              <b>{label}</b>
              {!earned && <small>{t('locked')}</small>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
