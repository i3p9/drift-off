# Background sound sources

`rain-in-munich-westpark.mp3` is the public high-quality MP3 preview of **Rain in Munich Westpark** by **myLoop**, [Freesound sound 849800](https://freesound.org/people/myLoop/sounds/849800/). The creator lists it under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The full original WAV requires a Freesound login; this app uses the publicly offered MP3 version.

The runtime rain loop is prepared from this saved source. Pink noise and Brown noise are generated locally by `scripts/prepare-sounds.mjs` using FFmpeg's [anoisesrc color modes](https://ffmpeg.org/ffmpeg-filters.html#anoisesrc). Neither uses a third-party recording. A fixed seed produces reproducible output; a 20 Hz high-pass reduces sub-bass rumble, and a two-second crossfade, DC removal, and normalization prepare each 22-second loop. These sound names describe their frequency profiles, without a clinical claim.

`manifest.json` records source details, preparation steps, and checksums. This folder is a source backup and is excluded from deployment. Prepared, uncompressed loops are committed in `public/audio/`, so ordinary Vite builds and nightly playback do not need FFmpeg or access to Freesound.

To regenerate the loops, install FFmpeg locally and run `npm run sounds`. The script reads the saved source and does not download anything. This task checked audio measurements in the terminal; listening quality still needs a phone check.
