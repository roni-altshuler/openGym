import { uid } from './format.js'
import { startPass } from './rotation.js'

export const STRENGTH_KIND = 'strength-hypertrophy-v2'

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
export function buildStrengthProgram() {
  const routines = [
    { key: 'upper-a', name: 'Upper A', emoji: 'barbell', ex: [
      lift('0025', 3, 6, 8, 180), bw('0652', 3, 5, 8),
      lift('0861', 3, 8, 12, 120), lift('2291', 2, 10, 12, 120, { subs: ['1047', '5123'], note: 'Wide overhand grip. Control the stretch and pull in front of the body.' }),
      lift('0334', 2, 12, 20, 75, { inc: 1 }),
      lift('0200', 2, 10, 15, 75), lift('0592', 2, 10, 15, 75),
    ] },
    { key: 'quad', name: 'Lower · quad emphasis', emoji: 'legs', ex: [
      lift('0043', 3, 6, 8, 180),
      lift('2290', 2, 16, 24, 120, { side: true, note: 'Bulgarian split squat: 8–12 reps per side (16–24 total). Keep the movement controlled.' }),
      lift('0585', 3, 10, 15, 90), lift('0599', 3, 10, 15, 90),
      lift('0605', 3, 10, 15, 75),
    ] },
    { key: 'upper-b', name: 'Upper B', emoji: 'pullup', ex: [
      lift('0314', 3, 8, 12, 150), bw('0814', 2, 6, 10),
      lift('7583', 3, 8, 12, 120, { subs: ['1047', '5123'], note: 'Use a close-neutral grip and a controlled full range.' }), lift('1351', 3, 8, 12, 120),
      lift('0405', 2, 8, 12, 120),
      lift('0602', 2, 12, 20, 75), lift('0313', 2, 10, 15, 75),
    ] },
    { key: 'posterior', name: 'Lower · posterior emphasis', emoji: 'legs', ex: [
      lift('0032', 2, 4, 6, 180, { note: 'Conventional deadlift. Leave about 2–3 quality reps in reserve; stop when technique deteriorates.' }),
      lift('0085', 2, 8, 10, 180), lift('0599', 3, 8, 12, 90),
      lift('2146', 2, 10, 15, 120),
      lift('0585', 2, 12, 15, 90), lift('0605', 3, 10, 15, 75),
    ] },
    { key: 'upper-c', name: 'Upper C · volume', emoji: 'barbell', ex: [
      lift('0576', 3, 8, 12, 120), lift('5123', 3, 10, 12, 120),
      lift('0596', 2, 12, 15, 90), lift('0861', 2, 10, 15, 120),
      lift('0334', 2, 12, 20, 75, { inc: 1 }),
      lift('1607', 2, 10, 15, 75), lift('0200', 2, 10, 15, 75),
    ] },
    { key: 'accessories', name: 'Optional · accessories', emoji: 'barbell', prog: 'off', ex: [
      lift('0334', 2, 12, 20, 60, { prog: 'off', inc: 1 }),
      lift('0313', 2, 10, 15, 60, { prog: 'off' }),
      lift('0200', 2, 10, 15, 60, { prog: 'off' }),
    ] },
  ].map(({ key, ...r }) => ({ ...r, id: uid(), key, prog: r.prog || 'double' }))
  const byKey = Object.fromEntries(routines.map(r => [r.key, r.id]))
  const sequence = ['upper-a', 'quad', 'upper-b', 'posterior', 'upper-c'].map(key => byKey[key])
  return { routines: routines.map(({ key, ...r }) => r),
    rotation: { id: uid(), sequence, label: 'Strength & hypertrophy' },
    strengthProfile: { kind: STRENGTH_KIND, preferredDays: [0, 1, 2, 3, 4], routineIds: sequence, accessoryId: byKey.accessories },
  }
}

// Uses openGym's own indefinite rotation. Its clock is the moment the user activates it,
// solely to distinguish future completed workouts from history, never a prescribed start date.
export function installStrengthProgram(S) {
  if (S.strengthProfile || S.trainingCycle || S.active || (S.unit && S.unit !== 'kg')) return false
  const plan = buildStrengthProgram()
  S.routines.push(...plan.routines)
  S.strengthProfile = plan.strengthProfile
  S.rotation = plan.rotation
  S.weekStart = 0
  S.scheduleMode = 'rotation'
  if (S.effort == null) S.effort = 'rir'
  startPass(S)
  return true
}

export const needsStrengthUpgrade = S => !S.active &&
  (S.trainingCycle?.kind === 'strength-hypertrophy-v1' ||
    (S.strengthProfile?.kind === STRENGTH_KIND && S.strengthProfile.pendingStart === true))

// A one-time, additive migration of our earlier dated draft. Routine ids, logged sets,
// user edits, photos, measurements, weight caches and dated overrides stay intact.
export function upgradeStrengthProgram(S) {
  if (!needsStrengthUpgrade(S)) return false
  if (S.trainingCycle?.kind !== 'strength-hypertrophy-v1' && S.strengthProfile?.kind === STRENGTH_KIND) {
    S.strengthProfile = { ...S.strengthProfile, pendingStart: false }
    if (!S.queue && S.scheduleMode === 'rotation') startPass(S)
    return true
  }
  const previous = S.trainingCycle
  const defaults = buildStrengthProgram()
  const oldIds = [0, 1, 2, 3].map(day => previous.weeks?.[0]?.[day]?.[0])
  const core = oldIds.map((id, i) => S.routines.find(r => r.id === id) || defaults.routines[i])
  for (const routine of core) if (!S.routines.some(r => r.id === routine.id)) S.routines.push(routine)
  const addMissing = (routine, id, template) => {
    if (!routine.ex.some(e => e.id === id)) routine.ex.push(structuredClone(template.ex.find(e => e.id === id)))
  }
  addMissing(core[2], '0405', defaults.routines[2])
  addMissing(core[3], '0032', defaults.routines[3])
  const deadliftIndex = core[3].ex.findIndex(e => e.id === '0032')
  core[3].ex.unshift(...core[3].ex.splice(deadliftIndex, 1))
  for (const [routine, oldId, id] of [[core[0], '2330', '2291'], [core[1], '0410', '2290']]) {
    const entry = routine.ex.find(e => e.id === oldId)
    if (entry && !routine.ex.some(e => e.id === id)) { entry.id = id; delete entry.weight }
  }
  const rdl = core[3].ex.find(e => e.id === '0085')
  if (rdl?.sets === 3 && rdl.repsMin === 6 && rdl.reps === 10) { rdl.sets = 2; rdl.repsMin = 8 }
  const cId = 'strength-upper-c-' + core[0].id
  const c = S.routines.find(r => r.id === cId) || { ...defaults.routines[4], id: cId }
  if (!S.routines.some(r => r.id === c.id)) S.routines.push(c)
  const sequence = [...core.map(r => r.id), c.id]
  S.trainingCycle = null
  S.strengthProfile = { ...defaults.strengthProfile, routineIds: sequence, accessoryId: previous.accessoryId || defaults.strengthProfile.accessoryId }
  S.rotation = { ...defaults.rotation, id: 'personal-strength-' + core[0].id, sequence }
  S.scheduleMode = 'rotation'
  S.weekStart = 0
  if (S.effort == null) S.effort = 'rir'
  startPass(S)
  return true
}
