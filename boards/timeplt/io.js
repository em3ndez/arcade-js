// SPDX-License-Identifier: GPL-3.0-only
/**
 * Time Pilot I/O (MAME konami/timeplt.cpp). READ and WRITE at one address are different devices:
 *   0xC000  R scanline counter / W sound data to the audio Z80   ·   0xC200  R DSW1 / W watchdog reset.
 * Inputs ACTIVE LOW, idle 0xFF (a press clears its bit). Audio is recorded for the write-diff, not modelled.
 */

/** Thrown where the model has no answer yet. Loud beats plausible: a stub 0 makes the state diff blame the CPU. */
export class NotImplemented extends Error {
  constructor(what) {
    super(`not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}

/** LS259 B3 outputs, one per latch bit. Bit index = (addr - 0xC300) >> 1. */
export const LATCH_NMI_ENABLE = 0;
export const LATCH_FLIPSCREEN = 1; // inverted in MAME: q=0 means flip
export const LATCH_AUDIO_IRQ = 2;
export const LATCH_AUDIO_MUTE = 3;
export const LATCH_VIDEO_ENABLE = 4;
export const LATCH_COIN_COUNTER_0 = 5;
export const LATCH_COIN_COUNTER_1 = 6;
export const LATCH_UNUSED_PAYOUT = 7;

/** The three readable input ports. A tape key outside this set is an error, not a no-op. */
export const PORT_ADDRS = new Set([0xc300, 0xc320, 0xc340]);

/** Idle (nothing pressed) values, measured from MAME under -noreadconfig. */
export const IDLE_IN0 = 0xff;
export const IDLE_IN1 = 0xff;
export const IDLE_IN2 = 0xff;
export const IDLE_DSW0 = 0xff;
export const IDLE_DSW1 = 0x4b;

export class Io {
  constructor() {
    this.in0 = IDLE_IN0;
    this.in1 = IDLE_IN1;
    this.in2 = IDLE_IN2;
    this.dsw0 = IDLE_DSW0;
    this.dsw1 = IDLE_DSW1;

    // LS259 outputs, all clear at power-on (74259 device_reset); the ROM writes bits 0-4 at boot, 5-6 on coins, 7 never.
    this.latch = new Uint8Array(8);

    this.soundData = 0;
    this.watchdogKicks = 0;

    // Set by the web worker to the audio sink; the 0xC000 write is notified through it to play a clip. null offline -> plain store.
    this.onSoundWrite = null;

    // Read at 0xC000; NOT advanced here -- the Machine supplies a cycle-derived accessor, so a routine
    // compared in isolation must set the raster phase itself.
    this.scanline = 0;
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

  readIn0() { return (this.in0 & ~this._pressed(0xc300)) & 0xff; }
  readIn1() { return (this.in1 & ~this._pressed(0xc320)) & 0xff; }
  readIn2() { return (this.in2 & ~this._pressed(0xc340)) & 0xff; }
  readDsw0() { return this.dsw0 & 0xff; }
  readDsw1() { return this.dsw1 & 0xff; }
  readScanline() { return this.scanline & 0xff; }

  /** Copy another Io's value-state onto this one. Used when a Machine is cloned. */
  loadStateFrom(other) {
    this.in0 = other.in0;
    this.in1 = other.in1;
    this.in2 = other.in2;
    this.dsw0 = other.dsw0;
    this.dsw1 = other.dsw1;
    this.latch.set(other.latch);
    this.soundData = other.soundData;
    this.watchdogKicks = other.watchdogKicks;
    this.scanline = other.scanline;
    this.inputAssert = other.inputAssert;
  }

  writeSoundData(value) {
    this.soundData = value & 0xff;
    // Notify the audio layer (the player keys off this 0xC000 write; the ROM's paired 0xC304 edge is not needed here). Inert offline.
    if (this.onSoundWrite) this.onSoundWrite(0xc000, this.soundData);
  }
  kickWatchdog() { this.watchdogKicks++; }

  writeControlLatch(bit, value) { this.latch[bit & 7] = value & 1; }

  /** NMI asserted on vblank while this bit is set (timeplt vblank_irq). MUST be spelled `nmiMask`: the
   * shared engines read the gate by that name; any other spelling reads undefined/falsy, so a cycle-free
   * run silently returns 0 frames. Measured -- one name, not two. */
  get nmiMask() { return this.latch[LATCH_NMI_ENABLE] === 1; }

  get flipScreen() { return this.latch[LATCH_FLIPSCREEN] === 0; }

  get videoEnabled() { return this.latch[LATCH_VIDEO_ENABLE] === 1; }
}
