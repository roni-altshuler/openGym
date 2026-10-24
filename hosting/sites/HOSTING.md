# Private openGym hosting

This deployment serves the openGym app under `/gym/index.html`, with ChatGPT sign-in and
owner-only Sites access. The frontend comes from the user's openGym fork. The hosted adapter
implements workout-state sync using D1 revisions and the same openGym merge stamps. File
uploads, native-device pairing, the AI coach and server push notifications are disabled here.
Local rest timers, exercise media, history, progression and browser offline storage remain available.

For the hosted frontend build, set `VITE_IMG_BASE=/exercise-media/still/` and
`VITE_GIF_BASE=/exercise-media/clip/`. The app lives under `/gym/`, while its media
is staged at the site root. Garmin setup is optional and is not required to use the tracker.

`lib/garmin-vault.mjs` encrypts Garmin keys with AES-256-GCM using a secret named
`GARMIN_KEY_ENCRYPTION_SECRET` supplied only through the hosted runtime. The database stores
ciphertext with the authenticated profile id as additional authenticated data. Credentials are
not part of workout state, exports, frontend storage or source. Setup verifies a key directly
with Garmin before saving it, and clears the password field immediately on submission.
The API authorizes every private operation using Sites dispatch identity, checks the Origin
on writes, bounds JSON request size and uses atomic SQL revision predicates for workout saves.

Run `node --test test/hosted.test.mjs` for encryption, authorization, credential separation and
concurrent-save tests. Build with the Sites `build-site.mjs` helper, then run
`node scripts/stage-static.mjs` to stage the matching frontend and full exercise media.
Keep the source hosting manifest, database migrations, license and third-party notices.
Never copy local databases or runtime secrets into a source or deployment archive.

The 190MB exercise-media library exceeds the source service's push limit, so it is excluded
from this source repository and staged by `scripts/prepare-media.mjs` before a build. That script
pins an immutable revision of the owner's public openGym fork. The complete unmodified media
and its notice remain in the deployment archive. The app code and all hosted adapter source
remain tracked. No runtime database or credential is used as a build input.

The application source is available in the owner's GitHub fork:
https://github.com/roni-altshuler/openGym/tree/personalize/strength-cycle
openGym code is AGPL-3.0-or-later. Exercise-media notices are preserved separately.
