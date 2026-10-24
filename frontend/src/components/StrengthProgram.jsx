import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { EXIDX } from '../lib/exercises.js'
import { buildStrengthProgram, installStrengthProgram } from '../lib/strength-program.js'
import { cycleWeekIndex, sundayOf } from '../../../api/training-cycle.js'
import { Button, Segmented } from './ui.jsx'
import { startFlow } from '../sheets.jsx'
import './strength-program.css'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function StrengthProgram() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const nav = useNavigate()
  const [anchor, setAnchor] = useState(sundayOf(todayISO()))
  const [shownWeek, setShownWeek] = useState(0)
  const draft = useMemo(() => buildStrengthProgram(anchor), [anchor])
  const cycle = S.trainingCycle || draft.trainingCycle
  const routines = S.trainingCycle ? S.routines : draft.routines
  const installed = !!S.trainingCycle
  const current = cycleWeekIndex(cycle, todayISO())
  return <section className="strength-program card" aria-label="Two-week strength program">
    <div className="strength-kicker">STRENGTH / HYPERTROPHY <span>{installed ? 'ACTIVE' : 'DRAFT'}</span></div>
    <h2>Build your next rep.</h2>
    <p className="dim">Five days, Sunday–Thursday. Two upper sessions alternate across a two-week cycle. Quad and posterior days stay on Monday and Wednesday.</p>
    <div className="strength-meta"><span>{S.unit || 'kg'}</span><span>Rep ranges</span><span>Rest timers</span><span>History & progression</span></div>
    {!installed && <>
      <label className="strength-anchor">Week A starts on Sunday
        <input aria-label="Week A start date" type="date" value={anchor} onChange={e => setAnchor(e.target.value)} />
      </label>
      <p className="small dim">The selected date is aligned to its Sunday. Starting loads are unset; choose them in your first session. Past benchmarks are not prescriptions.</p>
      <Button disabled={!sundayOf(anchor) || !!S.active || (S.unit && S.unit !== 'kg')} onClick={() => update(s => { installStrengthProgram(s, anchor) })}>Use this two-week plan</Button>
      {S.unit && S.unit !== 'kg' && <p className="small">Choose kg in Settings before activating this plan.</p>}
      {S.active && <p className="small">Finish or discard the active workout before activating the plan.</p>}
      {(S.queue || Object.keys(S.week || {}).length > 0) && <p className="small dim">Activation switches scheduling to this cycle. Your routines, history and dated changes stay saved. Stop the cycle to return to your previous fixed week.</p>}
    </>}
    {installed && <p className="small dim">Week A begins {cycle.anchor}. {todayISO() < cycle.anchor ? 'Your cycle starts on that date.' : `This is week ${current === 0 ? 'A' : 'B'}.`} Review or edit any session below.</p>}
    <Segmented value={String(shownWeek)} onChange={v => setShownWeek(Number(v))} options={[{ value: '0', label: 'Week A' }, { value: '1', label: 'Week B' }]} />
    <div className="strength-days">
      {DAYS.map((day, d) => {
        const routine = routines.find(r => r.id === cycle.weeks?.[shownWeek]?.[d]?.[0])
        return <details key={day} className="strength-day">
          <summary><span>{day.slice(0, 3)}</span><strong>{routine?.name || 'Accessories · swim · rest'}</strong><span aria-hidden="true">+</span></summary>
          {routine ? <div className="strength-prescription">
            {routine.ex.map((e, i) => <div key={i}><span className="capitalize">{EXIDX[e.id]?.n || e.id}</span><small>{e.sets} × {e.side ? `${e.repsMin / 2}–${e.reps / 2}/side` : `${e.repsMin}–${e.reps}`} · {e.restSec}s rest{e.bodyweight ? ' · bodyweight → belt' : ''}</small></div>)}
            {installed && <Button size="sm" onClick={() => nav('/plan/r/' + routine.id)}>Edit session</Button>}
          </div> : <div className="strength-prescription"><p className="small dim">Optional light accessories, an easy swim, or full rest. These do not advance or replace the five scheduled sessions.</p>
            {installed && <Button size="sm" disabled={!!S.active || !S.routines.some(r => r.id === cycle.accessoryId)} onClick={() => startFlow([cycle.accessoryId])}>Start optional accessories</Button>}
          </div>}
        </details>
      })}
    </div>
    <p className="small dim">Log the reps you actually complete. Build toward the top of each range, then increase load. Pull-ups and dips begin with 0 kg added; clean sets at the top unlock belt progression. All sessions are editable.</p>
    {installed && <button className="strength-stop" disabled={!!S.active} onClick={() => update(s => { s.trainingCycle = null })}>Stop cycle · keep routines and history</button>}
  </section>
}
