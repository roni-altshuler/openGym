import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { Button } from './ui.jsx'

export default function GarminActivities() {
  const [status, setStatus] = useState(null)
  const [activities, setActivities] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const keyInput = useRef(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const run = async pull => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const data = await api(pull ? '/api/garmin/activities' : '/api/garmin/status')
      if (!alive.current) return
      if (pull) setActivities(data.activities)
      else setStatus(data)
    } catch (e) { if (alive.current) setError(e.message || 'Garmin could not be reached.') }
    finally { if (alive.current) setBusy(false) }
  }
  const connect = async event => {
    event.preventDefault()
    if (busy) return
    const key = keyInput.current?.value || ''
    if (keyInput.current) keyInput.current.value = ''
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api('/api/garmin/key', { method: 'POST', body: JSON.stringify({ key }) })
      if (alive.current) { setStatus(result); setNotice('Garmin connected. Your key is encrypted on the server.'); setActivities(null) }
    } catch (e) { if (alive.current) setError(e.message || 'Could not connect Garmin.') }
    finally { if (alive.current) setBusy(false) }
  }
  const disconnect = async () => {
    setBusy(true); setError('')
    try {
      const result = await api('/api/garmin/key', { method: 'DELETE' })
      if (alive.current) { setStatus(result); setActivities(null); setNotice('Garmin disconnected. The saved key has been removed.') }
    } catch (e) { if (alive.current) setError(e.message || 'Could not disconnect Garmin.') }
    finally { if (alive.current) setBusy(false) }
  }
  return <section className="card" aria-label="Garmin activities">
    <h3>Garmin · optional</h3>
    <p className="small dim">Read recent activity summaries from your personal account. Your API key stays on your private server. Garmin activities never set your lifting loads.</p>
    <Button size="sm" disabled={busy} onClick={() => run(status?.configured === true)}>{busy ? 'Checking Garmin…' : status?.configured ? 'Read recent activities' : 'Check connection setup'}</Button>
    {status?.configured === false && !status?.canConfigure && <p className="small dim">Not configured for this profile. Add the key and your Account ID in your private server settings. <a href="https://github.com/roni-altshuler/openGym/blob/personalize/strength-cycle/docs/PERSONAL_SETUP.md" target="_blank" rel="noreferrer">Setup guide</a></p>}
    {status?.canConfigure && !status.configured && <form onSubmit={connect} style={{ marginTop: 16 }}>
      <label className="small" htmlFor="garmin-personal-key">Garmin Personal API key</label>
      <input id="garmin-personal-key" ref={keyInput} className="input" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={4096} style={{ margin: '8px 0' }} />
      <p className="small muted">Sent directly over HTTPS to your private app, encrypted on the server, and cleared from this form. It is excluded from workout backups.</p>
      <Button type="submit" size="sm" disabled={busy}>Connect Garmin securely</Button>
    </form>}
    {status?.configured && status.canConfigure && <Button size="sm" disabled={busy} onClick={disconnect}>Disconnect Garmin</Button>}
    {notice && <p className="small muted" role="status">{notice}</p>}
    {status?.configured && activities == null && <p className="small dim">Server configured. Read activities to verify access.</p>}
    {error && <p role="alert" className="small">{error}</p>}
    {activities && <div aria-live="polite"><p className="small dim">{activities.length ? 'Latest activities · private to this profile' : 'No recent activities found.'}</p>
      {activities.map((a, i) => <div key={a.id || i} style={{ padding: '10px 0', borderTop: '1px solid var(--sep)' }}>
        <strong style={{ fontSize: 13 }}>{a.name}</strong><div className="small dim">{a.date} · {a.type.replaceAll('_', ' ')} · {Math.round(a.seconds / 60)} min</div>
      </div>)}
    </div>}
    <p className="small dim">Personal API access is read-only. Sending workouts to a watch requires Garmin’s Training API.</p>
  </section>
}
