# Personal strength edition

This non-commercial fork adds an editable two-week strength/hypertrophy draft to openGym.
Open **Plan**, review both weeks and the exercise prescriptions, choose the Sunday anchor,
and select **Use this two-week plan**. It defaults to kg. No completed workouts, weigh-ins,
personal benchmarks, credentials or starting working loads are included in the source.

| Day | Week A | Week B |
| --- | --- | --- |
| Sunday | Upper A | Upper B |
| Monday | Lower — quad emphasis | Lower — quad emphasis |
| Tuesday | Upper B | Upper A |
| Wednesday | Lower — posterior emphasis | Lower — posterior emphasis |
| Thursday | Upper A | Upper B |
| Friday | Optional accessories, swimming or rest | Optional accessories, swimming or rest |
| Saturday | Optional accessories, swimming or rest | Optional accessories, swimming or rest |

The cycle repeats by calendar date, including across daylight-saving and year boundaries.
Per-date rescheduling and rest overrides still win. Stopping the cycle keeps its routines and
history and restores the previous fixed-week assignments. Optional accessories can be started
from either weekend row; they never advance the calendar cycle.

## Training behavior

- Each exercise has working sets, a rep range and its own rest timer. Compounds generally use
  120–180 seconds; isolation work uses 60–90 seconds. These are editable.
- Double progression uses completed sets: reach the top of the range in every set before the
  suggested load rises. Record actual completed reps rather than leaving an inaccurate target.
- Pull-ups and dips begin at bodyweight. The kg column is **added belt weight**. The draft opts
  into progressing to a small belt load after every prescribed set reaches the range ceiling.
- The draft starts a fresh baseline for each routine/exercise. Old history remains available,
  but old loads and global records cannot prefill the first session. Actual sessions of the new
  routine become its progression baseline.
- Upper A includes an overhand pulldown. Upper B includes a neutral-grip pulldown; close- and
  reverse-grip variations are saved as planned substitutes. Cable and machine work are included.
- The draft contains no leg press, face pulls or overhead triceps extensions.
- Use the normal **History** and **Stats** tabs for logs and progression. The existing mobile
  workout screen, timers, offline storage, backup/export and passkey sync are retained.

## Run this fork

The customization must be built from this repository. Pulling upstream's prebuilt image alone
does not include it.

```sh
git clone https://github.com/roni-altshuler/openGym.git
cd openGym
git switch personalize/strength-cycle
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost:8080`. Guest mode stores data in that browser. Create a private profile
for cross-device sync. For phone access, follow [self-hosting](SELF_HOSTING.md) and
[HTTPS on a LAN](SELF_HOSTING_HTTPS.md); configure `RP_ID` and `ORIGIN` for the actual HTTPS
hostname. Keep `data/` private and backed up. Do not mount it as a public static directory.
An ordinary static host or a serverless deployment without persistent storage is insufficient
for the unmodified Node/file-storage backend.

For development, use Node 22 and the committed npm lockfiles:

```sh
cd frontend
npm ci
npm test
npm run build
```

The frontend development server proxies `/api` to the local API on port 3000. Backend work
needs its own `npm ci --omit=optional` inside `api/`; run it with a writable private `DATA_DIR`.
The local preview can also be inspected in guest mode without a running API.

## Optional Garmin Personal API

### Private hosted app on your phone

The private hosted edition is at https://roni-strength.wiggly-shore-5967.chatgpt.site .
Sign in with the same ChatGPT account that owns the Site. The prepared plan starts with
Week A on Sunday, 25 October 2026. You can edit the routines and calendar in Plan.

For Garmin, open **Plan → Garmin → Check connection setup**, paste your existing Personal
API key into the private password field and select **Connect Garmin securely**. The form
clears the value immediately; the server verifies it directly with Garmin, encrypts it using
AES-256-GCM and stores the ciphertext separately from workout data. Never send the key in chat.
After connection, select **Read recent activities**. **Disconnect Garmin** removes the saved key.

Hosted workouts sync through a private D1 database with revision checks. The key is excluded
from workout backups. Hosting uses ChatGPT sign-in instead of openGym passkeys; native pairing,
custom-media uploads, the AI coach and server push notifications are disabled in this edition.
The original Docker edition below retains its own server capabilities and configuration.

### Docker/server configuration

The official [Personal API overview](https://developer.garmin.com/gc-developer-program/overview/),
[FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-faq/) and
[Swagger](https://developer.garmin.com/gc-developer-program/personal/swagger-docs/) were checked
on 24 October 2026. Personal access is pull-only. The documented activity listing is supported;
workout upload to Garmin or a watch is not implemented. Garmin lists Training API access under
its Business program.

1. Create your Personal API key yourself in Garmin Connect. Keep it private; do not paste it
   into chat, a repository, a browser build setting, or a shared screenshot.
2. Find your openGym **Account ID** in Settings → Account.
3. Set `GARMIN_PERSONAL_API_KEY` and `GARMIN_USER_ID` in the private server's `.env` or secret
   settings. `GARMIN_USER_ID` is your openGym Account ID, not a Garmin username. Restart the API.
4. Sign into that profile, open **Plan → Garmin**, check setup, then **Read recent activities**.

The server exchanges the key for a short-lived OAuth access token, caches that token only in
memory, and reads up to 20 recent activity summaries on request. Access is restricted to the
configured profile. The browser receives name, local date, type and duration; GPS, social,
owner and health fields are omitted. No Garmin data is written to workout history or used to
choose weights. Errors are sanitized, redirects are refused, and pulls are rate-limited.

The integration is covered by mocked HTTP and authorization tests. It still needs a live
verification with the owner's key on the intended private server. An unset key disables it.

## Upstream audit and license

Based on upstream commit `7a3ace53c5e910c2185f22df803726c5838a99ae`.
At inspection the frontend package version is 1.4.2. The stack is React 19, Vite,
React Router and Zustand; the API uses Node's HTTP server, passkeys and JSON-file persistence.
nginx serves the frontend and proxies the API at the same origin. Capacitor supplies native
Android/iOS packaging.

Upstream GitHub Actions runs frontend, API and MCP checks and Docker smoke tests using Node 22.
Its release workflows publish container images, mirror to GitLab and package mobile releases.
This fork's customization is proposed through a PR in the owner's fork, not upstream.

### Verification on this checkout

The production frontend build, nine focused frontend suites (352 tests), API queue and Garmin
tests (28 tests), locale consistency and source-string checks pass on Windows/Node 24.
The mobile browser flow was checked at 390px: activation, both calendar weeks and exercise
prescriptions render without horizontal overflow. The broader local suite is not green:
three swipe-animation failures reproduce in unchanged upstream code with the same dependencies,
and some container checks require a POSIX shell. Docker image execution and live Garmin access
still need verification on the deployment host. Upstream CI targets Linux/Node 22.

Keep [LICENSE](../LICENSE) and [NOTICE.md](../NOTICE.md). openGym code is AGPL-3.0-or-later;
offer the corresponding modified source to users of a network deployment. Exercise media have
separate Gym visual terms: a non-commercial openGym fork may retain the unmodified 180px media
and notice. They are not covered by the code license. Do not repurpose them outside openGym.
