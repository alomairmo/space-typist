import { useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import Ceremony from '@/pages/results/Ceremony'
import type { RankNeighbors } from '@/pages/results/Ceremony'
import LeaderboardView from '@/pages/results/LeaderboardView'
import ConfettiCanvas from '@/pages/results/ConfettiCanvas'
import type { RunLineStat, RunMode, RunResult } from '@/pages/results/types'
import { MODE_NAMES } from '@/pages/results/types'
import type { LeaderboardEntry } from '@/lib/storage'
import { loadLastRun, loadLeaderboard, loadPlayer, loadProgress, saveLeaderboard } from '@/lib/storage'
import { ARCADE_SENTENCES, getLevel } from '@/lib/curriculum'
import { useSettings } from '@/context/SettingsContext'

const RUN_MODES: RunMode[] = ['arcade', 'levels', 'custom', 'placement']

/** أسطر تجريبية عند غياب بيانات الجولة (معاينة من لوحة الشرف/آخر جولة) */
function demoLines(run: RunResult): RunLineStat[] {
  const levelLines = run.mode === 'levels' && run.levelId != null ? getLevel(run.levelId)?.lines : undefined
  const pool = levelLines ?? ARCADE_SENTENCES[0].lines
  return pool.slice(0, 5).map((text, i) => ({
    text,
    wpm: Math.max(5, Math.round(run.wpm * (0.85 + ((i * 37) % 10) / 30))),
    acc: Math.min(100, Math.max(60, Math.round(run.accuracy + ((i * 53) % 7) - 3))),
    errors: (i * 29) % 3,
  }))
}

/** جولة تجريبية من آخر جولة محفوظة (أو قيم افتراضية) — لا تُسجَّل في لوحة الشرف */
function buildDemoRun(): RunResult {
  const last = loadLastRun()
  const mode: RunMode = last && RUN_MODES.includes(last.mode as RunMode) ? (last.mode as RunMode) : 'arcade'
  const run: RunResult = {
    mode,
    victory: true,
    score: last?.score ?? 2450,
    wpm: last?.wpm ?? 38,
    accuracy: last?.acc ?? 96,
    correctChars: 460,
    wrongChars: 18,
    timeTaken: 42,
    levelId: mode === 'levels' ? 7 : undefined,
    wave: mode === 'arcade' ? 7 : undefined,
  }
  run.lines = demoLines(run)
  return run
}

const sortEntries = (a: LeaderboardEntry, b: LeaderboardEntry) => b.score - a.score || b.wpm - a.wpm

interface RunComputation {
  run: RunResult
  isReal: boolean
  entryId: string | null
  rank: number
  neighbors: RankNeighbors
  prevBest: number | null
  isNewBest: boolean
}

/** تسجيل الجولة الحقيقية (أفضل 20 لكل طور) وحساب الترتيب والصفوف المحيطة */
function computeRun(rawRun: RunResult, isReal: boolean): RunComputation {
  const run: RunResult = { ...rawRun, lines: rawRun.lines ?? (isReal ? undefined : demoLines(rawRun)) }
  const board = loadLeaderboard()
  const player = loadPlayer()
  let entryId = run.entryId ?? null

  if (isReal && !entryId) {
    entryId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `run-${Date.now()}`
    const entry: LeaderboardEntry = {
      id: entryId,
      name: player.name,
      mode: run.mode,
      score: Math.round(run.score),
      wpm: Math.round(run.wpm),
      acc: Math.round(run.accuracy),
      wave: run.wave ?? null,
      level: run.levelId ?? null,
      date: new Date().toISOString(),
    }
    const others = board.entries.filter((e) => e.mode !== run.mode)
    const sameMode = [...board.entries.filter((e) => e.mode === run.mode), entry].sort(sortEntries).slice(0, 20)
    saveLeaderboard({ entries: [...others, ...sameMode] })
  }

  const fresh = loadLeaderboard().entries.filter((e) => e.mode === run.mode).sort(sortEntries)
  const idx = entryId ? fresh.findIndex((e) => e.id === entryId) : -1

  const selfEntry: LeaderboardEntry = {
    id: entryId ?? 'demo-self',
    name: player.name,
    mode: run.mode,
    score: Math.round(run.score),
    wpm: Math.round(run.wpm),
    acc: Math.round(run.accuracy),
    wave: run.wave ?? null,
    level: run.levelId ?? null,
    date: new Date().toISOString(),
  }

  let rank: number
  let neighbors: RankNeighbors
  let prevBest: number | null

  if (idx >= 0) {
    rank = idx + 1
    neighbors = { above: fresh[idx - 1], self: fresh[idx], below: fresh[idx + 1] }
    prevBest = fresh.filter((_, i) => i !== idx).reduce<number | null>((m, e) => (m == null || e.score > m ? e.score : m), null)
  } else {
    // ترتيب افتراضي (بيانات تجريبية): أين سيدخل هذا الإدخال؟
    const insertAt = fresh.findIndex((e) => e.score < run.score)
    rank = insertAt === -1 ? fresh.length + 1 : insertAt + 1
    neighbors = {
      above: fresh[rank - 2],
      self: selfEntry,
      below: fresh[rank - 1],
    }
    prevBest = fresh.reduce<number | null>((m, e) => (m == null || e.score > m ? e.score : m), null)
  }

  return {
    run,
    isReal,
    entryId,
    rank,
    neighbors,
    prevBest,
    isNewBest: prevBest != null && run.score > prevBest,
  }
}

/**
 * شاشة النتائج والترتيب (/results) — دوران:
 * 1) مراسم ما بعد الجولة (/results?run=latest مع RunResult في location.state.run)
 * 2) لوحة الشرف الدائمة بتبويبات الأطوار (المعروضة افتراضياً من القائمة الرئيسية)
 */
export default function Results() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { settings } = useSettings()

  const stateRun = (location.state as { run?: RunResult } | null)?.run
  const wantsCeremony = Boolean(stateRun) || searchParams.get('run') === 'latest'
  const [view, setView] = useState<'ceremony' | 'board'>(wantsCeremony ? 'ceremony' : 'board')

  // الحساب مرة واحدة لكل جولة (مفتاح = مرجع الكائن القادم من شاشة اللعب)
  const computation = useMemo(
    () => computeRun(stateRun ?? buildDemoRun(), Boolean(stateRun)),
    [stateRun],
  )
  const { run, entryId, rank, neighbors, prevBest, isNewBest } = computation

  const level = run.mode === 'levels' && run.levelId != null ? getLevel(run.levelId) : undefined
  const targetWpm = level?.targetWpm ?? 20
  const stars =
    run.stars ??
    (run.mode === 'levels' && run.victory
      ? 1 + (run.accuracy >= 92 ? 1 : 0) + (run.accuracy >= 97 && run.wpm >= targetWpm ? 1 : 0)
      : 0)

  // المرحلة التالية: فقط إن وُجدت وصارت مفتوحة
  const nextLevelId = useMemo(() => {
    if (run.mode !== 'levels' || !run.victory || run.levelId == null) return null
    const next = getLevel(run.levelId + 1)
    if (!next) return null
    const nextProgress = loadProgress().levels.find((l) => l.id === next.id)
    if (nextProgress && !nextProgress.unlocked) return null
    return next.id
  }, [run])

  const placementLevelId = run.placementLevelId ?? loadProgress().placementLevelId ?? null

  const contextLine =
    run.mode === 'levels' && level
      ? `المرحلة ${level.id} — ${level.name}`
      : run.mode === 'arcade'
        ? `${MODE_NAMES.arcade}${run.wave != null ? ` — الموجة ${run.wave}` : ''}`
        : MODE_NAMES[run.mode]

  const reduced = settings.reducedMotion

  if (view === 'board') {
    return (
      <LeaderboardView
        highlightId={entryId}
        onBack={wantsCeremony ? () => setView('ceremony') : null}
      />
    )
  }

  return (
    <>
      {!reduced && run.victory && <ConfettiCanvas variant="confetti" />}
      {!reduced && !run.victory && <ConfettiCanvas variant="ember" />}
      <Ceremony
        run={run}
        rank={rank}
        neighbors={neighbors}
        prevBest={prevBest}
        isNewBest={isNewBest}
        stars={stars}
        targetWpm={targetWpm}
        contextLine={contextLine}
        nextLevelId={nextLevelId}
        placementLevelId={placementLevelId}
        onShowBoard={() => setView('board')}
      />
    </>
  )
}
