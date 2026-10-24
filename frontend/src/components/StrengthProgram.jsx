import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXIDX } from '../lib/exercises.js'
import { buildStrengthProgram, installStrengthProgram, STRENGTH_KIND } from '../lib/strength-program.js'
import { Button } from './ui.jsx'
import { startFlow } from '../sheets.jsx'
import './strength-program.css'

export default function StrengthProgram() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const nav = useNavigate()
  const draft = useMemo(() => buildStrengthProgram(), [])
  const installed = S.strengthProfile?.kind === STRENGTH_KIND
  const profile = installed ? S.strengthProfile : draft.strengthProfile
  const routines = installed ? S.routines : draft.routines
  const sessions = profile.routineIds.map(id => routines.find(r => r.id === id)).filter(Boolean)
  return <section className="strength-program card" aria-label="Personal strength and hypertrophy">
    <div className="strength-kicker">STRENGTH / HYPERTROPHY <span>{installed ? 'YOUR PLAN' : 'DRAFT'}</span></div>
    <h2>Build muscle. Get stronger.</h2>
    <p className="dim">Aim for Sunday–Thursday; train on any day. Missed days leave the next workout waiting. No start date or end date.</p>
    <div className="strength-meta"><span>{S.unit || 'kg'}</span><span>Quality reps</span><span>Progressive overload</span><span>Recovery</span></div>
    {!installed && <>
      <p className="small dim">Starting weights are blank. Choose a controlled working load in your first session; historical benchmarks stay historical.</p>
      <Button disabled={!!S.active || !!S.trainingCycle || (S.unit && S.unit !== 'kg')} onClick={() => update(installStrengthProgram)}>Use my ongoing rotation</Button>
      {S.active && <p className="small">Finish or discard the active workout before changing your program.</p>}
      {S.unit && S.unit !== 'kg' && <p className="small">Choose kg in Settings before activating the plan.</p>}
    </>}
    <details className="strength-targets">
      <summary>Session targets & optional accessories</summary>
      <div className="strength-days">
        {sessions.map((routine, index) => <details key={routine.id} className="strength-day">
          <summary><span>{index + 1}</span><strong>{routine.name}</strong><span aria-hidden="true">+</span></summary>
          <div className="strength-prescription">
            {routine.ex.map((e, i) => <div key={i}><span className="capitalize">{EXIDX[e.id]?.n || e.id}</span><small>{e.sets} × {e.side ? `${e.repsMin / 2}–${e.reps / 2}/side` : `${e.repsMin}–${e.reps}`} · {e.restSec}s rest{e.bodyweight ? ' · bodyweight → belt' : ''}</small></div>)}
            {installed && <Button size="sm" onClick={() => nav('/plan/r/' + routine.id)}>Edit session</Button>}
          </div>
        </details>)}
      </div>
      <p className="small dim">Friday/Saturday accessories are optional. Rest whenever you need it. Extra sessions do not replace or advance the main rotation.</p>
      {installed && <Button size="sm" disabled={!!S.active || !S.routines.some(r => r.id === profile.accessoryId)} onClick={() => startFlow([profile.accessoryId])}>Start optional accessories</Button>}
    <p className="small dim">Log actual reps and effort. Build to the top of each range with good technique, then increase weight. Pull-ups and dips begin at 0 kg added. RIR is available per set; choose RPE in Settings if you prefer.</p>
    <p className="small dim">Use the rotation controls below to rearrange or add sessions. Choose another routine on Home to repeat a workout or train out of order.</p>
    </details>
  </section>
}
