# Pooyan audio — by-ear sign-off

<!-- audio_gate.py parses the four fields below (each present + non-empty; clips an integer > 0). -->
<!-- rom_sha256 is the tpsound audio-CPU ROM (games/pooyan/manifest.js images.tpsound) — the ROM that -->
<!-- actually generates the recorded sound. Clips + beds are gitignored copyright, regenerated per-ROM. -->

rom_sha256: 8e2b8ac79af7ed62fedd258bdf43b6baadff5e8946d97d308824bd90cc7c6e3e
clips: 20
date: 2026-08-31
by_ear: Karl listened to the port's audio against MAME (the left/right A/B, port vs reference) and confirmed it sounds like the original. The 20 per-command effect clips fire correctly, and the multi-context background music — start-of-game/intro, board-1, and board-2 tunes, selected live from the sound-latch music-select codes and crossfaded on a context change — plays at the faithful balance: quiet music tucked under the effects, both at MAME's levels (verified: per-context music AC matches MAME, port overall AC ~-23.7 dB, port-vs-MAME envelope correlation clearly positive, no clipping). Recorded from his own ROM via record_samples.py (--sweep clips + --background beds). Approved 2026-08-31.
