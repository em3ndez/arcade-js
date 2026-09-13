// SPDX-License-Identifier: GPL-3.0-only
// Tempest audio map -- DATA the web audio adapter reads. Tempest's sound is two discrete Atari C012294 POKEY
// chips (tempest.cpp:668-690; no sound CPU, no sample ROM): a `synth` model. The board taps the POKEY
// register writes and games/tempest/audio/synth.js synthesises the eight voices (4 channels x 2 chips). A
// MAME play-time write tap (games/tempest/tools/lua/audio_tape.lua) showed POKEY1 ch3 written continuously as
// a pitch-tracked PURE tone -- a sustained parameterized voice, not a gated one-shot -> synth, not clips (§5).
export const MODEL = "synth";

// Per chip the ten low registers are the sound registers (AUDF1=0 AUDC1=1 .. AUDF4=6 AUDC4=7, AUDCTL=8,
// STIMER=9); the rest (POT/RANDOM/IRQ/SKCTL) are modelled in boards/tempest/pokey.js. The board emits
// (0x60C0 + chip*0x10 + reg, value) on io.onSoundWrite; synth.js decodes that address.
export const POKEY1 = 0x60c0; // POKEY1 registers 0x60C0-0x60CF (tempest.cpp:507)
export const POKEY2 = 0x60d0; // POKEY2 registers 0x60D0-0x60DF (tempest.cpp:508)
export const SOUND_REGS = 10; // AUDF1..AUDC4 (0-7) + AUDCTL (8) + STIMER (9)
export const POKEY_CLOCK = 1512000; // per-chip clock: MASTER_CLOCK (12.096 MHz) / 8

// The register-address ranges the adapter forwards to the synth (both chips' 10 sound registers).
export const REGISTERS = {
  pokey1: Array.from({ length: SOUND_REGS }, (_, r) => POKEY1 + r),
  pokey2: Array.from({ length: SOUND_REGS }, (_, r) => POKEY2 + r),
};

export default {
  model: MODEL,
  synth: "audio/synth.js",
  registers: REGISTERS,
  pokeyClock: POKEY_CLOCK,
  masterGain: 0.7, // playback trim applied on top of the synth's MAME-level-calibrated output
};
