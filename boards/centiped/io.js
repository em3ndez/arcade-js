// SPDX-License-Identifier: GPL-3.0-only
// Atari Centipede I/O: DSW/input ports, trackball counters, LS259 outlatch, IRQ line, POKEY sink.
// Grounded in MAME atari/centiped.cpp: INPUT_PORTS(centiped)@1047, read_trackball@518, centiped_IN0_r@545,
// centiped_IN2_r@551, LS259 wiring@1784-1816, irq_ack_w@487, generate_interrupt@434.
//
// Polarities are MIXED (unlike galaxian's all-active-high), so each port folds its own way:
//  - IN1 / IN3 are ACTIVE-LOW: idle 0xFF, a pressed bit CLEARS (AND-NOT the io.inputAssert bits).
//  - IN0 mixes trackball data (active-high, from the counters) with switch bits 4-6: Cabinet DIP (bit4),
//    Service (bit5, ACTIVE-LOW so idle set), VBLANK (bit6, ACTIVE-HIGH, driven by the Machine).
//  - IN2 is trackball-Y data only (switch bits 4-6 are IPT_UNKNOWN, idle 0).
// The trackball is analog: per-axis 4-bit counter + a latched sign bit (read_trackball). The Machine
// feeds motion via applyTrackball(); the counter/sign are io STATE the reads fold in.

export class NotImplemented extends Error {
  constructor(what) {
    super(`not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}

// DIP idle defaults, MAME DIPSETTING defaults (INPUT_PORTS centiped): DSW1 0x54 (English/3 lives/12k/easy),
// DSW2 0x02 (1C/1C). Cabinet 0 = upright. Active-low ports idle all-high.
export const IDLE_DSW1 = 0x54;
export const IDLE_DSW2 = 0x02;
export const IDLE_IN1 = 0xff;
export const IDLE_IN3 = 0xff;

// io.inputAssert ports the tape/--input may drive (digital only; trackball uses applyTrackball).
// 0 = IN0 switch bits (service, bit5), 1 = IN1 buttons/coins, 3 = IN3 cocktail joystick.
export const PORT_ADDRS = new Set([0, 1, 3]);

export class Io {
  constructor() {
    this.dsw1 = IDLE_DSW1;
    this.dsw2 = IDLE_DSW2;
    this.in1 = IDLE_IN1;
    this.in3 = IDLE_IN3;
    this.cabinet = 0; // IN0 bit4: 0 upright, 1 cocktail

    // Trackball counters (read_trackball): 8-bit accumulator per axis, low nibble read; sign is bit7 of
    // the last delta, latched until the next move. idx X=0, Y=1 (P1); cocktail P2 axes not modelled here.
    this.trackX = 0;
    this.trackY = 0;
    this.signX = 0; // 0 or 0x80
    this.signY = 0;

    // VBLANK bit (IN0 bit6, active-high). The Machine sets this from the raster position each frame.
    this.vblank = 0;

    // LS259 outlatch (write_d7): q0-q2 coin counters, q3-q4 LEDs(inv), q7 flip_screen. q5,q6 unused.
    this.latch = new Uint8Array(8);

    // 6502 IRQ line (level-triggered). The Machine asserts/clears it on the 32V scanline schedule; the
    // ROM acks by writing 0x1800 (ackIrq). MACHINE_RESET clears it.
    this.irqAsserted = false;

    // POKEY (0x1000-0x100F): NOT emulated (§5). Latest register values + a nullable audio sink, like
    // galaxian's discrete-sound recording -- headless runs stay byte-identical.
    this.pokeyReg = new Uint8Array(16);
    this.onSoundWrite = null; // (addr, value) sink; null offline

    this.inputAssert = null; // {port: pressedBits} per frame (ports in PORT_ADDRS)
  }

  _pressed(port) {
    if (!this.inputAssert) return 0;
    for (const k of Object.keys(this.inputAssert)) {
      if (!PORT_ADDRS.has(Number(k))) {
        throw new NotImplemented(`--input port ${k}: not a digital port (0,1,3; trackball uses applyTrackball)`);
      }
    }
    return this.inputAssert[port] || 0;
  }

  // IN0 = (switch bits 4-6) | trackball-X nibble | sign. Service (bit5) active-low: idle set, press clears.
  readIn0() {
    const sw =
      (this.cabinet ? 0x10 : 0) |
      (this._pressed(0) & 0x20 ? 0 : 0x20) |
      (this.vblank ? 0x40 : 0);
    return ((sw & 0x70) | (this.trackX & 0x0f) | this.signX) & 0xff;
  }

  // IN1 / IN3 active-low: a pressed bit clears over the idle byte.
  readIn1() { return (this.in1 & ~this._pressed(1)) & 0xff; }
  readIn3() { return (this.in3 & ~this._pressed(3)) & 0xff; }

  // IN2 = trackball-Y nibble | sign (switch bits idle 0).
  readIn2() { return ((this.trackY & 0x0f) | this.signY) & 0xff; }

  /** Apply one frame of trackball motion for axis 0=X / 1=Y (read_trackball counter + sign latch). */
  applyTrackball(axis, delta) {
    if (!delta) return;
    if (axis === 0) {
      const np = (this.trackX + delta) & 0xff;
      this.signX = (np - this.trackX) & 0x80;
      this.trackX = np;
    } else {
      const np = (this.trackY + delta) & 0xff;
      this.signY = (np - this.trackY) & 0x80;
      this.trackY = np;
    }
  }

  // ---- LS259 outlatch (memory.js 0x1C00-0x1C07 write_d7) ---------------------------------
  setLatch(bit, d7) { this.latch[bit & 7] = d7 & 1; }
  get flipScreen() { return this.latch[7] === 1; } // q7 -> flip_screen_w
  get coinCounters() { return [this.latch[0], this.latch[1], this.latch[2]]; } // q0-q2

  // ---- 6502 IRQ line (Machine drives assert/clear; ROM acks via 0x1800) -----------------
  setIrq(state) { this.irqAsserted = !!state; }
  ackIrq() { this.irqAsserted = false; }

  // ---- POKEY writes (recorded, not modelled; §5) ----------------------------------------
  pokeyWrite(reg, value) {
    this.pokeyReg[reg & 0x0f] = value & 0xff;
    if (this.onSoundWrite) this.onSoundWrite(0x1000 + (reg & 0x0f), value & 0xff);
  }

  loadStateFrom(other) {
    this.dsw1 = other.dsw1; this.dsw2 = other.dsw2;
    this.in1 = other.in1; this.in3 = other.in3;
    this.cabinet = other.cabinet;
    this.trackX = other.trackX; this.trackY = other.trackY;
    this.signX = other.signX; this.signY = other.signY;
    this.vblank = other.vblank;
    this.latch = other.latch.slice();
    this.irqAsserted = other.irqAsserted;
    this.pokeyReg = other.pokeyReg.slice();
    this.inputAssert = other.inputAssert;
  }
}

// web/worker.js constructs one board `Inputs` per Machine (galaxian holds no separate input state; the
// worker writes machine.io.inputAssert / applyTrackball each frame). Exists to satisfy `new Inputs()`.
export class Inputs {}
