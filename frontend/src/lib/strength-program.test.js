import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildStrengthProgram, installStrengthProgram, upgradeStrengthProgram, STRENGTH_KIND } from './strength-program.js'
import { effectiveRoutineIds } from './history.js'
import { effectiveRoutineId as serverRoutineId } from '../../../api/queue.js'
import { EXIDX } from './exercises.js'
import { buildPlannedEntry } from './session-start.js'
import { nextPrescription, plannedOf } from './progression.js'
import { queueView, weekTally } from './queue.js'
import { refillAfter, skipRotationSession, saveRotation } from './rotation.js'
import { buildPlanBundle, parsePlan, mergePlan, planPrintHTML } from './plan-share.js'
import { mergeStates, stampEdits } from './sync-merge.js'

const state = () => ({ unit: 'kg', routines: [], workouts: [], exWeights: {}, week: {}, dayPlan: {}, weekStart: 0 })
const installed = () => { const S = state(); installStrengthProgram(S); return S }
const clock = () => { vi.useFakeTimers(); vi.setSystemTime(new Date('2029-04-18T12:00:00Z')) }
afterEach(() => vi.useRealTimers())
const finish = (S, id, day, at) => {
  const w = { id: 'w-' + id, d: day, start: at, routineId: id, name: S.routines.find(r => r.id === id).name, entries: [] }
  S.workouts.push(w)
  refillAfter(S, w, day, at + 1)
  return w
}

describe('permanent personal rotation', () => {
  it('has five distinct sessions, preferred days and no prescribed calendar dates', () => {
    const draft = buildStrengthProgram()
    expect(draft.rotation.sequence).toHaveLength(5)
    expect(new Set(draft.rotation.sequence).size).toBe(5)
    expect(draft.strengthProfile.preferredDays).toEqual([0, 1, 2, 3, 4])
    expect(JSON.stringify(draft)).not.toMatch(/anchor|startsOn|endsOn|swim|Week A|Week B/)
    expect(draft.routines.map(r => r.name)).toContain('Upper C · volume')
    expect(draft.rotation.sequence).not.toContain(draft.strengthProfile.accessoryId)
  })
  it('starts when actually activated, remains next years later and does not reset after missed days', () => {
    clock()
    const S = installed(), [first, second] = S.rotation.sequence
    expect(S.queue.startsOn).toBe('2029-04-18')
    expect(S.scheduleMode).toBe('rotation')
    expect(S.effort).toBe('rir')
    const queue = structuredClone(S.queue)
    for (const day of ['2029-04-20', '2030-01-01', '2034-12-31']) {
      expect(effectiveRoutineIds(S, day, day)).toEqual([first])
      expect(serverRoutineId(S, day)).toBe(first)
    }
    expect(S.queue).toEqual(queue)
    finish(S, first, '2029-06-01', Date.now() + 1000)
    expect(effectiveRoutineIds(S, '2034-12-31', '2034-12-31')).toEqual([second])
  })
  it('refills forever after actual sessions and optional accessories do not advance it', () => {
    clock()
    const S = installed(), sequence = [...S.rotation.sequence]
    const before = structuredClone(S.queue)
    finish(S, S.strengthProfile.accessoryId, '2029-04-18', Date.now() + 1)
    expect(S.queue).toEqual(before)
    sequence.forEach((id, index) => finish(S, id, `2029-04-${19 + index}`, Date.now() + index + 100))
    expect(S.queue.ids).toEqual(sequence)
    expect(S.queue.rotationId).toBe(S.rotation.id)
    expect(queueView(S, '2029-04-24').items.every(i => i.state !== 'done')).toBe(true)
    expect(S.workouts).toHaveLength(6)
  })
  it('skips only one occurrence, preserves real history/tallies and agrees with reminders', () => {
    clock()
    const S = installed(), [first, second] = S.rotation.sequence
    S.dayPlan['2029-04-18'] = first
    expect(skipRotationSession(S, first)).toBe(true)
    expect(S.workouts).toEqual([])
    expect(S.rotation.sequence[0]).toBe(first)
    expect(S.dayPlan['2029-04-18']).toBeUndefined()
    expect(queueView(S, '2029-04-18').items[0].state).toBe('skipped')
    expect(weekTally(S, '2029-04-18')).toEqual({ done: 0, planned: 5 })
    expect(effectiveRoutineIds(S, '2029-04-18')).toEqual([second])
    expect(serverRoutineId(S, '2029-04-18')).toBe(second)
    saveRotation(S, [...S.rotation.sequence].reverse(), 'Reordered')
    expect(S.queue.skippedIds).toContain(first)
    for (const id of queueView(S, '2029-04-18').remaining) skipRotationSession(S, id)
    expect(S.queue.skippedIds).toBeUndefined()
    expect(S.workouts).toEqual([])
    expect(S.rotation.sequence).toHaveLength(5)
  })
  it('never changes active sessions, existing RPE preferences or history during activation', () => {
    const S = state(), history = { id: 'old', d: '2025-04-01', entries: [] }
    S.workouts.push(history); S.effort = 'rpe'
    expect(installStrengthProgram(S)).toBe(true)
    expect(S.workouts).toEqual([history]); expect(S.effort).toBe('rpe')
    expect(installStrengthProgram(S)).toBe(false)
    expect(installStrengthProgram({ ...state(), active: { id: 'running' } })).toBe(false)
  })
  it('migrates the earlier dated draft once without losing ids, user edits, logs or measurements', () => {
    clock()
    const S = state(), draft = buildStrengthProgram()
    S.routines = draft.routines.filter(r => r.name !== 'Upper C · volume')
    const ids = S.routines.slice(0, 4).map(r => r.id)
    S.trainingCycle = { kind: 'strength-hypertrophy-v1', anchor: '2026-10-25', accessoryId: S.routines[4].id, weeks: [{ 0: [ids[0]], 1: [ids[1]], 2: [ids[2]], 3: [ids[3]] }, {}] }
    S.routines[0].name = 'My edited Upper A'
    S.routines[0].ex[0].restSec = 240
    S.workouts = [{ id: 'keep-log', d: '2026-01-01', entries: [] }]
    S.measurements = [{ id: 'keep-measurement', d: '2026-01-01', chest: 100 }]
    S.active = { id: 'in-progress' }
    expect(upgradeStrengthProgram(S)).toBe(false)
    expect(S.active.id).toBe('in-progress')
    S.active = null
    const otherDevice = structuredClone(S)
    // A legacy plan can be imported into a profile that already has the new goal metadata.
    S.strengthProfile = { kind: STRENGTH_KIND }
    const history = structuredClone(S.workouts), measurements = structuredClone(S.measurements)
    expect(upgradeStrengthProgram(S)).toBe(true)
    expect(S.trainingCycle).toBe(null)
    expect(S.strengthProfile.kind).toBe(STRENGTH_KIND)
    expect(S.rotation.sequence.slice(0, 4)).toEqual(ids)
    expect(S.routines[0].name).toBe('My edited Upper A')
    expect(S.routines[0].ex[0].restSec).toBe(240)
    expect(S.workouts).toEqual(history); expect(S.measurements).toEqual(measurements)
    expect(S.queue.startsOn).toBe('2029-04-18')
    upgradeStrengthProgram(otherDevice)
    expect(otherDevice.rotation.id).toBe(S.rotation.id)
    expect(otherDevice.rotation.sequence).toEqual(S.rotation.sequence)
    expect(upgradeStrengthProgram(S)).toBe(false)
  })
  it('activates a new hosted profile only on first use, and never restarts a stopped rotation', () => {
    clock()
    const draft = buildStrengthProgram(), S = { ...state(), ...draft, scheduleMode: 'rotation' }
    S.strengthProfile.pendingStart = true
    expect(S.queue).toBeUndefined()
    expect(upgradeStrengthProgram(S)).toBe(true)
    expect(S.queue.startsOn).toBe('2029-04-18')
    S.queue = null; S.scheduleMode = 'week'
    expect(upgradeStrengthProgram(S)).toBe(false)
    expect(S.queue).toBe(null)
  })
  it('syncs the rotation and shares/prints its definition without history or pass dates', () => {
    clock()
    const base = state(), phone = structuredClone(base)
    installStrengthProgram(phone)
    stampEdits(base, phone, 100); phone._ts = 100
    const merged = mergeStates(phone, { ...base, sound: false, _ts: 200 })
    expect(merged.rotation).toEqual(phone.rotation)
    phone.workouts.push({ id: 'private-history', entries: [] })
    const bundle = buildPlanBundle(phone, 'My split')
    expect(JSON.stringify(bundle)).not.toMatch(/private-history|startsOn|since/)
    const target = state()
    mergePlan(target, parsePlan(JSON.stringify(bundle)), { schedule: true })
    expect(target.rotation.sequence).toHaveLength(5)
    expect(target.rotation.sequence[0]).not.toBe(phone.rotation.sequence[0])
    expect(target.scheduleMode).toBe('rotation'); expect(target.workouts).toEqual([])
    expect(planPrintHTML(phone)).toContain('Ongoing rotation')
    expect(planPrintHTML(phone)).not.toContain('Week A')
  })
})

describe('prescriptions and actual lifting history', () => {
  it('uses preferred real movements, varied pulldowns, individual rests and no starting loads', () => {
    const plan = buildStrengthProgram(), ids = plan.routines.flatMap(r => r.ex.map(e => e.id))
    for (const id of ['0025', '0043', '0032', '0085', '0652', '0814', '2291', '7583', '5123', '1351', '0861', '0576', '0596', '2290']) expect(ids).toContain(id)
    for (const r of plan.routines) for (const e of r.ex) {
      expect(EXIDX[e.id]).toBeTruthy()
      expect(EXIDX[e.id].n).not.toMatch(/leg press|face pull|overhead.*triceps|triceps.*overhead/i)
      expect(e.weight).toBeUndefined()
      expect(e.restSec).toBeGreaterThanOrEqual(60)
      expect(e.reps).toBeGreaterThan(e.repsMin)
    }
  })
  it('ignores old benchmark loads, then progresses from actual new sessions', () => {
    const S = installed(), routine = S.routines[0], cfg = routine.ex[0]
    S.exWeights[cfg.id] = { w: 90, r: 8 }
    S.workouts = [{ id: 'historical', d: '2025-04-01', routineId: 'old', entries: [{ id: cfg.id, target: { sets: 3, reps: 8 }, sets: Array.from({ length: 3 }, () => ({ w: 90, r: 8, done: true })) }] }]
    expect(buildPlannedEntry(S, cfg, routine).sets.every(s => !s.w)).toBe(true)
    S.workouts.push({ d: '2029-04-18', routineId: routine.id, entries: [{ id: cfg.id, target: { ...cfg, weight: 30 }, planned: plannedOf(cfg), sets: Array.from({ length: 3 }, () => ({ w: 30, r: 8, done: true })) }] })
    expect(buildPlannedEntry(S, cfg, routine).plan.weight).toBe(32.5)
    expect(S.workouts[0].entries[0].sets[0].w).toBe(90)
  })
  it('only adds belt weight after every prescribed pull-up set reaches the top', () => {
    const cfg = buildStrengthProgram().routines[0].ex.find(e => e.id === '0652')
    const logged = rows => ({ unit: 'kg', workouts: [{ d: '2029-04-18', entries: [{ id: cfg.id, target: cfg, sets: rows.map(r => ({ w: 0, r: r ?? 0, done: r != null })) }] }] })
    expect(nextPrescription(logged([8, 8, 8]), cfg)).toMatchObject({ weight: 2.5, reps: 5, kind: 'up' })
    for (const rows of [[8, 8, 7], [8, 8], [8, 8, null]]) expect(nextPrescription(logged(rows), cfg).weight).toBe(0)
  })
})
