# Private openGym hosting

This deployment serves the openGym app under `/gym/index.html`, with ChatGPT sign-in and
owner-only Sites access. The frontend comes from the user's openGym fork. The hosted adapter
implements workout-state sync using D1 revisions and the same openGym merge stamps. File
uploads, native-device pairing, the AI coach and server push notifications are disabled here.
Local rest timers, exercise media, history, progression and browser offline storage remain available.

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

The application source is available in the owner's GitHub fork:
https://github.com/roni-altshuler/openGym/tree/personalize/strength-cycle
openGym code is AGPL-3.0-or-later. Exercise-media notices are preserved separately.
