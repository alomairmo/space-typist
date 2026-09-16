import {
  loadLeaderboard,
  loadPlayer,
  loadProgress,
  saveLastRun,
  saveLeaderboard,
  saveProgress,
} from '@/lib/storage'
import type { LeaderboardEntry } from '@/lib/storage'
import { TOTAL_LEVELS, getLevel } from '@/lib/curriculum'
import type { FinalizedRun, GameConfig, RunResult } from '@/game/types'

/**
 * حفظ نتيجة الجولة محلياً:
 * - التقدم والنجوم للمراحل (نجمة: الإنهاء · نجمتان: دقة ≥92٪ · ثلاث: دقة ≥97٪ + سرعة الهدف)
 * - إدخال لوحة الشرف (أفضل 20 لكل طور)
 * - last-run لشريحة القائمة الرئيسية
 * وضع placement لا يُحفظ هنا — تجميعه مسؤولية صفحة /placement.
 */

const MAX_PER_MODE = 20

export function computeStars(config: GameConfig, result: RunResult): number {
  if (config.mode !== 'levels' || !result.victory) return 0
  let stars = 1
  if (result.acc >= 0.92) stars = 2
  if (result.acc >= 0.97 && config.targetWpm != null && result.wpm >= config.targetWpm) stars = 3
  return stars
}

export function finalizeRun(config: GameConfig, result: RunResult): FinalizedRun {
  const player = loadPlayer()
  const now = new Date().toISOString()
  const stars = computeStars(config, result)
  let nextLevelId: number | null = null

  /* ----- تقدم المراحل ----- */
  if (config.mode === 'levels' && config.levelId != null && result.victory) {
    const progress = loadProgress()
    const levels = [...progress.levels]
    const ensure = (id: number) => {
      let entry = levels.find((l) => l.id === id)
      if (!entry) {
        entry = { id, unlocked: false, stars: 0, bestWpm: 0, bestAcc: 0, completedAt: null }
        levels.push(entry)
      }
      return entry
    }
    const cur = ensure(config.levelId)
    cur.unlocked = true
    cur.stars = Math.max(cur.stars, stars)
    cur.bestWpm = Math.max(cur.bestWpm, result.wpm)
    cur.bestAcc = Math.max(cur.bestAcc, result.acc)
    cur.completedAt = cur.completedAt ?? now
    const nextId = config.levelId + 1
    if (nextId <= TOTAL_LEVELS && getLevel(nextId)) {
      const next = ensure(nextId)
      next.unlocked = true
      nextLevelId = nextId
    }
    saveProgress({ ...progress, levels })
  }

  /* ----- لوحة الشرف ----- */
  const lb = loadLeaderboard()
  const entry: LeaderboardEntry = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `run-${Date.now()}`,
    name: player.name,
    mode: config.mode,
    score: result.score,
    wpm: result.wpm,
    acc: result.acc,
    wave: result.wave,
    level: result.levelId,
    date: now,
  }
  const prevBest = Math.max(0, ...lb.entries.filter((e) => e.mode === config.mode).map((e) => e.score))
  const isNewBest = result.score > prevBest
  const modeEntries = [...lb.entries.filter((e) => e.mode === config.mode), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PER_MODE)
  const others = lb.entries.filter((e) => e.mode !== config.mode)
  saveLeaderboard({ entries: [...others, ...modeEntries] })
  const rankIdx = modeEntries.findIndex((e) => e.id === entry.id)
  const rank = rankIdx >= 0 ? rankIdx + 1 : null

  /* ----- آخر جولة ----- */
  saveLastRun({
    mode: config.mode,
    score: result.score,
    wpm: result.wpm,
    acc: result.acc,
    isNewBest,
    date: now,
  })

  return { ...result, stars, isNewBest, rank, nextLevelId, entryId: entry.id }
}
