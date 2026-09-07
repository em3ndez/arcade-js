// SPDX-License-Identifier: GPL-3.0-only
// Galaxian audio map -- DATA the web adapter reads. Galaxian's sound is a discrete-analogue NETLIST
// (galaxian_a.cpp, no sound CPU / no sample ROM): a `synth` model (not clips) -- the board taps the
// sound-register writes and audio/synth.js synthesises four voices from them. Sound map galaxian.cpp:1741-3;
// grounded from a MAME play-time write tap + isolation-FFT of the frozen netlist.
export const MODEL = "synth";

// The sound-write surface the board taps (memory-mapped; the address encodes the role):
//   lfo   0x6004-7  4-bit DAC that shifts the background tone pitch (lfo_freq_w, bit0 per address)
//   fs    0x6800-2  three background 555 tone enables (the "buzzing background")
//   hit   0x6803    noise/explosion            fire 0x6805  the player shot (a decaying noise burst)
//   vol   0x6806-7  PITCH+BG level             pitch 0x7800 the melodic voice, freq = 192000/(256-pitch)
//                                                           (measured 0x80->1500, 0xC0->3000 Hz; 0xFF = off)
export const REGISTERS = { lfo: [0x6004, 0x6005, 0x6006, 0x6007], fs: [0x6800, 0x6801, 0x6802], hit: 0x6803, fire: 0x6805, vol: [0x6806, 0x6807], pitch: 0x7800 };
export const TONE_HZ_NUM = 192000;

export default { model: MODEL, synth: "audio/synth.js", registers: REGISTERS, toneHzNum: TONE_HZ_NUM, masterGain: 0.7 };
