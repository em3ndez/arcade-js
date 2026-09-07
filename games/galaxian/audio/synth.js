// SPDX-License-Identifier: GPL-3.0-only
// Galaxian audio SYNTH -- galaxian_a.cpp is a discrete-analogue netlist (no sound CPU / no sample ROM), so we
// synthesise it above the emulation (runbook §5 "datasheet-simple sound-chip device"), not clip replay. Four
// INDEPENDENT voices, each grounded from a MAME write-tap of a real play + isolation-FFT of the frozen
// netlist. Sound map: galaxian.cpp:1741-1743 (0x6004-7 lfo_freq / 0x6800-7 sound_w / 0x7800 pitch_w).
//
//   PITCH  0x7800      the melodic/lead voice: a pulse at TONE_HZ_NUM/(256-pitch) (measured 0x80->1500,
//                      0xC0->3000 Hz); pitch==0xFF is note-off (the DISCRETE_NOTE sentinel). Drives the start
//                      tune and the in-play dive/note sounds. It is a SEPARATE mixer input from the
//                      background in galaxian_a.cpp, so it must NOT be gated by the FS bits (the prior model
//                      gated it behind fs>0, which silenced the whole FS-off start tune).
//   BG     0x6800-2 FS three FS-enabled 555 tones (~176/198/220 Hz at the in-play DAC, measured by isolation
//        + 0x6004-7 DAC FFT) whose pitch the 4-bit lfo_freq DAC shifts; their beat is the "buzzing
//                      background". Continuous while any FS bit is set.
//   FIRE   0x6805      the player shot: a ~0.5s decaying noise+swept-tone burst (energy ~3 kHz, measured),
//                      retriggered on each rising edge (galaxian's fire 555 VCO + noise).
//   HIT    0x6803      the explosion: a short decaying LFSR-noise burst, retriggered on the rising edge.
//   VOL    0x6806-7    loudness of the PITCH+BG pre-mix (FIRE/HIT sit in the final mix, VOL-independent).
//
// One sample renderer (fills a Float32 block): the SAME code runs in the browser (a ScriptProcessor pulls
// blocks) and in node for validation vs a MAME reference -- re-derivable, no browser-only path.

export const TONE_HZ_NUM = 192000;
export const MASTER_GAIN = 8000 / 32768; // calibrated toward MAME's level, in [-1,1] output units
export const HIT_DECAY_S = 0.25;
export const FIRE_DECAY_S = 0.5;

// Every sound-register address this synth latches (the board's io.js taps + emits all of these).
export const REGS = {
  LFO: [0x6004, 0x6005, 0x6006, 0x6007], // 4-bit background-tone frequency DAC (lfo_freq_w, bit0 per address)
  FS: [0x6800, 0x6801, 0x6802],          // three background 555 tone enables
  HIT: 0x6803, FIRE: 0x6805,
  VOL: [0x6806, 0x6807],
  PITCH: 0x7800,
};

// Background 555 tone base frequencies (Hz), measured by MAME isolation FFT at the in-play DAC (12-15).
const BG_BASE = [176, 198, 220];

function volFromVol(v1, v2) {
  return 0.4 + 0.3 * ((v1 ? 1 : 0) + (v2 ? 1 : 0)); // VOL1/VOL2 -> 0.4 .. 1.0
}

export class GalaxianSynth {
  constructor(sampleRate) {
    this.rate = sampleRate;
    this.reg = {
      0x6004: 0, 0x6005: 0, 0x6006: 0, 0x6007: 0,
      0x6800: 0, 0x6801: 0, 0x6802: 0, 0x6803: 0, 0x6805: 0, 0x6806: 0, 0x6807: 0,
      0x7800: 0xff, // pitch note-off at reset
    };
    this.pitchPhase = 0;
    this.bgPhase = [0, 0, 0];
    this.firePhase = 0;
    this.fireRemain = 0;
    this.hitRemain = 0;
    this.noiseState = 0x1; // small LFSR-ish noise
  }

  // Called by the adapter for every tapped sound write. Latches state; HIT/FIRE retrigger on the rising edge.
  write(addr, value) {
    if (!(addr in this.reg)) return;
    const v = value & 0xff;
    if (addr === REGS.HIT && v && !this.reg[addr]) this.hitRemain = Math.floor(HIT_DECAY_S * this.rate);
    if (addr === REGS.FIRE && v && !this.reg[addr]) this.fireRemain = Math.floor(FIRE_DECAY_S * this.rate);
    this.reg[addr] = v;
  }

  _noise() {
    let x = this.noiseState;
    x ^= (x << 7) & 0xffff; x ^= x >> 9; x ^= (x << 8) & 0xffff;
    this.noiseState = x & 0xffff;
    return (this.noiseState / 32768) - 1;
  }

  // Fill `out` (Float32Array) with the next block for the CURRENT latched register state.
  render(out) {
    const r = this.reg, rate = this.rate;
    const vol = volFromVol(r[0x6806], r[0x6807]);

    const pitch = r[0x7800];
    const pitchOn = pitch < 255;
    const pInc = pitchOn ? (TONE_HZ_NUM / (256 - pitch)) / rate : 0;

    const dac = (r[0x6004] & 1) | ((r[0x6005] & 1) << 1) | ((r[0x6006] & 1) << 2) | ((r[0x6007] & 1) << 3);
    const bgScale = 0.72 + 0.28 * (dac / 15); // measured: DAC 15 -> base freqs, lower DAC -> lower
    const fsOn = [r[0x6800] & 1, r[0x6801] & 1, r[0x6802] & 1];
    const bgInc = [(BG_BASE[0] * bgScale) / rate, (BG_BASE[1] * bgScale) / rate, (BG_BASE[2] * bgScale) / rate];

    for (let i = 0; i < out.length; i++) {
      let s = 0;
      if (pitchOn) {
        this.pitchPhase += pInc; if (this.pitchPhase >= 1) this.pitchPhase -= 1;
        s += 0.40 * vol * (this.pitchPhase < 0.5 ? 1 : -1);
      }
      for (let k = 0; k < 3; k++) {
        if (fsOn[k]) {
          this.bgPhase[k] += bgInc[k]; if (this.bgPhase[k] >= 1) this.bgPhase[k] -= 1;
          s += 0.40 * vol * (this.bgPhase[k] < 0.5 ? 1 : -1);
        }
      }
      if (this.fireRemain > 0) {
        const env = this.fireRemain / (FIRE_DECAY_S * rate);
        const ffreq = 800 + 2200 * env; // sweeps ~3000 -> ~800 Hz over the decay (the "pew")
        this.firePhase += ffreq / rate; if (this.firePhase >= 1) this.firePhase -= 1;
        s += env * (0.6 * this._noise() + 0.4 * (this.firePhase < 0.5 ? 1 : -1));
        this.fireRemain--;
      }
      if (this.hitRemain > 0) {
        const env = this.hitRemain / (HIT_DECAY_S * rate);
        s += 0.6 * env * this._noise();
        this.hitRemain--;
      }
      out[i] = Math.max(-1, Math.min(1, s * MASTER_GAIN));
    }
    return out;
  }
}
