# Original paid narration

This folder preserves the original ElevenLabs MP3 recordings in Git, independently of the local generation cache. Listening to or copying these saved recordings does not use credits.

- `serena/`: all 180 original Serena recordings at generation speed 0.85.
- `daniel/`: all 180 approved Daniel recordings at generation speed 0.85.
- `auditions/`: three Katie and three Lindsey Grace recordings from the voice comparison.
- `scenes.json`: the original prompt text and scene IDs.
- `manifest.json`: voice IDs, model and settings, source cache filenames, SHA-256 checksums, and generation receipts. The receipts contain character counts, credit costs, and voice names, without credentials.

The Serena clips here are the original paid recordings. The player uses the pitch-preserving 1.25 tempo version already packaged in `public/voices/serena.json`; the adjustment uses `atempo=1.25/0.85`. Daniel's recordings are packaged without a tempo adjustment in `public/voices/male-narrator.json`.

Keep both this folder and `public/voices/` when committing to GitHub. Building and playing Drift uses the ready-made packs in `public/voices/` and requires no ElevenLabs access. Vite copies only application assets into `dist/`, so this source backup is not published to Cloudflare.
