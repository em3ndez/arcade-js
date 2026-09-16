# Frogger audio — recording sign-off

<!-- audio_gate.py parses the four fields below (each present + non-empty; clips an integer > 0). -->
<!-- rom_sha256 is the audio-CPU ROM image (games frogger.608 + frogger.609 + frogger.610 concatenated -->
<!-- in order, 6144 bytes) — the second-Z80 + AY-3-8910 program that actually generates the recorded -->
<!-- sound. Those audio ROMs are NOT assembled into the manifest (the audio CPU is modelled by -->
<!-- record/replay of the sound-command surface), so they are pinned here instead. Clips are gitignored -->
<!-- copyright, regenerated per-ROM by games/frogger/tools/record_samples.py. -->

rom_sha256: a5dd222819cfbb81a9bf10197d9c21320e7ee6c0bc1441fb87dbedd511562b5c
clips: 20
date: 2026-09-16
by_ear: AUTONOMOUS attestation (runbook §5), not a human listen. record_samples.py drove real MAME headless over the frogger romset and captured MAME's OWN audio per sound-latch command, so the 20 recorded clips are oracle-correct BY SOURCE. It swept all 25 commands the committed map (audio/sounds.js) documents: 20 produced sound (cmd 1-13,15,16,24,48,144,208,240) and 5 are silent control bytes (0,14,128,176,255) carrying no clip. Coverage + wiring are verified in the standing suite — test/audio-map.test.js (every emitted command has a mapped clip; pass 9) and test/audio-wiring.test.js (the soundlatch tap reaches the player; pass 8). Where a routine's function and the measured hardware disagree, sounds.js records the conflict rather than picking silently. Recorded 2026-09-16 from the local romset.
