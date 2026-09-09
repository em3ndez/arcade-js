// SPDX-License-Identifier: GPL-3.0-only
// Centipede audio SYNTH -- centiped.cpp drives a single POKEY PSG straight off the 6502 (no sound CPU, no
// sample ROM), so audio is synthesised above the emulation (runbook §5 "datasheet-simple sound-chip
// device") from the POKEY register writes, not clip replay. Four INDEPENDENT voices, one per POKEY channel,
// each grounded from a MAME write-tap of a real play (scratchpad/deep_capture/tracked_deep.csv) and modelled
// off the chip logic in mame-src/src/devices/sound/pokey.cpp (process_channel@1209, poly_init@1355/1371,
// AUDCTL bit map@144-152). The SAME code runs in the browser (a ScriptProcessor pulls blocks) and in node
// for the per-voice null-mutant test -- re-derivable, no browser-only path.
//
// POKEY register file (memory-mapped 0x1000-0x100F; boards/centiped/io.js pokeyWrite -> onSoundWrite):
//   AUDF1..4  0x1000/2/4/6  per-channel frequency divider (event rate = clock / (AUDF + add))
//   AUDC1..4  0x1001/3/5/7  per-channel control: bits0-3 volume, bit4 volume-only, bits5-7 waveform select
//   AUDCTL    0x1008        global: clock base (64/15 kHz), 1.79 MHz per-channel fast clock, 16-bit link, poly9
//   SKCTL     0x100F        serial/keyboard control; bits0-1 (SK_RESET) release the poly counters at boot
//
// Waveform select, per AUDC bits 5-7 (pokey.cpp process_channel, the exact same branch order):
//   NOTPOLY5 0x80 : set => poly5 does NOT gate the clock; clear => the clock only passes when poly5's bit is 1
//   PURE     0x20 : set => output is a divide-by-2 flip-flop (a clean square tone)
//   POLY4    0x40 : (PURE clear) set => output tracks the 4-bit poly (a short buzzy tone); clear => the long
//                   17-bit poly (or 9-bit when AUDCTL bit7 set) -- i.e. hiss/noise
//   VOLUME_ONLY 0x10 : output is a steady DC level == volume (used for volume-envelope tricks)
//
// GROUNDED voice roles (values are the AUDC/AUDF captured in scratchpad/deep_capture/tracked_deep.csv):
//   V1 ch1  AUDC1=0x84/0x86 -> NOTPOLY5|<no PURE,no POLY4> = 17-bit poly NOISE, vol 4..6; AUDF1 0x00..0xF0.
//           The gunshot / centipede-hit noise burst.
//   V2 ch2  AUDC2=0xA4      -> NOTPOLY5|PURE = clean square TONE, vol 4; AUDF2 0x00..0xE0 (~120..2000 Hz).
//           The melodic marching / movement voice.
//   V3 ch3  AUDC3=0x64      -> POLY4 with poly5 gating (NOTPOLY5 clear) = gritty short-poly BUZZ, vol 4;
//           AUDF3 0x50..0xF0. AUDCTL bit5 (0x20, CH3_HICLK) clocks it off the raw 1.512 MHz -> a high buzz.
//   V4 ch4  AUDC4=0xA4      -> NOTPOLY5|PURE = clean square TONE, vol 4; AUDF4 0x05..0x35 (~500..4500 Hz).
//           The high blip / bonus-creature voice.
// AUDCTL was captured only as 0x20 (CH3_HICLK) and 0x00 -- clock base stays 64 kHz (bit0 clear), the 16-bit
// link bits (0x10/0x08) and poly9 (0x80) and the high-pass filter bits (0x04/0x02) all stay clear across the
// whole capture. Those dormant modes are still implemented below so the model voices every AUDCTL bit.

// ---- POKEY clocking (centiped.cpp:1821 -- POKEY(config,"pokey",12096000/8) = 1.512 MHz input) -----------
export const POKEY_CLOCK = 12096000 / 8; // 1,512,000 Hz feeding the chip
export const DIV_64 = 28;   // pokey.cpp:184 -- input/28 = the "64 kHz" base clock (here 54,000 Hz)
export const DIV_15 = 114;  // pokey.cpp:185 -- input/114 = the "15 kHz" base clock (here ~13,263 Hz)
export const CLOCK_64 = POKEY_CLOCK / DIV_64;
export const CLOCK_15 = POKEY_CLOCK / DIV_15;

// AUDC control bits (pokey.cpp:138-142)
const NOTPOLY5 = 0x80, POLY4 = 0x40, PURE = 0x20, VOLUME_ONLY = 0x10, VOLUME_MASK = 0x0f;
// AUDCTL bits (pokey.cpp:145-152)
const POLY9 = 0x80, CH1_HICLK = 0x40, CH3_HICLK = 0x20, CH12_JOINED = 0x10, CH34_JOINED = 0x08, CLK_15KHZ = 0x01;

export const MASTER_GAIN = 0.42; // 4 voices * (vol/15) summed, scaled toward MAME's mix level, clamped to [-1,1]

// Every sound-register address this synth latches (io.js taps 0x1000-0x100F and emits each of these).
export const REGS = {
  AUDF: [0x1000, 0x1002, 0x1004, 0x1006],
  AUDC: [0x1001, 0x1003, 0x1005, 0x1007],
  AUDCTL: 0x1008,
  SKCTL: 0x100f,
};

// ---- Poly counters (pokey.cpp poly_init_4_5@1355 / poly_init_9_17@1371) --------------------------------
// Built once, shared: each entry stores the bit process_channel samples (the table value & 1). Faithful to
// the exact LFSR taps so each noise voice carries POKEY's real texture (not a generic PRNG).
let POLY4T = null, POLY5T = null, POLY9T = null, POLY17T = null;
function polyInit45(size) {
  const mask = (1 << size) - 1, out = new Uint8Array(mask), xorbit = size - 1;
  let lfsr = 0;
  for (let i = 0; i < mask; i++) {
    lfsr = ((lfsr << 1) | ((~((lfsr >>> 2) ^ (lfsr >>> xorbit))) & 1)) >>> 0;
    out[i] = lfsr & 1; // process_channel reads m_poly[..] & 1
  }
  return out;
}
function polyInit17() {
  const mask = 0x1ffff, out = new Uint8Array(mask);
  let lfsr = mask;
  for (let i = 0; i < mask; i++) {
    const in8 = ((lfsr >>> 8) & 1) ^ ((lfsr >>> 13) & 1);
    const in0 = lfsr & 1;
    lfsr = lfsr >>> 1;
    lfsr = (lfsr & 0xff7f) | (in8 << 7);
    lfsr = ((in0 << 16) | lfsr) >>> 0;
    out[i] = lfsr & 1;
  }
  return out;
}
function polyInit9() {
  const mask = 0x1ff, out = new Uint8Array(mask);
  let lfsr = mask;
  for (let i = 0; i < mask; i++) {
    const in0 = (lfsr & 1) ^ ((lfsr >>> 5) & 1);
    lfsr = ((in0 << 8) | (lfsr >>> 1)) & 0x1ff;
    out[i] = lfsr & 1;
  }
  return out;
}
function polys() {
  if (!POLY4T) { POLY4T = polyInit45(4); POLY5T = polyInit45(5); POLY9T = polyInit9(); POLY17T = polyInit17(); }
  return { p4: POLY4T, p5: POLY5T, p9: POLY9T, p17: POLY17T };
}

export class CentipedSynth {
  constructor(sampleRate) {
    this.rate = sampleRate;
    // Latched register file (low nibble of 0x1000-0x100F).
    this.reg = new Uint8Array(16);
    // Per-voice run state: output flip-flop (0/1), fractional event accumulator, and per-voice poly indices
    // (each voice advances its own poly counters at its own clock -- the datasheet-simple model).
    this.out = [0, 0, 0, 0];
    this.acc = [0, 0, 0, 0];
    this.i4 = [0, 0, 0, 0];
    this.i5 = [0, 0, 0, 0];
    this.i9 = [0, 0, 0, 0];
    this.i17 = [0, 0, 0, 0];
    this.P = polys();
  }

  // Called by the adapter for every tapped sound write. Latches the POKEY register file; the render pass
  // reads the CURRENT latched state each block (a live parameterized synth, not an event queue).
  write(addr, value) {
    const off = addr - 0x1000;
    if (off < 0 || off > 0x0f) return;
    this.reg[off] = value & 0xff;
  }

  // The per-channel clock event rate (Hz): how often process_channel is invoked for this channel. Honours
  // the 64/15 kHz base, the per-channel 1.79 MHz fast clock (CH1/CH3 HICLK), and 16-bit channel linking.
  _eventRate(ch) {
    const audctl = this.reg[8];
    const base = (audctl & CLK_15KHZ) ? CLOCK_15 : CLOCK_64;
    const audf = (a) => this.reg[a];
    // 16-bit linked pairs: the HIGH channel of the pair carries the combined divider, the LOW channel is
    // muted (its counter only feeds the high one). Pairs: ch1(lo,idx0)+ch2(hi,idx1); ch3(lo,idx2)+ch4(hi,idx3).
    if ((audctl & CH12_JOINED) && (ch === 0 || ch === 1)) {
      if (ch === 0) return 0; // low channel of the link produces no sound
      const hi = (audctl & CH1_HICLK) ? POKEY_CLOCK : base;
      const add = (audctl & CH1_HICLK) ? 7 : 1;
      return hi / ((audf(0) + 256 * audf(2) + add) || 1);
    }
    if ((audctl & CH34_JOINED) && (ch === 2 || ch === 3)) {
      if (ch === 2) return 0;
      const hi = (audctl & CH3_HICLK) ? POKEY_CLOCK : base;
      const add = (audctl & CH3_HICLK) ? 7 : 1;
      return hi / ((audf(4) + 256 * audf(6) + add) || 1);
    }
    // Independent channel: base clock, or the raw 1.79 MHz (here 1.512 MHz) fast clock for ch1/ch3.
    const hiclk = (ch === 0 && (audctl & CH1_HICLK)) || (ch === 2 && (audctl & CH3_HICLK));
    const div = this.reg[REGS.AUDF[ch] - 0x1000];
    if (hiclk) return POKEY_CLOCK / (div + 4);
    return base / (div + 1);
  }

  // One clock event for a channel: reproduce pokey.cpp process_channel (same gate + same branch order).
  _clockChannel(ch) {
    const audc = this.reg[REGS.AUDC[ch] - 0x1000];
    const audctl = this.reg[8];
    // Advance this voice's poly phases one step (the counters run continuously in the chip).
    const P = this.P;
    this.i5[ch] = (this.i5[ch] + 1) % P.p5.length;
    this.i4[ch] = (this.i4[ch] + 1) % P.p4.length;
    this.i9[ch] = (this.i9[ch] + 1) % P.p9.length;
    this.i17[ch] = (this.i17[ch] + 1) % P.p17.length;
    // Gate: NOTPOLY5 set, or the poly5 bit is 1 (poly5 chops the clock into POKEY's gritty rhythm).
    if ((audc & NOTPOLY5) || (P.p5[this.i5[ch]] & 1)) {
      if (audc & PURE) this.out[ch] ^= 1;                 // clean square (divide by 2)
      else if (audc & POLY4) this.out[ch] = P.p4[this.i4[ch]] & 1;
      else if (audctl & POLY9) this.out[ch] = P.p9[this.i9[ch]] & 1;
      else this.out[ch] = P.p17[this.i17[ch]] & 1;
    }
  }

  // Fill `out` (Float32Array) with the next block for the CURRENT latched register state.
  render(out) {
    const rate = this.rate;
    // Precompute per-voice event increments (events per output sample) and volumes for this block.
    const inc = [0, 0, 0, 0], vol = [0, 0, 0, 0], volOnly = [false, false, false, false];
    for (let ch = 0; ch < 4; ch++) {
      const er = this._eventRate(ch);
      inc[ch] = er / rate;
      const audc = this.reg[REGS.AUDC[ch] - 0x1000];
      vol[ch] = (audc & VOLUME_MASK) / 15;
      volOnly[ch] = !!(audc & VOLUME_ONLY);
    }
    for (let i = 0; i < out.length; i++) {
      let s = 0;
      for (let ch = 0; ch < 4; ch++) {
        if (vol[ch] === 0) continue; // volume 0 -> this channel is silent
        if (volOnly[ch]) { s += vol[ch]; continue; } // steady DC level == volume
        this.acc[ch] += inc[ch];
        let steps = this.acc[ch] | 0;
        this.acc[ch] -= steps;
        if (steps > 64) steps = 64; // bound the inner loop (only reachable at ultrasonic dividers)
        for (let k = 0; k < steps; k++) this._clockChannel(ch);
        s += (this.out[ch] ? 1 : -1) * vol[ch];
      }
      out[i] = Math.max(-1, Math.min(1, s * MASTER_GAIN));
    }
    return out;
  }
}

// The web adapter (web/player.html setupSynthAudio) resolves the constructor generically; export a stable
// generic alias alongside the game-named class.
export const Synth = CentipedSynth;
