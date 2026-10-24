import { describe, expect, it } from 'vitest'
import { buildStrengthProgram, installStrengthProgram } from './strength-program.js'
import { cycleRoutineIds, cycleWeekIndex, sundayOf } from '../../../api/training-cycle.js'
import { effectiveRoutineIds } from './history.js'
import { effectiveRoutineId as serverRoutineId } from '../../../api/queue.js'
import { EXIDX } from './exercises.js'
import { buildPlannedEntry } from './session-start.js'
import { nextPrescription, plannedOf } from './progression.js'
import { weekTally } from './queue.js'
import { buildPlanBundle, parsePlan, mergePlan, planPrintHTML } from './plan-share.js'
import { mergeStates, stampEdits } from './sync-merge.js'

const state = () => ({ unit: 'kg', routines: [], workouts: [], exWeights: {}, week: {}, dayPlan: {}, weekStart: 0 })
const installed = anchor => { const S = state(); installStrengthProgram(S, anchor); return S }
const namesOn = (S, iso) => effectiveRoutineIds(S, iso).map(id => S.routines.find(r => r.id === id).name)

describe('two-week strength calendar', () => {
  it('alternates upper days and keeps five Sunday–Thursday sessions across year and DST boundaries', () => {
    for (const anchor of ['2026-10-25', '2026-12-27', '2027-03-28']) {
      const S = installed(anchor)
      const expected = ['Upper A', 'Lower · quad emphasis', 'Upper B', 'Lower · posterior emphasis', 'Upper A', null, null,
        'Upper B', 'Lower · quad emphasis', 'Upper A', 'Lower · posterior emphasis', 'Upper B', null, null]
      for (let n = 0; n < 28; n++) {
        const iso = new Date(Date.parse(anchor + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
        expect(namesOn(S, iso)).toEqual(expected[n % 14] ? [expected[n % 14]] : [])
        expect(serverRoutineId(S, iso)).toBe(effectiveRoutineIds(S, iso)[0] || null)
      }
      expect(weekTally(S, anchor)).toEqual({ done: 0, planned: 5 })
    }
  })
  it('uses overrides, filters deleted routines, and leaves weekends optional', () => {
    const S = installed('2026-10-25')
    S.dayPlan['2026-10-25'] = 'rest'
    expect(effectiveRoutineIds(S, '2026-10-25')).toEqual([])
    S.dayPlan['2026-10-30'] = S.trainingCycle.accessoryId
    expect(namesOn(S, '2026-10-30')).toEqual(['Optional · accessories'])
    S.routines = S.routines.filter(r => r.name !== 'Upper B')
    expect(effectiveRoutineIds(S, '2026-11-01')).toEqual([])
    expect(namesOn(S, '2026-11-02')).toEqual(['Lower · quad emphasis'])
  })
  it('rejects invalid anchors and does not schedule before activation', () => {
    expect(sundayOf('2026-10-28')).toBe('2026-10-25')
    expect(sundayOf('2026-02-30')).toBe(null)
    expect(cycleWeekIndex({ anchor: '2026-10-26', weeks: [{}, {}] }, '2026-10-27')).toBe(null)
    const S = installed('2026-10-25')
    expect(cycleRoutineIds(S, '2026-10-24')).toEqual([])
    expect(installStrengthProgram(state(), '')).toBe(false)
  })
  it('activates once, preserves history and the previous week, and never overwrites an active workout', () => {
    const S = state()
    const history = { id: 'old', d: '2025-04-01', entries: [] }
    S.workouts.push(history); S.week = { 5: ['old-routine'] }
    S.routines.push({ id: 'old-routine', name: 'Old', ex: [] })
    expect(installStrengthProgram(S, '2026-10-25')).toBe(true)
    expect(S.workouts).toEqual([history]); expect(S.week).toEqual({ 5: ['old-routine'] })
    expect(S.routines).toHaveLength(6)
    expect(installStrengthProgram(S, '2026-10-25')).toBe(false)
    expect(installStrengthProgram({ ...state(), active: { id: 'running' } }, '2026-10-25')).toBe(false)
  })
  it('syncs the calendar independently of a newer unrelated setting', () => {
    const base = state(), phone = structuredClone(base)
    installStrengthProgram(phone, '2026-10-25')
    stampEdits(base, phone, 100); phone._ts = 100
    const desktop = { ...base, sound: false, _ts: 200 }
    stampEdits(base, desktop, 200)
    const merged = mergeStates(phone, desktop)
    expect(merged.trainingCycle).toEqual(phone.trainingCycle)
    expect(namesOn(merged, '2026-11-01')).toEqual(['Upper B'])
  })
  it('exports and imports both weeks with fresh routine ids and no workout history', () => {
    const S = installed('2026-10-25')
    S.workouts.push({ id: 'private-history', d: '2026-01-01', entries: [] })
    const bundle = buildPlanBundle(S, 'Strength draft')
    expect(JSON.stringify(bundle)).not.toContain('private-history')
    const target = state()
    mergePlan(target, parsePlan(JSON.stringify(bundle)), { schedule: true })
    expect(namesOn(target, '2026-10-25')).toEqual(['Upper A'])
    expect(namesOn(target, '2026-11-01')).toEqual(['Upper B'])
    expect(target.routines[0].id).not.toBe(S.routines[0].id)
    expect(target.routines[0].ex[1].weightedAfterTop).toBe(true)
    expect(target.routines[0].ex[0].freshBaseline).toBe(true)
    const html = planPrintHTML(S)
    expect(html).toContain('Week A'); expect(html).toContain('Week B')
    expect(target.workouts).toEqual([])
  })
})

describe('prescriptions and a fresh baseline', () => {
  it('uses real catalogue movements, excludes unwanted exercises, and contains no starting loads or history', () => {
    const plan = buildStrengthProgram('2026-10-25')
    for (const r of plan.routines) for (const e of r.ex) {
      expect(EXIDX[e.id]).toBeTruthy()
      expect(EXIDX[e.id].n).not.toMatch(/leg press|face pull|overhead.*triceps|triceps.*overhead/i)
      expect(e.weight).toBeUndefined()
      expect(e.restSec).toBeGreaterThanOrEqual(60)
      expect(e.reps).toBeGreaterThan(e.repsMin)
    }
    expect(plan.workouts).toBeUndefined()
  })
  it('ignores old cross-routine loads for session one, then progresses actual new sessions', () => {
    const S = installed('2026-10-25'), routine = S.routines[0], cfg = routine.ex[0]
    S.exWeights[cfg.id] = { w: 90, r: 8 }
    S.workouts = [{ id: 'historical', d: '2025-04-01', routineId: 'old', entries: [{ id: cfg.id, target: { sets: 3, reps: 8 }, sets: Array.from({ length: 3 }, () => ({ w: 90, r: 8, done: true })) }] }]
    const first = buildPlannedEntry(S, cfg, routine)
    expect(first.sets.every(s => !s.w)).toBe(true)
    S.workouts.push({ d: '2026-10-25', routineId: routine.id, entries: [{ id: cfg.id, target: { ...cfg, weight: 30 }, planned: plannedOf(cfg), sets: Array.from({ length: 3 }, () => ({ w: 30, r: 8, done: true })) }] })
    const next = buildPlannedEntry(S, cfg, routine)
    expect(next.plan.weight).toBe(32.5)
    expect(S.workouts[0].entries[0].sets[0].w).toBe(90)
  })
  it('only adds belt weight after every prescribed set reaches the top', () => {
    const cfg = buildStrengthProgram('2026-10-25').routines[0].ex.find(e => e.id === '0652')
    const logged = rows => ({ unit: 'kg', workouts: [{ d: '2026-10-25', entries: [{ id: cfg.id, target: cfg,
      sets: rows.map(r => ({ w: 0, r: r ?? 0, done: r != null })) }] }] })
    expect(nextPrescription(logged([8, 8, 8]), cfg)).toMatchObject({ weight: 2.5, reps: 5, kind: 'up' })
    for (const rows of [[8, 8, 7], [8, 8], [8, 8, null]]) expect(nextPrescription(logged(rows), cfg).weight).toBe(0)
    const weighted = logged([8, 8, 8]); weighted.workouts[0].entries[0].sets.forEach(s => { s.w = 2.5 })
    expect(nextPrescription(weighted, cfg)).toMatchObject({ weight: 5, reps: 5 })
  })
})
