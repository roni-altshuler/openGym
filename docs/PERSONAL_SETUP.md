# Personal strength edition

This non-commercial fork keeps openGym's logging, library, demonstrations, progression,
statistics and exports. The personal preset focuses on building muscle and strength over
months and years. It has no prescribed start date, week number or end date.

## Your ongoing rotation

1. Upper A — flat bench, pull-ups, seated cable row, wide-grip pulldown and arms.
2. Lower · quad emphasis — squat, Bulgarian split squat, leg extension, curl and calves.
3. Upper B — incline press, dips, close-neutral pulldown, T-bar row, shoulders and arms.
4. Lower · posterior emphasis — deadlift, RDL, hamstring curl, hip thrust and calves.
5. Upper C · volume — chest press, underhand pulldown, pec deck, cable row and arms.

These are five distinct sessions, not assigned dates. Aim for Sunday–Thursday, but train on
any day. openGym's existing Rotation keeps the first unfinished session up next and starts
another round when the current one finishes. Missing days does not reset the program.

Use **Plan → Schedule → Edit** to reorder/remove sessions and **Add** to include a routine.
Use **Skip next session once** to skip just this round, with Undo: it never writes a workout
or removes the routine from future rounds. On Home/Start, choose any other routine to repeat
it or train out of order. Friday/Saturday accessories are optional and do not advance the
main rotation. There is no swimming in the preset.

The earlier dated draft upgrades once when the app opens. Existing routine ids, logged sets,
measurements, photos, user edits and history remain saved. An active workout is left alone
until it is finished or discarded. New profiles activate the rotation when actually opened;
no future date is written into the shipped seed.

## Training behavior

- kg by default, with working sets, repetition ranges and exercise-specific rest times.
- Double progression: reach the top of the range in every prescribed set before adding load.
- Pull-ups and dips start at bodyweight; log **added belt kg**. Clean top-range sets unlock
  the next small belt load. Partial or incomplete sets never count as success.
- Starting working weights are blank. Old benchmarks remain history; actual completed sessions
  of the new routine establish its progression baseline.
- RIR logging is selected for the personal preset; RPE remains available in Settings.
- Use controlled movement and challenging weights, leave quality reps in reserve, and allow
  recovery. The prescriptions are editable. No leg press, face pulls or overhead triceps work.
- openGym's existing Stats provide PRs, estimated 1RM trends, volume, effort, muscle balance,
  recovery, body weight and measurements. Plans can be shared/printed with the rotation order;
  plan sharing excludes workout history. Full backups preserve the complete profile.

## Phone deployment and supported features

The owner-private app is at https://roni-strength.wiggly-shore-5967.chatgpt.site . Sign in with
the owning ChatGPT account. Add it to the phone home screen from Safari/Chrome's browser menu.
No Garmin key is required; Garmin setup is deferred and hidden from the default Plan screen.

### Offline gym use

Open the installed home-screen app while online first and let the plan load. Its service worker
caches the app code; logging stores changes on the phone immediately. Cached demonstrations
remain available offline; a demonstration that has not been downloaded still needs a connection.

Pending changes sync automatically when the app is open and connectivity returns. If you closed
it, reopen it while online. Check the connection indicator and wait for the synced confirmation.
A phone/browser that suspends or closes the app is not guaranteed to sync in the background.
Stay signed in, use normal browser storage, and keep local app data until pending workouts sync.

The hosted edition uses the original frontend with a small private persistence adapter.
Workouts, routines, settings, body weight and measurements sync to D1 with atomic revision
checks, while browser offline storage and exports remain available. Access stays owner-only.

| Capability | Private hosted edition | Official Docker setup |
| --- | --- | --- |
| Logging, rotation, RIR/RPE, PRs, charts, volume/recovery | Available | Available |
| Library and exercise demonstrations | Available, unmodified licensed media | Available |
| Workout-state/device synchronization and exports | ChatGPT sign-in + D1 | openGym accounts/passkeys + persistent data directory |
| Private progress-photo/video and custom-media synchronization | Not available on this adapter | Available |
| Native app pairing and server push | Not available on this adapter | Available |
| Server AI Coach and read-only MCP | Preserved in source; not connected to this adapter | Optional, see below |

Do not assume a hosted feature exists merely because its full-server counterpart is in the
repository. For all upstream server features over the long term, use its documented Docker
setup on a persistent host. The original backend is preserved; no personal history belongs
in the public repository. Export backups regularly from Settings and back up hosted storage.

## Run the full original backend

Build the customization from this fork; upstream's prebuilt image does not include it.

```sh
git clone https://github.com/roni-altshuler/openGym.git
cd openGym
git switch personalize/strength-cycle
cp .env.example .env
docker compose up -d --build
```

Open http://localhost:8080. Follow [self-hosting](SELF_HOSTING.md) for an HTTPS hostname,
`RP_ID` and `ORIGIN`. Keep `data/` private, persistent and backed up. The official web/API
containers, passkey authentication, native pairing, uploads and optional services remain.

## Optional Coach and MCP

The original [AI Coach](AI_COACH.md) stays off until explicitly configured. No paid provider,
API key or spending is enabled by this fork. Set up a provider or your own compatible local
model from the original admin dashboard, review its consent screen, and select muscle gain
and strength as the goals. Its normal proposal/review flow requires you to apply changes;
suggestions do not silently replace your routines. Use lifting history, effort, volume and
recovery as inputs rather than old benchmark weights as prescriptions.

The [read-only MCP server](../mcp/README.md) is retained unmodified. It reads a private local
`data/` directory and uses the same training helpers as the app for performance analysis.
Its tools cannot edit routines, write workouts or access account credentials. Do not expose
that directory or the stdio server publicly. This connection is optional and does not activate
an AI provider. The private hosted database is not automatically exposed through MCP.

## Development and licensing

Use Node 22 and the committed lockfiles. Run frontend tests/build from `frontend/`, the API
queue tests from the repository, and `node mcp/scripts/check-node-loadable.mjs` to ensure the
shared logic still loads in the original MCP server. `hosting/sites/` contains the optional
hosting adapter; `generate-seed.mjs` produces only generic prescriptions with no personal data.

openGym code remains AGPL-3.0-or-later. Preserve LICENSE and the separate exercise-media NOTICE;
this non-commercial fork distributes the media unchanged. Its source link remains in the app.
