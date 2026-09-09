// SPDX-License-Identifier: GPL-3.0-only
// Centipede audio map -- DATA the web adapter reads. Centipede's sound is a single POKEY PSG driven straight
// off the 6502 (centiped.cpp:1821, no sound CPU / no sample ROM): a `synth` model (not clips). The board taps
// the POKEY register writes (boards/centiped/io.js pokeyWrite -> onSoundWrite, addresses 0x1000-0x100F) and
// audio/synth.js synthesises four independent voices from them. Grounded from a MAME play-time write tap
// (scratchpad/deep_capture/tracked_deep.csv) + the chip logic in mame-src/.../sound/pokey.cpp.
export const MODEL = "synth";

// The POKEY sound-write surface the board taps (memory-mapped 0x1000-0x100F; the low nibble picks the role):
//   AUDF1..4  0x1000/2/4/6  channel frequency dividers (event rate = clock / (AUDF + add))
//   AUDC1..4  0x1001/3/5/7  channel control: vol (bits0-3), volume-only (bit4), waveform select (bits5-7)
//   AUDCTL    0x1008        clock base / per-channel fast clock / 16-bit link / poly9
//   SKCTL     0x100F        SK_RESET (bits0-1) releases the poly counters at boot
export const REGISTERS = {
  audf: [0x1000, 0x1002, 0x1004, 0x1006],
  audc: [0x1001, 0x1003, 0x1005, 0x1007],
  audctl: 0x1008,
  skctl: 0x100f,
};

// POKEY input clock (centiped.cpp:1821 -- 12.096 MHz / 8). freq(pure) = (clock/28) / (2*(AUDF+1)) at 64 kHz base.
export const POKEY_CLOCK = 12096000 / 8;

export default { model: MODEL, synth: "audio/synth.js", registers: REGISTERS, pokeyClock: POKEY_CLOCK, masterGain: 0.7 };
