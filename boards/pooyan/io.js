// SPDX-License-Identifier: GPL-3.0-only
// Pooyan I/O (konami/pooyan.cpp), forked from boards/timeplt/io.js. Key shape changes vs timeplt:
// the LS259 is 0xA180-0xA187 write_d0, ONE ADDRESS PER BIT (bit = addr & 7; NOT timeplt's addr>>1);
// there is NO video-enable bit (video always on); inputs are ACTIVE LOW (idle 0xFF); R and W at one
// address differ (0xA000 R=DSW1 / W=watchdog). Audio is recorded, not modelled.

/** Loud beats plausible: a stub 0 would make the state diff blame the CPU. */
export class NotImplemented extends Error {
  constructor(what) {
    super(`not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}

// LS259 B2 outputs, bit index = addr & 7 (pooyan.cpp:427-434). bit 6 unused.
export const LATCH_NMI_ENABLE = 0;
export const LATCH_AUDIO_IRQ = 1;
export const LATCH_AUDIO_MUTE = 2;
export const LATCH_COIN_COUNTER_0 = 3;
export const LATCH_COIN_COUNTER_1 = 4;
export const LATCH_PAYOUT = 5;
export const LATCH_FLIPSCREEN = 7; // q<7> INVERTED (.invert()): latch 0 => flipped

/** A tape key outside this set is an error, not a no-op. */
export const PORT_ADDRS = new Set([0xa080, 0xa0a0, 0xa0c0]);

// Idle: IN0/IN1/IN2 = 0xFF (all PORT_BITs active-low). DSW1 = 0x7B, OR of pooyan.cpp:345-368 dip
// defaults (Lives 3 / Upright / Bonus 50K / Easy / Demo on) — CONFIRM vs MAME. ★ DSW0 = 0xFF is a
// PLACEHOLDER: KONAMI_COINAGE_LOC default not derivable here; MEASURE from a MAME -noreadconfig run.
export const IDLE_IN0 = 0xff;
export const IDLE_IN1 = 0xff;
export const IDLE_IN2 = 0xff;
export const IDLE_DSW0 = 0xff; // ★ PLACEHOLDER -- UNMEASURED
export const IDLE_DSW1 = 0x7b;

// Live-input marker the worker hands the Machine; pooyan drives keys onto io.inputAssert, so unread.
export class Inputs {}

export class Io {
  constructor() {
    this.in0 = IDLE_IN0;
    this.in1 = IDLE_IN1;
    this.in2 = IDLE_IN2;
    this.dsw0 = IDLE_DSW0;
    this.dsw1 = IDLE_DSW1;

    this.latch = new Uint8Array(8); // LS259, all clear at power-on
    this.soundData = 0;
    this.watchdogKicks = 0;
    this.onSoundWrite = null; // web worker sets this to the audio sink; null offline
  }

  inputAssert = null; // pressed bits per port (set per frame by applyInputs), inverted here

  _pressed(addr) {
    if (!this.inputAssert) return 0;
    for (const k of Object.keys(this.inputAssert)) {
      if (!PORT_ADDRS.has(Number(k))) {
        throw new NotImplemented(`--input port 0x${Number(k).toString(16)}: not an input port`);
      }
    }
    return this.inputAssert[addr] || 0;
  }

  readIn0() { return (this.in0 & ~this._pressed(0xa080)) & 0xff; }
  readIn1() { return (this.in1 & ~this._pressed(0xa0a0)) & 0xff; }
  readIn2() { return (this.in2 & ~this._pressed(0xa0c0)) & 0xff; }
  readDsw0() { return this.dsw0 & 0xff; }
  readDsw1() { return this.dsw1 & 0xff; }

  loadStateFrom(other) {
    this.in0 = other.in0;
    this.in1 = other.in1;
    this.in2 = other.in2;
    this.dsw0 = other.dsw0;
    this.dsw1 = other.dsw1;
    this.latch.set(other.latch);
    this.soundData = other.soundData;
    this.watchdogKicks = other.watchdogKicks;
    this.inputAssert = other.inputAssert;
  }

  writeSoundData(value) {
    this.soundData = value & 0xff;
    if (this.onSoundWrite) this.onSoundWrite(0xa100, this.soundData); // player keys off the 0xA100 write
  }
  kickWatchdog() { this.watchdogKicks++; }

  writeControlLatch(bit, value) { this.latch[bit & 7] = value & 1; }

  /** MUST be spelled `nmiMask`: the shared engines read the vblank-NMI gate by that name; any other
   *  spelling reads falsy and a cycle-free run silently returns 0 frames. */
  get nmiMask() { return this.latch[LATCH_NMI_ENABLE] === 1; }

  get flipScreen() { return this.latch[LATCH_FLIPSCREEN] === 0; } // q<7> inverted
}
