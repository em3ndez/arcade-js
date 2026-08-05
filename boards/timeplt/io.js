// SPDX-License-Identifier: GPL-3.0-only
/**
 * Time Pilot I/O devices.
 *
 * From MAME src/mame/konami/timeplt.cpp: the input ports, the LS259 mainlatch at B3,
 * the watchdog, and the scanline counter that shares 0xC000 with the sound-data write.
 *
 * THE READ AND THE WRITE AT ONE ADDRESS ARE DIFFERENT DEVICES:
 *   0xC000  read -> scanline counter        write -> sound data to the audio Z80
 *   0xC200  read -> DSW1                    write -> watchdog reset
 *
 * INPUTS ARE ACTIVE LOW and idle at 0xFF (measured from a MAME run with -noreadconfig:
 * IN0/IN1/IN2 and DSW0 all read 0xFF, DSW1 reads 0x4B). A pressed control CLEARS its bit.
 *
 * The audio side is not modelled here. Sound data and the audio IRQ trigger are recorded
 * so the write-diff can compare them, but nothing consumes them yet.
 */

/**
 * Thrown where the model has no answer yet -- an unresolved `rst 0x30` target, a device
 * this board has that nothing reads back. Loud beats plausible: a stub returning 0 is a
 * value the ROM will happily compute with, and the state diff then blames the CPU.
 */
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

    // LS259 outputs, all clear at power-on. That is the real part's behaviour, not an
    // assumption about the ROM: MAME's addressable_latch_device clears every output on
    // reset (74259.cpp device_reset). The ROM does NOT write them all -- boot writes
    // bits 0-4, coin handling writes 5 and 6, and bit 7 is never written anywhere.
    this.latch = new Uint8Array(8);

    this.soundData = 0;
    this.watchdogKicks = 0;

    // Read at 0xC000. The real counter advances with the raster, and this field does NOT.
    // The machine that drives this board replaces the accessor with one derived from its
    // cycle position in the frame; what is stored here is only the power-on default. A
    // routine run against this object alone sees a frozen counter, so a caller comparing
    // one routine in isolation must supply the raster phase or it is judging noise.
    this.scanline = 0;
  }

  readIn0() { return this.in0 & 0xff; }
  readIn1() { return this.in1 & 0xff; }
  readIn2() { return this.in2 & 0xff; }
  readDsw0() { return this.dsw0 & 0xff; }
  readDsw1() { return this.dsw1 & 0xff; }
  readScanline() { return this.scanline & 0xff; }

  writeSoundData(value) { this.soundData = value & 0xff; }
  kickWatchdog() { this.watchdogKicks++; }

  writeControlLatch(bit, value) { this.latch[bit & 7] = value & 1; }

  /** NMI is asserted on vblank only while this bit is set (timeplt_state::vblank_irq). */
  get nmiEnabled() { return this.latch[LATCH_NMI_ENABLE] === 1; }

  /** MAME inverts this output: q=0 means the screen IS flipped. */
  get flipScreen() { return this.latch[LATCH_FLIPSCREEN] === 0; }

  get videoEnabled() { return this.latch[LATCH_VIDEO_ENABLE] === 1; }
}
