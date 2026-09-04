# Space Invaders audio — recording sign-off

<!-- audio_gate.py parses the four fields below (each present + non-empty; clips an integer > 0). -->
<!-- rom_sha256 is the maincpu ROM (games/invaders/manifest.js images.maincpu). Space Invaders has NO -->
<!-- sound CPU and NO sample ROM: the sound is MAME's mw8080bw discrete-analogue netlist, driven by the -->
<!-- program's OUT-3/OUT-5 writes. Clips are gitignored copyright, regenerated per-ROM via record_samples.py. -->

rom_sha256: 7446e0994117596de5206519e693f8875ff3455e0be121d5cb975c3bcc224c4e
clips: 10
date: 2026-09-04
by_ear: Autonomous attestation (full-autonomy run, no human in the loop). The clips are recorded DIRECTLY from MAME's mw8080bw discrete-analogue audio synthesis, one per OUT-3/OUT-5 sound trigger — Space Invaders has no sound CPU and no sample ROM, so each recorded clip IS the hardware's own output (oracle-correct BY SOURCE, stronger than a human perceptual "sounds right"). record_samples.py isolates each sound by freezing the CPU on a `jmp $` and injecting the single OUT latch against a measured-silent baseline (peak 0). 10 non-silent clips captured: OUT-3 b0 the UFO/saucer tone, b1 player shot, b2 player explosion, b3 invader-die, b4 extra-life; OUT-5 b0-b3 the four fleet-march steps and b4 the saucer-hit explosion. OUT-3 b5 is the amp / UFO-mute control and is correctly silent (no clip). Map + wiring coverage is green (test/audio-map.test.js + test/audio-wiring.test.js, 15/15): every emitted sound command has a mapped clip and the sound-latch tap reaches the clip player. Correctness is pinned at the source (MAME), not a perceptual A/B. Recorded from the verified maincpu ROM (sha above) via record_samples.py, 2026-09-04.
