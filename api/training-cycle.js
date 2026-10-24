// Shared calendar reader for the app and server reminders. UTC day arithmetic avoids DST drift.
const DAY = 86400000
const dayNumber = iso => {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const ms = Date.parse(iso + 'T00:00:00Z')
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === iso ? ms / DAY : null
}

export function cycleWeekIndex(cycle, iso) {
  const anchor = dayNumber(cycle?.anchor), day = dayNumber(iso)
  if (anchor == null || day == null || !Array.isArray(cycle?.weeks) || cycle.weeks.length !== 2) return null
  if (new Date(anchor * DAY).getUTCDay() !== 0) return null
  const weeks = Math.floor((day - anchor) / 7)
  return ((weeks % 2) + 2) % 2
}

// null means use the ordinary weekly schedule; [] is a deliberate day off.
export function cycleRoutineIds(S, iso) {
  const index = cycleWeekIndex(S?.trainingCycle, iso)
  if (index == null) return null
  if (iso < S.trainingCycle.anchor) return []
  const weekday = new Date(iso + 'T00:00:00Z').getUTCDay()
  const ids = S.trainingCycle.weeks[index]?.[weekday]
  return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []
}

export function sundayOf(iso) {
  const day = dayNumber(iso)
  if (day == null) return null
  return new Date((day - new Date(day * DAY).getUTCDay()) * DAY).toISOString().slice(0, 10)
}

// Portable plan metadata: only calendar fields and remapped routine pointers, never profile data.
export function portableCycle(cycle, mapId = id => id) {
  if (cycle?.kind !== 'strength-hypertrophy-v1' || cycleWeekIndex(cycle, cycle.anchor) == null) return null
  const weeks = cycle.weeks.map(week => Object.fromEntries(Array.from({ length: 7 }, (_, day) => {
    const ids = Array.isArray(week?.[day]) ? [...new Set(week[day].filter(id => typeof id === 'string').map(mapId).filter(Boolean))] : []
    return [day, ids]
  }).filter(([, ids]) => ids.length)))
  const accessoryId = typeof cycle.accessoryId === 'string' ? mapId(cycle.accessoryId) : null
  return { kind: cycle.kind, anchor: cycle.anchor, weeks, ...(accessoryId ? { accessoryId } : {}) }
}
