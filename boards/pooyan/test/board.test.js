// SPDX-License-Identifier: GPL-3.0-only
/**
 * Pooyan board-hardware tests (board fork of Time Pilot, game #4).
 *
 * Subject: boards/pooyan/{memory,io}.js -- the memory map / mirror decode / unmapped-throws /
 * state-dump layout, and the io device split (DSW1 vs watchdog at 0xA000), watchdog kick,
 * sound latch, and the LS259 control latch (ONE address per bit). Pure logic, no ROM image
 * needed, so this runs on a fresh clone with NO Pooyan romset present -- which is the point:
 * it validates the decode against pooyan.cpp before the ROMs are available.
 * Run: node --test boards/pooyan/test/board.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  AddressSpace, UnmappedAccess, STATE_DUMP_SIZE,
  ROM_END, COLOR_RAM_BASE, VIDEO_RAM_BASE, WORK_RAM_BASE, SPRITE0_BASE, SPRITE1_BASE, SPRITE_SIZE,
} from "../memory.js";
import {
  Io, LATCH_NMI_ENABLE, LATCH_AUDIO_IRQ, LATCH_AUDIO_MUTE,
  LATCH_COIN_COUNTER_0, LATCH_COIN_COUNTER_1, LATCH_PAYOUT, LATCH_FLIPSCREEN,
} from "../io.js";

const rom = () => new Uint8Array(ROM_END + 1); // 32KB dummy program
const space = (io = new Io()) => new AddressSpace(rom(), io);

test("ROM must be exactly 32KB (0x0000-0x7FFF)", () => {
  assert.equal(ROM_END, 0x7fff);
  assert.throws(() => new AddressSpace(new Uint8Array(0x6000), new Io()), /32768-byte ROM/);
  assert.doesNotThrow(() => new AddressSpace(new Uint8Array(0x8000), new Io()));
});

test("state dump is 4608 bytes: color 1024 + video 1024 + work 2048 + sprite0 256 + sprite1 256", () => {
  assert.equal(STATE_DUMP_SIZE, 4608);
  assert.equal(space().dumpState().length, 4608);
});

test("dumpState / stateOffsetToAddr are inverse across every region boundary", () => {
  const m = space();
  const checks = [
    [0, COLOR_RAM_BASE], [1023, COLOR_RAM_BASE + 1023],
    [1024, VIDEO_RAM_BASE], [2047, VIDEO_RAM_BASE + 1023],
    [2048, WORK_RAM_BASE], [4095, WORK_RAM_BASE + 2047],
    [4096, SPRITE0_BASE], [4351, SPRITE0_BASE + 255],
    [4352, SPRITE1_BASE], [4607, SPRITE1_BASE + 255],
  ];
  for (const [off, addr] of checks) assert.equal(m.stateOffsetToAddr(off), addr, `offset ${off}`);
});

test("RAM read/write round-trips at real addresses; state lives where it lives", () => {
  const m = space();
  m.write8(0x8000, 0x11); // colour
  m.write8(0x8400, 0x22); // video
  m.write8(0x8800, 0x33); // work
  m.write8(0x9000, 0x44); // sprite0
  m.write8(0x9400, 0x55); // sprite1
  assert.equal(m.read8(0x8000), 0x11);
  assert.equal(m.read8(0x8400), 0x22);
  assert.equal(m.read8(0x8800), 0x33);
  assert.equal(m.read8(0x9000), 0x44);
  assert.equal(m.read8(0x9400), 0x55);
  assert.equal(m.colorRam[0], 0x11);
  assert.equal(m.videoRam[0], 0x22);
  assert.equal(m.workRam[0], 0x33);
  assert.equal(m.sprite0[0], 0x44);
  assert.equal(m.sprite1[0], 0x55);
});

test("sprite RAM: bit 0x0400 selects bank, mirror mask 0x0B00 bits are don't-care", () => {
  const m = space();
  m.write8(0x9000, 0xa0); // bank 0
  m.write8(0x9400, 0xb0); // bank 1
  assert.equal(m.sprite0[0], 0xa0);
  assert.equal(m.sprite1[0], 0xb0);
  // 0x0800/0x0200/0x0100 are don't-care (mirror 0x0B00): 0x9800 -> sprite0, 0x9C00 -> sprite1.
  m.write8(0x9800, 0xc0);
  m.write8(0x9c00, 0xd0);
  assert.equal(m.sprite0[0], 0xc0, "0x9800 mirrors sprite0 (bit 0x0400 clear)");
  assert.equal(m.sprite1[0], 0xd0, "0x9C00 mirrors sprite1 (bit 0x0400 set)");
  // low byte is the offset within the bank
  m.write8(0x90ff, 0x7e);
  assert.equal(m.sprite0[0xff], 0x7e);
});

test("I/O reads route to the right port (DSW1@A000, IN0@A080, IN1@A0A0, IN2@A0C0, DSW0@A0E0)", () => {
  const io = new Io();
  io.dsw1 = 0xd1; io.in0 = 0xa0; io.in1 = 0xa1; io.in2 = 0xa2; io.dsw0 = 0xd0;
  const m = space(io);
  assert.equal(m.read8(0xa000), 0xd1, "DSW1");
  assert.equal(m.read8(0xa080), 0xa0, "IN0");
  assert.equal(m.read8(0xa0a0), 0xa1, "IN1");
  assert.equal(m.read8(0xa0c0), 0xa2, "IN2");
  assert.equal(m.read8(0xa0e0), 0xd0, "DSW0");
});

test("I/O read mirrors resolve via the don't-care masks (not ranges)", () => {
  const io = new Io();
  io.dsw1 = 0xd1; io.in0 = 0xa0;
  const m = space(io);
  // DSW1 mask 0x5E7F -> bits 0x007F are don't-care: 0xA040 still reads DSW1.
  assert.equal(m.read8(0xa040), 0xd1, "0xA040 mirrors DSW1");
  // A high mirror too: bit 0x4000 is don't-care for DSW1.
  assert.equal(m.read8(0xe040), 0xd1, "0xE040 mirrors DSW1");
  // IN0 mask 0x5E1F -> bits 0x001F don't-care: 0xA08F still reads IN0.
  assert.equal(m.read8(0xa08f), 0xa0, "0xA08F mirrors IN0");
});

test("I/O writes route to watchdog@A000, sound@A100, latch@A180 (and are NOT the read devices)", () => {
  const io = new Io();
  const m = space(io);
  m.write8(0xa000, 0x00);            // watchdog kick (read here is DSW1 -- different device)
  assert.equal(io.watchdogKicks, 1);
  m.write8(0xa100, 0x5a);            // sound data
  assert.equal(io.soundData, 0x5a);
  m.write8(0xa180, 0x01);            // latch bit 0
  assert.equal(io.latch[0], 1);
  // mirrors: watchdog 0xA040, sound 0xA140
  m.write8(0xa040, 0x00);
  assert.equal(io.watchdogKicks, 2, "0xA040 mirrors watchdog");
  m.write8(0xa140, 0x7c);
  assert.equal(io.soundData, 0x7c, "0xA140 mirrors sound");
});

test("read and write at 0xA000 are different devices (DSW1 read, watchdog write)", () => {
  const io = new Io();
  io.dsw1 = 0x4b;
  const m = space(io);
  assert.equal(m.read8(0xa000), 0x4b);   // DSW1
  assert.equal(io.watchdogKicks, 0);
  m.write8(0xa000, 0xff);                 // watchdog, NOT DSW1
  assert.equal(io.watchdogKicks, 1);
});

test("unmapped access throws loudly (default THROW -- pooyan has no unmap_value_high)", () => {
  const m = space();
  assert.throws(() => m.write8(0x0000, 0x00), UnmappedAccess, "write to ROM");
  assert.throws(() => m.read8(0xa100), UnmappedAccess, "0xA100 is write-only (sound)");
  assert.throws(() => m.read8(0xa180), UnmappedAccess, "0xA180 is write-only (latch)");
  assert.throws(() => m.read8(0xa1a0), UnmappedAccess, "0xA1A0 decodes to nothing");
  assert.throws(() => m.write8(0xa080, 0x00), UnmappedAccess, "0xA080 is read-only (IN0)");
});

test("isHardwareWrite true only for watchdog/sound/latch device addresses", () => {
  assert.equal(AddressSpace.isHardwareWrite(0xa000), true, "watchdog");
  assert.equal(AddressSpace.isHardwareWrite(0xa100), true, "sound");
  assert.equal(AddressSpace.isHardwareWrite(0xa184), true, "latch");
  assert.equal(AddressSpace.isHardwareWrite(0x8000), false, "colour RAM");
  assert.equal(AddressSpace.isHardwareWrite(0xa080), false, "IN0 (read-only)");
});

test("LS259: bit index is addr & 7 (ONE address per bit) across 0xA180-0xA187", () => {
  const io = new Io();
  const m = space(io);
  for (let bit = 0; bit < 8; bit++) {
    m.write8(0xa180 + bit, 0x01); // data on d0
    assert.equal(io.latch[bit], 1, `0xA18${bit} -> latch bit ${bit}`);
  }
  assert.deepEqual([...io.latch], [1, 1, 1, 1, 1, 1, 1, 1]);
  // Only d0 matters (write_d0): an even value clears the bit.
  m.write8(0xa183, 0xfe);
  assert.equal(io.latch[3], 0, "d0=0 clears the bit even with high bits set");
});

test("LS259 mirror: 0xA188 (bit 0x08 don't-care) is bit 0, not bit 8", () => {
  const io = new Io();
  const m = space(io);
  m.write8(0xa188, 0x01); // 0x08 is a mirror don't-care bit; addr&7 == 0
  assert.equal(io.latch[0], 1);
});

test("LS259 flag semantics: NMI (b0), flip_screen INVERTED (b7), and the named bit map", () => {
  const io = new Io();
  // At power-on all latch bits are 0. flip_screen is INVERTED, so it reads TRUE at reset
  // until the ROM sets bit 7 -- same inverted convention as timeplt's flip bit.
  assert.equal(io.nmiMask, false, "NMI disabled at reset");
  assert.equal(io.flipScreen, true, "flip_screen inverted: reset (b7=0) reads flipped");

  io.writeControlLatch(LATCH_NMI_ENABLE, 1);
  assert.equal(io.nmiMask, true);
  io.writeControlLatch(LATCH_NMI_ENABLE, 0);
  assert.equal(io.nmiMask, false);

  io.writeControlLatch(LATCH_FLIPSCREEN, 1);
  assert.equal(io.flipScreen, false, "b7=1 -> not flipped");
  io.writeControlLatch(LATCH_FLIPSCREEN, 0);
  assert.equal(io.flipScreen, true, "b7=0 -> flipped");

  // The bit map is the pooyan.cpp assignment, distinct from timeplt (no video-enable bit).
  assert.deepEqual(
    [LATCH_NMI_ENABLE, LATCH_AUDIO_IRQ, LATCH_AUDIO_MUTE, LATCH_COIN_COUNTER_0,
      LATCH_COIN_COUNTER_1, LATCH_PAYOUT, LATCH_FLIPSCREEN],
    [0, 1, 2, 3, 4, 5, 7],
  );
  assert.equal(io.videoEnabled, undefined, "no video-enable getter on this board");
});

test("watchdog kick + sound-write callback + input-press masking", () => {
  const io = new Io();
  io.kickWatchdog();
  assert.equal(io.watchdogKicks, 1);

  let seen = null;
  io.onSoundWrite = (addr, v) => { seen = [addr, v]; };
  io.writeSoundData(0x2a);
  assert.deepEqual(seen, [0xa100, 0x2a]);

  // Active-low input: a pressed bit clears in the read. IN1 button1 is bit 0x10.
  io.inputAssert = { 0xa0a0: 0x10 };
  assert.equal(io.readIn1(), 0xff & ~0x10, "pressed bit reads low");
  io.inputAssert = null;
  assert.equal(io.readIn1(), 0xff, "released reads idle high");
});
