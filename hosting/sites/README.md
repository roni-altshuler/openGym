# Private Sites adapter

This folder preserves the optional private hosting adapter. It runs in the Sites Vinext
starter with a `DB` D1 binding. Keep Sites owner-only access. The live app uses ChatGPT
sign-in at https://roni-strength.wiggly-shore-5967.chatgpt.site .

The preset is an indefinite five-session rotation with no prescribed dates. Run
`node hosting/sites/generate-seed.mjs` from the fork root to reproduce the generic seed.
The app activates a new profile on first use and migrates the earlier dated draft without
removing history. No personal logs, starting loads or credentials belong in source.

Build the frontend with `VITE_IMG_BASE=/exercise-media/still/` and
`VITE_GIF_BASE=/exercise-media/clip/`: the frontend is served from `/gym/` and the unchanged
licensed media from the site root. Stage the matching frontend and media after the Worker
build. Preserve all license/media notices. See HOSTING.md for publication details.

Garmin is deferred and hidden from the default UI. No key or master secret is needed for
workout tracking. The dormant credential routes require a runtime-only
`GARMIN_KEY_ENCRYPTION_SECRET` if used later; never commit it. No actual key is configured.

This adapter is smaller than the original backend: personal media sync, native pairing,
server push, AI Coach and the filesystem MCP connection are not implemented here. Their
original code and opt-in setup remain in the fork's full Docker/Node edition. See
[personal setup](../../docs/PERSONAL_SETUP.md) for the supported-feature table and migration path.
No paid AI provider is enabled automatically.

Tests: `node --test test/hosted.test.mjs` from this folder. These use synthetic fixtures and
an in-memory database to check authorization, secret separation and concurrent saves.
