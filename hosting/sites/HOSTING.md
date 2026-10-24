# Private openGym phone hosting

The original openGym frontend is served under `/gym/`, with owner-only ChatGPT sign-in.
Workout state sync uses D1 revisions and openGym's own merge stamps and conflict handling.
Browser offline storage, logging, RIR/RPE, progression, history, charts, measurements and
exports remain in the original frontend. The personal preset uses the native ongoing rotation,
with five distinct sessions and optional accessories. There are no dates in the default seed.
Existing copies of the earlier dated draft migrate in the frontend without deleting history.

The service worker precaches the canonical app directory (`./`), not `index.html`: this host
redirects the latter, which the worker correctly rejects as a potentially wrong/auth page.
The cache key remains `index.html` for offline navigation fallback. API responses are never cached.

This adapter is deliberately smaller than openGym's official Docker/Node backend. Native
pairing, personal media uploads/sync, server push, server AI Coach and the filesystem MCP
connection are not implemented here. They remain available in the full original backend in
the owner's fork. Do not present this deployment as feature-identical to Docker. Use the full
setup for those features; do not add a paid provider automatically. Garmin is deferred and
its setup is hidden from the default UI. No real Garmin key is configured.

Build the frontend with `VITE_IMG_BASE=/exercise-media/still/` and
`VITE_GIF_BASE=/exercise-media/clip/`. The app lives under `/gym/`, while media lives at the
site root. Vinext's public-directory copy is disabled; the postbuild script explicitly stages
the frontend, media and notices after the Worker build. This avoids copying the large media
library concurrently with the framework build. Keep the source/build inputs in the same order.

The exercise-media library is excluded from the source service's limited Git push and staged
by `scripts/prepare-media.mjs` before a build. That script pins an immutable revision of the
owner's public openGym fork. Complete unmodified media and its notice are included in the
deployment archive. No runtime database, local API data or credentials are build inputs.

Every private API operation requires Sites dispatch identity. Writes check the Origin and
bounded JSON request size; workout saves use atomic SQL revision predicates. Owner-only
Sites access is preserved. The dormant Garmin credential route uses AES-256-GCM with a
runtime-only master secret, binds ciphertext to its profile id and excludes keys from exports.
Never place secrets or a live database in source or an archive.

Growing profiles are gzip/base64 encoded at rest to respect D1's documented 2 MB row limit.
Old plain-JSON rows remain readable; the browser and exports always receive normal JSON.
The adapter bounds profiles to 8 MiB decoded and encoded rows to 1.9 MB. An oversized save
is refused, never truncated; openGym keeps its pending local copy. Tests round-trip synthetic
histories of thousands of sessions, check decoded-size bounds and retain atomic revisions.
See https://developers.cloudflare.com/d1/platform/limits/ . Keep regular export backups.

Run `node --test test/hosted.test.mjs` for authorization, credential separation and concurrent
save checks. Build with the Sites `build-site.mjs` helper, then package the exact pushed
source through the native Site workflow. Keep schema migrations, license and notices.

Source: https://github.com/roni-altshuler/openGym/tree/personalize/strength-cycle
openGym code remains AGPL-3.0-or-later. Exercise-media notices are preserved separately.
