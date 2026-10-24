# Private Sites adapter

This folder preserves the private hosting adapter source used by this fork. It runs in the Sites Vinext starter, with a `DB` D1 binding and a private runtime secret named `GARMIN_KEY_ENCRYPTION_SECRET`. Generate that secret with a cryptographically secure 32-byte random value; never put it in source. Keep Sites owner-only access.

The app is available to its owner at https://roni-strength.wiggly-shore-5967.chatgpt.site and uses ChatGPT sign-in. Garmin is optional and is deferred for the initial phone setup: no key is required. If enabled later, the private setup form verifies the key with Garmin and stores only AES-256-GCM ciphertext. Workout backups exclude it.

For this deployment, build the frontend with `VITE_IMG_BASE=/exercise-media/still/` and `VITE_GIF_BASE=/exercise-media/clip/`. The app is served from `/gym/`, while the unchanged exercise media is staged at the site root.

The normal Docker/Node deployment remains supported. It uses its private server environment variables instead of the hosted credential form. See the root personal setup guide and HOSTING.md here.

Tests: `node --test test/hosted.test.mjs` from this folder. These use synthetic credentials and an in-memory test database. No private key or personal workout history is included.
