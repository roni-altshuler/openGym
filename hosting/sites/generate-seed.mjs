// Reproducible generic prescriptions only. No dates, personal logs or credentials.
import fs from 'node:fs'
import { buildStrengthProgram } from '../../frontend/src/lib/strength-program.js'
const plan = buildStrengthProgram()
const keys = ['upper-a', 'quad', 'upper-b', 'posterior', 'upper-c', 'accessories']
const ids = Object.fromEntries(plan.routines.map((r, i) => [r.id, 'strength-' + keys[i]]))
const seed = {
  unit: 'kg', weekStart: 0, scheduleMode: 'rotation', week: {}, dayPlan: {},
  workouts: [], bodyweight: [], measurements: [], dayPhotos: {}, exWeights: {},
  customEx: [], active: null, effort: 'rir', weighBefore: false,
  routines: plan.routines.map(r => ({ ...r, id: ids[r.id] })),
  rotation: { ...plan.rotation, id: 'personal-strength', sequence: plan.rotation.sequence.map(id => ids[id]) },
  queue: null,
  strengthProfile: { ...plan.strengthProfile, pendingStart: true,
    routineIds: plan.strengthProfile.routineIds.map(id => ids[id]), accessoryId: ids[plan.strengthProfile.accessoryId] },
}
fs.writeFileSync(new URL('./lib/strength-seed.json', import.meta.url), JSON.stringify(seed, null, 2) + '\n')
console.log('Generated the date-free personal strength seed.')
