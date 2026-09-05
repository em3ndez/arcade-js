// SPDX-License-Identifier: GPL-3.0-only
// Galaxian (Namco parent `galaxian`) I/O + control latches + discrete-sound sink. Grounded in MAME
// galaxian.cpp: galaxian_map_base@1746 (latches/port reads), galaxian_map_discrete@1739 (sound),
// INPUT_PORTS(galaxian)@3069, irq_enable_w@779, galaxian_stars_enable_w / flip_screen_*_w.
//
// The Z80 reaches this through the memory AddressSpace (memory.js), NOT an 8080 PORT space: read 0x6000/
// 0x6800/0x7000 -> portIn(0/1/2); writes to the single-byte latches call the setters below; sound-device
// writes (0x6004-0x6007 lfo, 0x6800-0x6807 sound, 0x7800 pitch) call soundLfoFreq/soundWrite/soundPitch.
//
// Inputs are all IP_ACTIVE_HIGH (a pressed bit reads 1 over the idle byte); no mixed polarity, so folding
// the tape's pressed bits is a plain OR. DIP bits live in the idle bytes (IN0 Cabinet, IN1 Coinage, IN2
// Bonus/Lives); idle values are the DIPSETTING defaults (hardware.json), pending a MAME-measured check.

export class NotImplemented extends Error {
  constructor(what) {
    super(`not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}

// Idle input bytes (nothing pressed), from INPUT_PORTS(galaxian) DIP defaults: IN0/IN1 all-0, IN2 Lives
// default 0x04 (= 3 lives). Bonus default 0x00 (7000), Coinage default 0x00 (1C/1C), Cabinet 0 (upright).
export const IDLE_IN0 = 0x00;
export const IDLE_IN1 = 0x00;
export const IDLE_IN2 = 0x04;

// Input ports the tape/--input may drive (the three read ports, keyed by index 0/1/2 = IN0/IN1/IN2).
export const PORT_ADDRS = new Set([0, 1, 2]);

export class Io {
  constructor() {
    this.in0 = IDLE_IN0;
    this.in1 = IDLE_IN1;
    this.in2 = IDLE_IN2;

    // Control latches (each a D0 flip-flop). irqEnable gates the vblank NMI; flip/stars feed the renderer.
    this.irqEnable = 0;
    this.starsEnable = 0;
    this.flipX = 0;
    this.flipY = 0;
    this.coinLock = 0;
    this.startLamp = [0, 0];
    this.coinCounter = [0, 0];

    // Discrete sound (galaxian_a.cpp): latest values, plus a nullable web-worker sink. NOT emulated --
    // recorded/replayed per §5. reg index space: lfo 0-3, sound 0-7, pitch (single).
    this.soundLfo = [0, 0, 0, 0];
    this.soundReg = new Uint8Array(8);
    this.soundPitchVal = 0;
    this.onSoundWrite = null; // (kind, reg, value) audio sink; null offline

    this.inputAssert = null; // {port: pressedBits} per frame (port in {0,1,2}); folded active-high in readInN
  }

  _pressed(port) {
    if (!this.inputAssert) return 0;
    for (const k of Object.keys(this.inputAssert)) {
      if (!PORT_ADDRS.has(Number(k))) {
        throw new NotImplemented(`--input port ${k}: not an input port (0,1,2 only)`);
      }
    }
    return this.inputAssert[port] || 0;
  }

  // All bits active-high: a pressed bit sets over the idle byte (DIP bits stay in idle).
  readIn0() { return (this.in0 | this._pressed(0)) & 0xff; }
  readIn1() { return (this.in1 | this._pressed(1)) & 0xff; }
  readIn2() { return (this.in2 | this._pressed(2)) & 0xff; }

  portIn(port) {
    switch (port) {
      case 0: return this.readIn0();
      case 1: return this.readIn1();
      case 2: return this.readIn2();
      default: throw new NotImplemented(`input port ${port}`);
    }
  }

  // ---- control latches (memory.js write8 dispatch) --------------------------------------
  setIrqEnable(d0) { this.irqEnable = d0 & 1; }
  setStarsEnable(d0) { this.starsEnable = d0 & 1; }
  setFlipX(d0) { this.flipX = d0 & 1; }
  setFlipY(d0) { this.flipY = d0 & 1; }
  setCoinLock(d0) { this.coinLock = d0 & 1; }
  setStartLamp(idx, d0) { this.startLamp[idx & 1] = d0 & 1; }
  setCoinCounter(idx, d0) { this.coinCounter[idx & 1] = d0 & 1; }

  // ---- discrete sound writes (recorded, not modelled) -----------------------------------
  soundLfoFreq(reg, value) {
    this.soundLfo[reg & 3] = value & 0xff;
    if (this.onSoundWrite) this.onSoundWrite("lfo", reg & 3, value & 0xff);
  }
  soundWrite(reg, value) {
    this.soundReg[reg & 7] = value & 0xff;
    if (this.onSoundWrite) this.onSoundWrite("sound", reg & 7, value & 0xff);
  }
  soundPitch(value) {
    this.soundPitchVal = value & 0xff;
    if (this.onSoundWrite) this.onSoundWrite("pitch", 0, value & 0xff);
  }

  /** The engine's vblank interrupt gate: the NMI is delivered only while irq_enable_w's D0 latch is set. */
  get nmiMask() { return this.irqEnable === 1; }

  /** Renderer-facing aliases (machine.js passes these as the video flipScreenX/Y opts). */
  get flipScreenX() { return this.flipX === 1; }
  get flipScreenY() { return this.flipY === 1; }

  loadStateFrom(other) {
    this.in0 = other.in0; this.in1 = other.in1; this.in2 = other.in2;
    this.irqEnable = other.irqEnable;
    this.starsEnable = other.starsEnable;
    this.flipX = other.flipX; this.flipY = other.flipY;
    this.coinLock = other.coinLock;
    this.startLamp = other.startLamp.slice();
    this.coinCounter = other.coinCounter.slice();
    this.soundLfo = other.soundLfo.slice();
    this.soundReg = other.soundReg.slice();
    this.soundPitchVal = other.soundPitchVal;
    this.inputAssert = other.inputAssert;
  }
}

// Web worker (web/worker.js) constructs one board `Inputs` per Machine. Galaxian holds no separate input
// state: the worker writes machine.io.inputAssert = {0:IN0,1:IN1,2:IN2} each frame, which readIn0/1/2 fold
// by OR (all active-high). This class exists to satisfy the worker's `new Inputs()` contract.
export class Inputs {}
