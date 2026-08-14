// SPDX-License-Identifier: GPL-3.0-only
/**
 * Frogger I/O (MAME galaxian/galaxian.cpp). NEW vs our konami/ boards: all I/O runs through TWO i8255
 * PPIs (frogger_ppi8255_r/w@1142) plus five standalone D0 bus latches; no LS259 mainlatch, no DSW port.
 *
 * ★ THE i8255 IS THE #1 BOOT-KILLER: in mode 0 each port's DIRECTION comes from the control register
 * (reset control=0x9B, ALL INPUT, i8255.cpp:265). The ROM writes control words at boot to make PPI1 A/B
 * outputs; a wrong direction model misroutes input reads or sound-latch writes and it never boots.
 * Inputs are IP_ACTIVE_LOW (galaxian.cpp:5228-5269).
 *
 * WIRING: PPI0.A/B/C = IN0/IN1/IN2 (in); PPI1.A = out sound-command latch; PPI1.B = out
 * konami_sound_control_w (@855: FALLING edge of bit3 = audio /INT, bit4 = mute); PPI1.C = IN3 (0x00).
 * Standalone D0 latches (frogger_map@2423-2427): B808 irq_enable(->nmiMask), B80C flip_y, B810 flip_x,
 * B818/B81C coin -- flip is DIRECT D0, NOT inverted (v.cpp:670,681).
 */

/** Thrown where the model has no answer yet. Loud beats plausible: a stub 0 makes the state diff blame the CPU. */
export class NotImplemented extends Error {
  constructor(what) {
    super(`not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}

export const CONTROL_RESET = 0x9b;

// i8255 control-word direction bits (i8255.cpp:52-58). A set bit == that port/half is INPUT.
export const CTRL_PORT_C_LOWER_INPUT = 0x01;
export const CTRL_PORT_B_INPUT = 0x02;
export const CTRL_PORT_C_UPPER_INPUT = 0x08;
export const CTRL_PORT_A_INPUT = 0x10;
export const CTRL_MODE_SET = 0x80;

/**
 * A minimal-but-correct Intel 8255 in mode 0 (plus mode-set / bit-set-reset control words) -- Frogger
 * uses nothing else. Ports A/B/C hold output latches; the control register holds the direction word.
 * Per-method behaviour is commented at read()/write() below.
 */
export class I8255 {
  constructor({ readPort, writePort } = {}) {
    // readPort(port): input pin byte (INPUT ports only). writePort(port,value): fired on OUTPUT latch write.
    this.readPort = readPort || (() => 0xff);
    this.writePort = writePort || (() => {});
    this.control = CONTROL_RESET;
    this.output = new Uint8Array(3);
  }

  portAIsInput() { return (this.control & CTRL_PORT_A_INPUT) !== 0; }
  portBIsInput() { return (this.control & CTRL_PORT_B_INPUT) !== 0; }
  portCUpperIsInput() { return (this.control & CTRL_PORT_C_UPPER_INPUT) !== 0; }
  portCLowerIsInput() { return (this.control & CTRL_PORT_C_LOWER_INPUT) !== 0; }

  read(port) {
    switch (port & 3) {
      case 0: return this.portAIsInput() ? (this.readPort(0) & 0xff) : this.output[0];
      case 1: return this.portBIsInput() ? (this.readPort(1) & 0xff) : this.output[1];
      case 2: return this._readPortC();
      default: return this.control & 0xff; // read(CONTROL) returns the control word (i8255.cpp:732)
    }
  }

  /** read_pc (i8255.cpp:342): per-nibble source -- input nibbles read pins, output nibbles read latch. */
  _readPortC() {
    const pins = this.readPort(2) & 0xff;
    let data = 0;
    data |= this.portCUpperIsInput() ? (pins & 0xf0) : (this.output[2] & 0xf0);
    data |= this.portCLowerIsInput() ? (pins & 0x0f) : (this.output[2] & 0x0f);
    return data & 0xff;
  }

  write(port, data) {
    data &= 0xff;
    switch (port & 3) {
      case 0: // write_mode0(A): latch + fire ONLY if OUTPUT; input writes are dropped (i8255.cpp:438)
        if (!this.portAIsInput()) { this.output[0] = data; this.writePort(0, data); }
        return;
      case 1:
        if (!this.portBIsInput()) { this.output[1] = data; this.writePort(1, data); }
        return;
      case 2: // port C write always latches the full byte + fires output_pc (i8255.cpp:730)
        this.output[2] = data;
        this.writePort(2, data);
        return;
      default:
        if (data & CTRL_MODE_SET) this._setMode(data);
        else this._bitSetReset(data);
        return;
    }
  }

  /** set_mode (i8255.cpp:570-633): latch directions, CLEAR all output latches to 0, fire now-OUTPUT ports with 0. */
  _setMode(data) {
    this.control = data & 0xff;
    this.output[0] = 0;
    this.output[1] = 0;
    this.output[2] = 0;
    if (!this.portAIsInput()) this.writePort(0, 0);
    if (!this.portBIsInput()) this.writePort(1, 0);
    // output_pc() always fires for port C; inert for Frogger's wiring (konami_portc_*_w just logs).
    this.writePort(2, 0);
  }

  /** Bit set/reset of port C (control bit7=0): bit=(d>>1)&7, state=d&1 (i8255.cpp:635-700,790). */
  _bitSetReset(data) {
    const bit = (data >> 1) & 7;
    const state = data & 1;
    this.output[2] = (this.output[2] & ~(1 << bit)) | (state << bit);
    this.writePort(2, this.output[2]);
  }

  loadStateFrom(other) {
    this.control = other.control;
    this.output.set(other.output);
  }
}

/** The three readable input ports (PPI0.A/B/C), keyed by PPI-window read address. A tape key outside
 * this set throws (not a no-op). IN3 (0xD004) has no live inputs, so it is not a tape target. */
export const PORT_IN0 = 0xe000;
export const PORT_IN1 = 0xe002;
export const PORT_IN2 = 0xe004;
export const PORT_ADDRS = new Set([PORT_IN0, PORT_IN1, PORT_IN2]);

/**
 * Idle (nothing pressed) values. All input bits are IP_ACTIVE_LOW; the dip bits are INTERLEAVED into
 * IN1/IN2 (no separate DSW port), so those idle at their dipsetting: IN0=0xFF, IN1=0xFC (Lives 3),
 * IN2=0xF1 (Coinage 1/1, upright), IN3=0x00. ★ DERIVED from DIPSETTING defaults, NOT measured -- CONFIRM.
 */
export const IDLE_IN0 = 0xff;
export const IDLE_IN1 = 0xfc;
export const IDLE_IN2 = 0xf1;
export const IDLE_IN3 = 0x00;

// Live-input marker the web worker hands to the Machine; frogger uses io.inputAssert, so it is unread.
export class Inputs {}

export class Io {
  constructor() {
    this.in0 = IDLE_IN0;
    this.in1 = IDLE_IN1;
    this.in2 = IDLE_IN2;
    this.in3 = IDLE_IN3;

    // Standalone D0 latches (frogger_map@2423-2427), all clear at power-on (see header for addresses).
    this.irqEnable = 0;
    this.flipX = 0;
    this.flipY = 0;
    this.coinCounters = new Uint8Array(2);

    // Sound-command surface (PPI1.A latch byte + PPI1.B control edge). Recorded, not modelled.
    this.soundData = 0;
    this.soundControl = 0;
    this.soundTriggers = 0;
    this.mute = 0;

    this.onSoundWrite = null; // set by the web worker to the audio sink; PPI1.A/B writes notify it. null offline.

    this.ppi0 = new I8255({
      readPort: (p) => (p === 0 ? this.readIn0() : p === 1 ? this.readIn1() : this.readIn2()),
      writePort: () => {}, // PPI0 A/B are inputs; C-out = konami_portc_0_w (logs only, inert)
    });
    this.ppi1 = new I8255({
      readPort: (p) => (p === 2 ? this.readIn3() : 0xff),
      writePort: (p, v) => {
        if (p === 0) this._soundLatchWrite(v);
        else if (p === 1) this._soundControlWrite(v);
      },
    });
  }

  // Pressed bits per port (set per frame by Machine.applyInputs), inverted here so a tape reads as MAME's; an unknown key throws.
  inputAssert = null;

  _pressed(addr) {
    if (!this.inputAssert) return 0;
    for (const k of Object.keys(this.inputAssert)) {
      if (!PORT_ADDRS.has(Number(k))) {
        throw new NotImplemented(`--input port 0x${Number(k).toString(16)}: not an input port`);
      }
    }
    return this.inputAssert[addr] || 0;
  }

  readIn0() { return (this.in0 & ~this._pressed(PORT_IN0)) & 0xff; }
  readIn1() { return (this.in1 & ~this._pressed(PORT_IN1)) & 0xff; }
  readIn2() { return (this.in2 & ~this._pressed(PORT_IN2)) & 0xff; }
  readIn3() { return this.in3 & 0xff; }

  ppiRead(idx, port) { return (idx === 0 ? this.ppi0 : this.ppi1).read(port); }
  ppiWrite(idx, port, value) { (idx === 0 ? this.ppi0 : this.ppi1).write(port, value); }

  _soundLatchWrite(v) {
    this.soundData = v & 0xff;
    if (this.onSoundWrite) this.onSoundWrite(0xd000, this.soundData);
  }

  _soundControlWrite(v) {
    v &= 0xff;
    const old = this.soundControl;
    this.soundControl = v;
    // konami_sound_control_w (galaxian.cpp:855): (old&8 && !(new&8)) => audio /INT; bit 4 = mute.
    if ((old & 0x08) && !(v & 0x08)) this.soundTriggers++;
    this.mute = (v & 0x10) ? 1 : 0;
    if (this.onSoundWrite) this.onSoundWrite(0xd002, v);
  }

  setIrqEnable(d0) { this.irqEnable = d0 & 1; }
  setFlipX(d0) { this.flipX = d0 & 1; }
  setFlipY(d0) { this.flipY = d0 & 1; }
  setCoinCounter(n, d0) { this.coinCounters[n & 1] = d0 & 1; }

  loadStateFrom(other) {
    this.in0 = other.in0;
    this.in1 = other.in1;
    this.in2 = other.in2;
    this.in3 = other.in3;
    this.irqEnable = other.irqEnable;
    this.flipX = other.flipX;
    this.flipY = other.flipY;
    this.coinCounters.set(other.coinCounters);
    this.soundData = other.soundData;
    this.soundControl = other.soundControl;
    this.soundTriggers = other.soundTriggers;
    this.mute = other.mute;
    this.inputAssert = other.inputAssert;
    this.ppi0.loadStateFrom(other.ppi0);
    this.ppi1.loadStateFrom(other.ppi1);
  }

  /** NMI on vblank while irq_enable (0xB808 D0) set. MUST be spelled `nmiMask` -- the shared engines read
   * the gate by that name; any other spelling reads falsy and a run silently returns 0 frames. */
  get nmiMask() { return this.irqEnable === 1; }

  get flipScreenX() { return this.flipX === 1; }
  get flipScreenY() { return this.flipY === 1; }
}
