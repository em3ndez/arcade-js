// SPDX-License-Identifier: GPL-3.0-only
// Galaxian audio map -- DATA the web adapter reads. Galaxian's sound is a discrete-analogue NETLIST
// (galaxian_a.cpp, no sound CPU / no sample ROM) whose dominant sound is a live parameterized tone -- a
// `synth` model (not clips): the board taps the sound-register writes and audio/synth.js synthesises them.
// Grounded from a play-time write tap; validated ~+0.7 envelope correlation vs MAME (record_samples.py).
export const MODEL = "synth";

// Sound-write surface the board taps (memory-mapped; the address encodes the role). fs = FS1/FS2/FS3 tone
// gates (3 distinct HW tones; synth reads lit-count as loudness); hit = noise/explosion; fire = VCO (unused);
// vol = level; pitch drives freq = 192000/(256-pitch) (measured 0x80->1500, 0xC0->3000 Hz).
export const REGISTERS = { fs: [0x6800, 0x6801, 0x6802], hit: 0x6803, fire: 0x6805, vol: [0x6806, 0x6807], pitch: 0x7800 };
export const TONE_HZ_NUM = 192000;

export default { model: MODEL, synth: "./synth.js", registers: REGISTERS, toneHzNum: TONE_HZ_NUM, masterGain: 0.7 };
