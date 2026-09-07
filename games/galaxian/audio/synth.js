// SPDX-License-Identifier: GPL-3.0-only
// Galaxian audio SYNTH -- galaxian_a.cpp is a discrete-analogue netlist (no sound CPU / no sample ROM), and
// its dominant sound is a live PARAMETERIZED tone, not a set of one-shot clips (grounded from a full
// sound-write tap during play: FS1-3 0x6800-2 on every frame, PITCH 0x7800 continuously varying, VOL 0x6806-7
// modulated; FIRE 0x6805 never enabled, HIT 0x6803 rare). So we synthesise it above the emulation -- the
// runbook's "datasheet-simple sound-chip device" -- rather than replay clips.
//
// MODEL (measured against MAME: ~+0.7 envelope correlation with the reference play, rate-matched at the
// wav's native rate; games/galaxian/tools/record_samples.py is the calibration instrument):
//   * one PULSE tone at freq = TONE_HZ_NUM / (256 - pitch)  [pitch = 0x7800], the 555-astable/pitch-DAC law
//     measured exactly: 0x00->750, 0x40->1000, 0x80->1500, 0xC0->3000, 0xE0->6000 Hz.
//   * amplitude = (FS-voices-lit / 3) * volFromVol(VOL1,VOL2). SIMPLIFICATION: in hardware the three FS
//     voices (0x6800-2) are three DISTINCT LFO-modulated 555 tones, not one -- this synth voices the
//     dominant pitch-register tone and reads the FS lit-count only as a loudness proxy (more voices lit ->
//     louder tone), which tracks the play envelope without modelling each astable.
//   * a short decaying NOISE burst on each HIT (0x6803) rising edge (the explosion).
// This is a sample renderer (fills a Float32 block) so the SAME code runs in the browser (an AudioWorklet /
// ScriptProcessor pulls blocks) and in node for validation -- one model, re-derivable, no browser-only path.

export const TONE_HZ_NUM = 192000;
export const MASTER_GAIN = 8000 / 32768; // calibrated toward MAME's level, expressed in [-1,1] output units
export const HIT_DECAY_S = 0.25;

// The sound-register addresses this synth listens to (the board's io.js already taps writes here).
export const REGS = { FS: [0x6800, 0x6801, 0x6802], HIT: 0x6803, FIRE: 0x6805, VOL: [0x6806, 0x6807], PITCH: 0x7800 };

function volFromVol(v1, v2) {
  return 0.4 + 0.3 * ((v1 ? 1 : 0) + (v2 ? 1 : 0)); // VOL1/VOL2 -> 0.4 .. 1.0
}

export class GalaxianSynth {
  constructor(sampleRate) {
    this.rate = sampleRate;
    this.reg = { 0x6800: 0, 0x6801: 0, 0x6802: 0, 0x6803: 0, 0x6805: 0, 0x6806: 0, 0x6807: 0, 0x7800: 0 };
    this.phase = 0;           // tone phase in [0,1)
    this.hitRemain = 0;       // samples of noise burst left
    this.prevHit = 0;
    this.noiseState = 0x1;    // small LFSR-ish noise
  }

  // Called by the board's soundWrite/soundPitch tap. Returns nothing; the render reads the latched state.
  write(addr, value) {
    if (addr in this.reg) {
      const rising = addr === REGS.HIT && value && !this.reg[addr];
      this.reg[addr] = value & 0xff;
      if (rising) this.hitRemain = Math.floor(HIT_DECAY_S * this.rate);
    }
  }

  _noise() {
    // cheap LFSR noise in [-1,1]
    let x = this.noiseState;
    x ^= (x << 7) & 0xffff; x ^= x >> 9; x ^= (x << 8) & 0xffff;
    this.noiseState = x & 0xffff;
    return (this.noiseState / 32768) - 1;
  }

  // Fill `out` (Float32Array) with the next block of audio for the CURRENT latched register state.
  render(out) {
    const pitch = this.reg[0x7800];
    const fs = (this.reg[0x6800] ? 1 : 0) + (this.reg[0x6801] ? 1 : 0) + (this.reg[0x6802] ? 1 : 0);
    const amp = (fs / 3) * volFromVol(this.reg[0x6806], this.reg[0x6807]);
    const toneOn = fs > 0 && pitch < 255;
    const freq = toneOn ? TONE_HZ_NUM / (256 - pitch) : 0;
    const inc = freq / this.rate;
    for (let i = 0; i < out.length; i++) {
      let s = 0;
      if (toneOn) {
        this.phase += inc; if (this.phase >= 1) this.phase -= 1;
        s += amp * (this.phase < 0.5 ? 1 : -1);
      }
      if (this.hitRemain > 0) {
        const env = this.hitRemain / (HIT_DECAY_S * this.rate);
        s += 0.6 * env * this._noise();
        this.hitRemain--;
      }
      out[i] = s * MASTER_GAIN;
    }
    return out;
  }
}
