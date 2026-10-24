# Private Sites adapter

This folder preserves the private hosting adapter source used by this fork. It runs in the Sites Vinext starter, with a `DB` D1 binding and a private runtime secret named `GARMIN_KEY_ENCRYPTION_SECRET`. Generate that secret with a cryptographically secure 32-byte random value; never put it in source. Keep Sites owner-only access.

The app is available to its owner at https://roni-strength.wiggly-shore-5967.chatgpt.site and uses ChatGPT sign-in. In Plan → Garmin, check setup and enter the key into the private password field, then submit. The server verifies it with Garmin and saves only AES-256-GCM ciphertext. Workout backups exclude it.

The normal Docker/Node deployment remains supported. It uses its private server environment variables instead of the hosted credential form. See the root personal setup guide and HOSTING.md here.

Tests: `node --test test/hosted.test.mjs` from this folder. These use synthetic credentials and an in-memory test database. No private key or personal workout history is included.
