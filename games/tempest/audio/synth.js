// SPDX-License-Identifier: GPL-3.0-only
// Tempest audio SYNTH -- Tempest's sound is two discrete Atari C012294 POKEY chips (tempest.cpp:668-690,
// POKEY @ MASTER_CLOCK/8 = 1.512 MHz each; no sound CPU, no sample ROM), so we synthesise it above the
// emulation (runbook §5 "datasheet-simple sound-chip device"), not clip replay. This is a faithful
// cycle-stepped port of MAME's POKEY DSP (mame src/devices/sound/pokey.cpp step_one_clock/process_channel/
// poly_init), run at the chip's native 1.512 MHz clock and box-averaged down to the output sample rate --
// the one code path drives both the browser (a ScriptProcessor pulls blocks) and node validation vs a MAME
// -wavwrite reference. Grounded from a MAME play-time register write tap (games/tempest/tools/lua/
// audio_tape.lua): the dominant voice is POKEY1 channel 3 (AUDF3/AUDC3 written continuously -- a sustained
// pitch-tracked PURE tone), with poly-noise voices on the other channels and POKEY2 (fire/explosion decay).
//
// Each chip has FOUR independent channels. A channel divides its clock by (AUDF+1) via an 8-bit down-counter
// (reload = AUDF^0xff), and on each borrow its waveform generator advances: PURE (AUDC bit 0x20) toggles a
// square, otherwise it samples the poly4/poly9/poly17 LFSR selected by AUDC/AUDCTL (poly5 gates whether the
// generator clocks at all unless NOTPOLY5). Volume is the AUDC low nibble; VOLUME_ONLY (0x10) forces the
// channel on (a DC term). AUDCTL picks the clock base (15.7 kHz vs 63.9 kHz prescale of the 1.512 MHz clock),
// 16-bit channel joins (1+2, 3+4), the per-channel high-clock (1.512 MHz direct), the two high-pass filters,
// and poly9-vs-poly17. STIMER (register 9) resets every channel counter. All eight voices sum into one mono
// mix (both chips route ALL_OUTPUTS to mono at 0.5, tempest.cpp:678/690); a DC blocker AC-couples the output
// the way the board's output cap does.

export const POKEY_CLOCK = 1512000; // Tempest per-chip POKEY clock: MASTER_CLOCK (12.096 MHz) / 8
export const MASTER_GAIN = 5.5;     // final [-1,1] scale, calibrated so the AC (DC-removed) level matches
                                    // MAME's -wavwrite reference (ratio ~0.96, ref-run peak ~0.94, no clip);
                                    // this single scalar absorbs the POKEY resistor-ladder (voltab) mapping
                                    // from summed volume nibbles to output voltage, which the mix models
                                    // linearly. The map's masterGain trims this to a comfortable playback level.

// Sound-register memory addresses (tempest.cpp:507-508): POKEY1 0x60C0-0x60CF, POKEY2 0x60D0-0x60DF. Per
// chip: AUDF1=0 AUDC1=1 AUDF2=2 AUDC2=3 AUDF3=4 AUDC3=5 AUDF4=6 AUDC4=7 AUDCTL=8 STIMER=9. The board's
// io.onSoundWrite emits (0x60C0 + chip*0x10 + reg, value); write() below decodes that.
export const POKEY1_BASE = 0x60c0;
export const POKEY2_BASE = 0x60d0;
export const CHANNELS_PER_CHIP = 4;

// AUDCx control bits (pokey.cpp:137-142).
const NOTPOLY5 = 0x80;   // 1 = ignore poly5 gate (clock the generator every borrow); 0 = poly5 gates it
const POLY4 = 0x40;      // 1 = poly4 distortion; 0 = poly9/poly17 (per AUDCTL POLY9)
const PURE = 0x20;       // 1 = pure square (toggle); 0 = poly distortion
const VOLUME_ONLY = 0x10;// 1 = channel forced on (volume as a DC level, no tone)
const VOLUME_MASK = 0x0f;// low nibble = volume 0..15
// AUDCTL bits (pokey.cpp:144-152).
const POLY9 = 0x80;       // 1 = poly9 (9-bit) instead of poly17 for non-poly4 distortion
const CH1_HICLK = 0x40;   // channel 1 clocked at 1.512 MHz
const CH3_HICLK = 0x20;   // channel 3 clocked at 1.512 MHz
const CH12_JOINED = 0x10; // channels 1+2 form one 16-bit divider
const CH34_JOINED = 0x08; // channels 3+4 form one 16-bit divider
const CH1_FILTER = 0x04;  // channel 1 high-pass (clocked by channel 3)
const CH2_FILTER = 0x02;  // channel 2 high-pass (clocked by channel 4)
const CLK_15KHZ = 0x01;   // 1 = 15.7 kHz base prescale; 0 = 63.9 kHz base prescale
const DIV_64 = 28;        // 1.512 MHz -> ~54.0 kHz (the "63.9 kHz" prescale at the home-computer clock)
const DIV_15 = 114;       // 1.512 MHz -> ~13.26 kHz (the "15.7 kHz" prescale)

// LFSR poly tables, ported bit-for-bit from pokey.cpp poly_init_4_5 / poly_init_9_17. The waveform generator
// reads bit 0 of each, so we store just that bit. Built once and shared across chips (read-only).
let POLY4T = null, POLY5T = null, POLY9T = null, POLY17T = null;
function polyInit45(size) {
  const mask = (1 << size) - 1, xorbit = size - 1, t = new Uint8Array(mask);
  let lfsr = 0;
  for (let i = 0; i < mask; i++) {
    lfsr = ((lfsr << 1) | (~((lfsr >> 2) ^ (lfsr >> xorbit)) & 1)) & mask;
    t[i] = lfsr & 1;
  }
  return t;
}
function polyInit917(size) {
  const len = size === 17 ? 0x1ffff : 0x1ff; // table length == LFSR period (mask)
  const t = new Uint8Array(len);
  let lfsr = len; // seed all-ones (== len == mask)
  if (size === 17) {
    for (let i = 0; i < len; i++) {
      const in8 = (((lfsr >> 8) & 1) ^ ((lfsr >> 13) & 1)) & 1;
      const in0 = lfsr & 1;
      lfsr = lfsr >>> 1;
      lfsr = (lfsr & 0xff7f) | (in8 << 7);
      lfsr = ((in0 << 16) | lfsr) >>> 0;
      t[i] = lfsr & 1;
    }
  } else {
    for (let i = 0; i < len; i++) {
      const in0 = ((lfsr & 1) ^ ((lfsr >> 5) & 1)) & 1;
      lfsr = ((in0 << 8) | (lfsr >>> 1)) & 0x1ff;
      t[i] = lfsr & 1;
    }
  }
  return t;
}
function polys() {
  if (!POLY4T) { POLY4T = polyInit45(4); POLY5T = polyInit45(5); POLY9T = polyInit917(9); POLY17T = polyInit917(17); }
  return { p4: POLY4T, p5: POLY5T, p9: POLY9T, p17: POLY17T };
}

// One POKEY chip: four channels stepped at the native clock. `level()` returns the instantaneous summed
// volume of the active channels (0..60), the analog quantity MAME packs into m_out_raw and feeds its output
// filter; we box-average it across the clocks per output sample, which is itself the anti-alias/decimation.
export class PokeyChip {
  constructor() {
    const p = polys();
    this.poly4 = p.p4; this.poly5 = p.p5; this.poly9 = p.p9; this.poly17 = p.p17;
    this.audf = new Uint8Array(4);
    this.audc = new Uint8Array(4).fill(0xb0); // power-on AUDC (pokey.cpp reset): vol 0, so silent
    this.audctl = 0;
    this.counter = new Int32Array(4).fill(0xff); // device_reset: counter = AUDF^0xff, AUDF=0 -> 0xff
    this.borrow = new Int32Array(4);
    this.output = new Uint8Array(4);
    this.filter = new Uint8Array([1, 1, 0, 0]); // filter_sample seed (STIMER: i<2?1:0)
    this.p4 = 0; this.p5 = 0; this.p9 = 0; this.p17 = 0;
    this.clk28 = 0; this.clk114 = 0;
  }

  // Latch a register write. reg 0-7 = AUDF/AUDC per channel, 8 = AUDCTL, 9 = STIMER (counter reset).
  write(reg, val) {
    reg &= 0x0f; val &= 0xff;
    if (reg < 8) {
      if (reg & 1) this.audc[reg >> 1] = val; else this.audf[reg >> 1] = val;
    } else if (reg === 8) {
      this.audctl = val;
    } else if (reg === 9) { // STIMER: reset all counters/outputs (pokey.cpp write_internal STIMER_C)
      for (let i = 0; i < 4; i++) {
        this.counter[i] = this.audf[i] ^ 0xff; this.borrow[i] = 0;
        this.output[i] = 0; this.filter[i] = i < 2 ? 1 : 0;
      }
    }
  }

  _resetChan(ch) { this.counter[ch] = this.audf[ch] ^ 0xff; this.borrow[ch] = 0; }
  _incChan(ch, cycles) {
    this.counter[ch] = (this.counter[ch] + 1) & 0xff;
    if (this.counter[ch] === 0 && this.borrow[ch] === 0) this.borrow[ch] = cycles;
  }
  _checkBorrow(ch) {
    if (this.borrow[ch] > 0) { this.borrow[ch]--; return this.borrow[ch] === 0; }
    return false;
  }
  // Advance a channel's waveform generator on a borrow (pokey.cpp process_channel).
  _process(ch) {
    if ((this.audc[ch] & NOTPOLY5) || (this.poly5[this.p5] & 1)) {
      if (this.audc[ch] & PURE) this.output[ch] ^= 1;
      else if (this.audc[ch] & POLY4) this.output[ch] = this.poly4[this.p4] & 1;
      else if (this.audctl & POLY9) this.output[ch] = this.poly9[this.p9] & 1;
      else this.output[ch] = this.poly17[this.p17] & 1;
    }
  }

  // One POKEY master clock (pokey.cpp step_one_clock, sound path; serial/keyboard/pot omitted -- input is
  // modelled in boards/tempest/pokey.js, and Tempest keeps SK_RESET asserted while the chip sounds).
  step() {
    if (++this.p4 === 15) this.p4 = 0;
    if (++this.p5 === 31) this.p5 = 0;
    if (++this.p9 === 0x1ff) this.p9 = 0;
    if (++this.p17 === 0x1ffff) this.p17 = 0;
    let clk28 = 0, clk114 = 0;
    if (++this.clk28 >= DIV_64) { this.clk28 = 0; clk28 = 1; }
    if (++this.clk114 >= DIV_15) { this.clk114 = 0; clk114 = 1; }
    const A = this.audctl;
    const baseTrig = (A & CLK_15KHZ) ? clk114 : clk28;

    if (A & CH1_HICLK) this._incChan(0, (A & CH12_JOINED) ? 7 : 4);
    else if (baseTrig) this._incChan(0, 1);
    if (A & CH3_HICLK) this._incChan(2, (A & CH34_JOINED) ? 7 : 4);
    else if (baseTrig) this._incChan(2, 1);
    if (baseTrig) {
      if (!(A & CH12_JOINED)) this._incChan(1, 1);
      if (!(A & CH34_JOINED)) this._incChan(3, 1);
    }

    if (this._checkBorrow(2)) {
      if (A & CH34_JOINED) this._incChan(3, 1); else this._resetChan(2);
      this._process(2);
      this.filter[0] = (A & CH1_FILTER) ? this.output[0] : 1;
    }
    if (this._checkBorrow(3)) {
      if (A & CH34_JOINED) this._resetChan(2);
      this._resetChan(3);
      this._process(3);
      this.filter[1] = (A & CH2_FILTER) ? this.output[1] : 1;
    }
    if (this._checkBorrow(0)) {
      if (A & CH12_JOINED) this._incChan(1, 1); else this._resetChan(0);
      this._process(0);
    }
    if (this._checkBorrow(1)) {
      if (A & CH12_JOINED) this._resetChan(0);
      this._resetChan(1);
      this._process(1);
    }
  }

  // Instantaneous analog level: sum of the volume nibbles of the channels whose gated output is high
  // (pokey.cpp m_out_raw). A channel contributes when (output XOR filter_sample) is set, or VOLUME_ONLY.
  level() {
    let sum = 0;
    for (let ch = 0; ch < 4; ch++) {
      if (((this.output[ch] ^ this.filter[ch]) !== 0) || (this.audc[ch] & VOLUME_ONLY)) {
        sum += this.audc[ch] & VOLUME_MASK;
      }
    }
    return sum;
  }
}

// The full 2x POKEY synth the browser + validation drive. write(addr,value) latches a memory-mapped write;
// render(out) fills a Float32 block for the current latched state.
export class Synth {
  constructor(sampleRate) {
    this.rate = sampleRate || 48000;
    this.chips = [new PokeyChip(), new PokeyChip()];
    this.clkAcc = 0;                    // fractional POKEY-clocks-per-sample accumulator
    this.hpX = 0; this.hpY = 0;         // DC-blocker (AC-couples the summed output)
    this.hpR = 1 - (2 * Math.PI * 15) / this.rate; // ~15 Hz high-pass corner
  }

  write(addr, value) {
    const chip = ((addr - POKEY1_BASE) >> 4) & 1;
    const reg = (addr - POKEY1_BASE) & 0x0f;
    if (chip < 0 || chip > 1 || reg > 9) return;
    this.chips[chip].write(reg, value);
  }

  render(out) {
    const cps = POKEY_CLOCK / this.rate; // ~31.5 POKEY clocks per output sample
    const c0 = this.chips[0], c1 = this.chips[1];
    for (let i = 0; i < out.length; i++) {
      this.clkAcc += cps;
      let steps = this.clkAcc | 0;
      this.clkAcc -= steps;
      let acc = 0;
      if (steps <= 0) { acc = c0.level() + c1.level(); steps = 1; }
      else for (let s = 0; s < steps; s++) { c0.step(); c1.step(); acc += c0.level() + c1.level(); }
      const raw = acc / steps;         // box-averaged mix of both chips, 0..120
      const x = raw / 120;             // normalise to ~[0,1]
      // one-pole DC blocker: y = x - x[-1] + R*y[-1]
      const y = x - this.hpX + this.hpR * this.hpY;
      this.hpX = x; this.hpY = y;
      out[i] = Math.max(-1, Math.min(1, y * MASTER_GAIN));
    }
    return out;
  }
}
