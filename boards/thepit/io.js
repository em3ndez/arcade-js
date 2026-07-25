// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit I/O devices (FIRST DRAFT): input ports, the LS259 control latch, the
 * watchdog, and the sound latch. Bit maps from MAME src/mame/taito/roundup.cpp.
 *
 * Like the DK model, every stub THROWS rather than silently accepting — an
 * unimplemented device that quietly returns 0 is indistinguishable from a correct
 * one until a pixel diff fails hundreds of frames later.
 *
 * The Pit has NO i8257 DMA (sprites render straight from sprite RAM), so this is
 * much simpler than DK's I/O.
 */

export class NotImplemented extends Error {
  constructor(what) {
    super(`not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}

/**
 * The watchdog. Reading 0xB800 resets it — the READ is the kick; the write side of
 * 0xB800 is the sound latch. The Pit's main loop / NMI reads 0xB800, so it is fed in
 * normal operation. UNVERIFIED: timeoutFrames is a PLACEHOLDER — get the real count
 * out of the driver before this becomes load-bearing.
 */
export class Watchdog {
  constructor(timeoutFrames = 16) {
    this.timeoutFrames = timeoutFrames;
    this.framesSinceKick = 0;
    this.enabled = true;
  }
  kick() {
    this.framesSinceKick = 0;
  }
  tickFrame() {
    if (!this.enabled) return false;
    return ++this.framesSinceKick >= this.timeoutFrames; // true => reset the machine
  }
}

export class Io {
  constructor() {
    // Raw port bytes, defaulted to "nothing pressed":
    //   IN0 joystick+dig is ACTIVE LOW  -> unpressed bits are 1 (0xFF)
    //   IN1 coin/start   is ACTIVE HIGH -> unpressed bits are 0 (0x00)
    //   IN2 is the cocktail 2P mux twin of IN0 (ACTIVE LOW)
    this.in0 = 0xff;
    this.in1 = 0x00;
    this.in2 = 0xff;
    // DSW default = all MAME default dip settings (1C_1C, fast, long time, no flip,
    // upright, 3 lives, tests off) = 0x00. Set to match the golden's -dipswitch config.
    this.dsw = 0x00;

    // LS259 control latch (IC42), 8 bits. Bit meanings from the driver:
    //   b0 NMI mask · b2 coin lockout · b3 sound enable · b6 flip-X + input mux select · b7 flip-Y
    this.latch = 0x00;

    this.watchdog = new Watchdog();
    this.soundLatch = 0x00; // command to the (deferred) audio Z80
  }

  // -- reads --------------------------------------------------------------
  readIn0() {
    // LS157 mux: latch b6 selects IN0 (upright) vs IN2 (cocktail flipped).
    return (this.latch & 0x40) ? this.in2 : this.in0;
  }
  readIn1() {
    return this.in1;
  }
  readDsw() {
    return this.dsw;
  }
  readWatchdog() {
    this.watchdog.kick(); // the read IS the kick — side effect, not a pure value
    return 0xff; // the returned byte is discarded by the game
  }

  // -- writes -------------------------------------------------------------
  /** LS259 addressable latch: one bit per address 0xB000..0xB007, data on d0. */
  writeControlLatch(bit, value) {
    if (value) this.latch |= 1 << bit;
    else this.latch &= ~(1 << bit) & 0xff;
  }
  writeSoundLatch(value) {
    this.soundLatch = value & 0xff; // audio deferred — just latch it
  }

  // -- derived control lines (read by the machine) ------------------------
  get nmiMask() {
    return (this.latch & 0x01) !== 0; // b0
  }
  get flipX() {
    return (this.latch & 0x40) !== 0; // b6
  }
  get flipY() {
    return (this.latch & 0x80) !== 0; // b7
  }
}
