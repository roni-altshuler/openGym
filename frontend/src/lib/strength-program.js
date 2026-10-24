import { uid } from './format.js'
import { sundayOf } from '../../../api/training-cycle.js'

const lift = (id, sets, low, high, restSec, extra = {}) => ({
  id, sets, repsMin: low, reps: high, restSec, prog: 'double', inc: 2.5, freshBaseline: true,
  note: 'Choose a controlled working load today. Log actual reps; leave about 1–2 reps in reserve.',
  ...extra,
})
const bw = (id, sets, low, high) => lift(id, sets, low, high, 150, {
  bodyweight: true, weightedAfterTop: true,
  note: 'Start at bodyweight (0 kg added). Build clean reps across every set before adding the smallest belt load. Log added kg only.',
})

// This is a draft prescription, not a training log. No historical loads or completed sessions.
export function buildStrengthProgram(anchor) {
  const routines = [
    { key: 'upper-a', name: 'Upper A', emoji: 'barbell', ex: [
      lift('0025', 3, 6, 8, 180), bw('0652', 3, 5, 8),
      lift('0861', 3, 8, 12, 120), lift('2330', 2, 10, 12, 120, { subs: ['1047', '5123'], note: 'Overhand pulldown. Close-grip and reverse-grip alternatives are saved in this slot.' }),
      lift('0334', 2, 12, 20, 75, { inc: 1 }),
      lift('0200', 2, 10, 15, 75), lift('0592', 2, 10, 15, 75),
    ] },
    { key: 'quad', name: 'Lower · quad emphasis', emoji: 'legs', ex: [
      lift('0043', 3, 6, 8, 180),
      lift('0410', 2, 16, 24, 120, { side: true, note: '8–12 reps per side (16–24 total). Keep the movement controlled.' }),
      lift('0585', 3, 10, 15, 90), lift('0599', 3, 10, 15, 90),
      lift('0605', 3, 10, 15, 75),
    ] },
    { key: 'upper-b', name: 'Upper B', emoji: 'pullup', ex: [
      lift('0314', 3, 8, 12, 150), bw('0814', 2, 6, 10),
      lift('7583', 3, 8, 12, 120, { subs: ['1047', '5123'] }), lift('1351', 3, 8, 12, 120),
      lift('0334', 2, 12, 20, 75, { inc: 1 }),
      lift('0602', 2, 12, 20, 75), lift('0313', 2, 10, 15, 75),
    ] },
    { key: 'posterior', name: 'Lower · posterior emphasis', emoji: 'legs', ex: [
      lift('0085', 3, 6, 10, 180), lift('0599', 3, 8, 12, 90),
      lift('2146', 2, 10, 15, 120),
      lift('0585', 2, 12, 15, 90), lift('0605', 3, 10, 15, 75),
    ] },
    { key: 'accessories', name: 'Optional · accessories', emoji: 'barbell', prog: 'off', ex: [
      lift('0334', 2, 12, 20, 60, { prog: 'off', inc: 1 }),
      lift('0313', 2, 10, 15, 60, { prog: 'off' }),
      lift('0200', 2, 10, 15, 60, { prog: 'off' }),
    ] },
  ].map(({ key, ...r }) => ({ ...r, id: uid(), key, prog: r.prog || 'double' }))
  const byKey = Object.fromEntries(routines.map(r => [r.key, r.id]))
  const schedule = keys => Object.fromEntries(keys.map((key, day) => [day, [byKey[key]]]))
  return { routines: routines.map(({ key, ...r }) => r), trainingCycle: {
    kind: 'strength-hypertrophy-v1', anchor: sundayOf(anchor), accessoryId: byKey.accessories,
    weeks: [schedule(['upper-a', 'quad', 'upper-b', 'posterior', 'upper-a']),
      schedule(['upper-b', 'quad', 'upper-a', 'posterior', 'upper-b'])],
  } }
}

// Explicit activation: preserve history, other routines, per-date changes and load records.
export function installStrengthProgram(S, anchor) {
  if (S.trainingCycle || S.active || (S.unit && S.unit !== 'kg')) return false
  const plan = buildStrengthProgram(anchor)
  if (!plan.trainingCycle.anchor) return false
  S.routines.push(...plan.routines)
  S.trainingCycle = plan.trainingCycle
  S.weekStart = 0
  S.scheduleMode = 'week'
  S.queue = null
  return true
}
