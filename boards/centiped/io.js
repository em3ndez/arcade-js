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

// ER2055 EAROM -- GI 64x8 electrically-alterable ROM (high-score NVRAM). Fresh = 0xff. Erase-before-write
// (a write ANDs into the cell); reads latch on the CLK falling edge with C1. mame-src/.../machine/er2055.cpp.
class Er2055 {
  constructor() {
    this.cells = new Uint8Array(64).fill(0xff); // fresh nvram
    this.addr = 0;     // 6-bit address latch
    this.latch = 0xff; // data latch == read output
    this.cs1 = 0; this.cs2 = 0; this.c1 = 0; this.c2 = 0; this.ck = 0;
  }
  setAddress(a) { this.addr = a & 0x3f; }
  setData(d) { this.latch = d & 0xff; }
  read() { return this.latch; }
  setControl(cs1, cs2, c1, c2) {
    const changed = cs1 !== this.cs1 || cs2 !== this.cs2 || c1 !== this.c1 || c2 !== this.c2;
    this.cs1 = cs1; this.cs2 = cs2; this.c1 = c1; this.c2 = c2;
    if (!(cs1 && cs2) || !changed) return; // updates only while both chip-selects are high and state moved
    this._update();
  }
  setClk(state) {
    const old = this.ck;
    this.ck = state ? 1 : 0;
    if (this.cs1 && this.cs2 && this.ck !== old && !state) { // falling edge, selected
      if (this.c1) this.latch = this.cells[this.addr]; // read mode (C2 don't care)
      this._update();
    }
  }
  _update() {
    if (!this.c1 && !this.c2) this.cells[this.addr] &= this.latch; // write (erase-before-write AND)
    else if (this.c2 && !this.c1) this.cells[this.addr] = 0xff; // erase
  }
  clone() {
    const e = new Er2055();
    e.cells.set(this.cells);
    e.addr = this.addr; e.latch = this.latch;
    e.cs1 = this.cs1; e.cs2 = this.cs2; e.c1 = this.c1; e.c2 = this.c2; e.ck = this.ck;
    return e;
  }
}

// POKEY poly-counter RNG tables (RANDOM register, mame-src/.../sound/pokey.cpp poly_init_9_17). Lazy, shared.
let POLY17 = null;
let POLY9 = null;
function poly17Table() {
  if (POLY17) return POLY17;
  const n = 0x1ffff;
  const t = new Uint8Array(n);
  let lfsr = n;
  for (let i = 0; i < n; i++) {
    const in8 = (((lfsr >> 8) & 1) ^ ((lfsr >> 13) & 1)) & 1;
    const in0 = lfsr & 1;
    lfsr = lfsr >>> 1;
    lfsr = (lfsr & 0xff7f) | (in8 << 7);
    lfsr = ((in0 << 16) | lfsr) >>> 0;
    t[i] = (lfsr >> 8) & 0xff; // RANDOM read = (poly17>>8)&0xff
  }
  POLY17 = t;
  return t;
}
function poly9Table() {
  if (POLY9) return POLY9;
  const n = 0x1ff;
  const t = new Uint8Array(n);
  let lfsr = n;
  for (let i = 0; i < n; i++) {
    const in0 = ((lfsr & 1) ^ ((lfsr >> 5) & 1)) & 1;
    lfsr = ((in0 << 8) | (lfsr >>> 1)) & 0x1ff;
    t[i] = lfsr & 0xff;
  }
  POLY9 = t;
  return t;
}

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
    // POKEY RANDOM phase (cross-validated vs MAME): a $100A read latches the poly at the PREVIOUS pokey
    // access's clock; p17 counts from the SKCTL(reg 0x0F) SK_RESET(0x03) enable. See ARCADE2-RESUME.md.
    this.pokeyC0 = null; // m.cycles when SK_RESET enabled the counter (p17 origin); null = held at 0
    this.pokeyLastAccess = 0; // m.cycles of the previous pokey access (read $100A or write $1000-$100F)

    this.inputAssert = null; // {port: pressedBits} per frame (ports in PORT_ADDRS)

    this.earom = new Er2055(); // high-score NVRAM (0x1600-0x163F W / 0x1680 ctrl / 0x1700-0x173F R)
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
  pokeyWrite(reg, value, cycle = 0) {
    this.pokeyReg[reg & 0x0f] = value & 0xff;
    if ((reg & 0x0f) === 0x0f) { // SKCTL: low 2 bits (SK_RESET) gate the poly counter
      if ((value & 0x03) === 0x03) { if (this.pokeyC0 === null) this.pokeyC0 = cycle >>> 0; }
      else this.pokeyC0 = null; // SK_RESET cleared -> p17 held at 0 until re-enabled
    }
    this.pokeyLastAccess = cycle >>> 0; // a write is a pokey access/sync point too
    if (this.onSoundWrite) this.onSoundWrite(0x1000 + (reg & 0x0f), value & 0xff);
  }

  // ---- EAROM (ER2055) -- earom_write / earom_control_w / earom_read ----------------------
  earomWrite(offset, value) { this.earom.setAddress(offset & 0x3f); this.earom.setData(value); }
  earomControl(value) {
    // earom_control_w: set_control(bit3, 1, !bit1, bit2), set_clk(bit0)
    this.earom.setControl((value >> 3) & 1, 1, ((value >> 1) & 1) ? 0 : 1, (value >> 2) & 1);
    this.earom.setClk(value & 1);
  }
  earomRead() { return this.earom.read(); }

  // POKEY RANDOM ($100A): poly-counter RNG (poly17, or poly9 if AUDCTL POLY9). A read returns the poly at the
  // PREVIOUS pokey access's clock (MAME synchronize() timing); p17 counts from the SKCTL SK_RESET enable (C0).
  // Phase cross-validated vs MAME (gameplay reads exact); the ~2/48 misses are unmodeled scheduler-quantum lag.
  pokeyRandom(cycle) {
    const t = (this.pokeyReg[8] & 0x80) ? poly9Table() : poly17Table();
    // Value is the poly at the PREVIOUS access's clock (MAME synchronize() timing); p17 origin = C0.
    const p = this.pokeyC0 === null ? 0 : (((this.pokeyLastAccess - this.pokeyC0) % t.length) + t.length) % t.length;
    const v = t[p];
    this.pokeyLastAccess = cycle >>> 0; // this read is now the latest access
    return v;
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
    this.pokeyC0 = other.pokeyC0;
    this.pokeyLastAccess = other.pokeyLastAccess;
    this.earom = other.earom.clone();
    this.inputAssert = other.inputAssert;
  }
}

// web/worker.js constructs one board `Inputs` per Machine (galaxian holds no separate input state; the
// worker writes machine.io.inputAssert / applyTrackball each frame). Exists to satisfy `new Inputs()`.
export class Inputs {}
