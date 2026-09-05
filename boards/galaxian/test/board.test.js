// SPDX-License-Identifier: GPL-3.0-only
/**
 * Galaxian board-hardware tests (Namco Galaxian family, no ROM needed).
 *
 * Subject: boards/galaxian/{memory,io}.js -- the galaxian_map decode (regions / mirror MASKS /
 * unmap_value_high=0xFF / watchdog / single-byte D0 latches / discrete-sound register writes) and the
 * direct-port input model (IN0/IN1/IN2, all IP_ACTIVE_HIGH). Pure logic, validated against galaxian.cpp
 * before any ROM boots. A drift test pins hardware.json to the memory.js constants.
 * Run: node --test boards/galaxian/test/board.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  AddressSpace, UnmappedAccess, STATE_DUMP_SIZE, ROM_END,
  WORK_RAM_BASE, VIDEO_RAM_BASE, OBJ_RAM_BASE, WORK_RAM_SIZE, VIDEO_RAM_SIZE, OBJ_RAM_SIZE,
} from "../memory.js";
import { Io, NotImplemented, IDLE_IN0, IDLE_IN1, IDLE_IN2 } from "../io.js";

const rom = () => new Uint8Array(ROM_END + 1); // 16KB dummy program (0x0000-0x3FFF)
const space = (io = new Io()) => new AddressSpace(rom(), io);

/* ------------------------------------------------------------------ memory: sizes + state layout */

test("ROM image up to 16KB; a smaller image zero-pads to the 0x4000 mapped region", () => {
  assert.equal(ROM_END, 0x3fff);
  const m = new AddressSpace(new Uint8Array([0xaf, 0x32, 0x01, 0x70]), new Io());
  assert.equal(m.rom.length, 0x4000, "padded to region size");
  assert.equal(m.read8(0x0000), 0xaf);
  assert.equal(m.read8(0x2800), 0x00, "unpopulated tail is 0x00 (MAME ROM_REGION fill)");
  assert.equal(m.read8(0x3fff), 0x00);
  assert.throws(() => new AddressSpace(new Uint8Array(0x4001), new Io()), /exceeds/);
});

test("state dump is 2304 bytes: work 1024 + video 1024 + objram 256", () => {
  assert.equal(STATE_DUMP_SIZE, WORK_RAM_SIZE + VIDEO_RAM_SIZE + OBJ_RAM_SIZE);
  assert.equal(STATE_DUMP_SIZE, 2304);
  assert.equal(space().dumpState().length, 2304);
});

test("dumpState / stateOffsetToAddr are inverse across every region boundary", () => {
  const m = space();
  const checks = [
    [0, WORK_RAM_BASE], [1023, WORK_RAM_BASE + 1023],
    [1024, VIDEO_RAM_BASE], [2047, VIDEO_RAM_BASE + 1023],
    [2048, OBJ_RAM_BASE], [2303, OBJ_RAM_BASE + 255],
  ];
  for (const [off, addr] of checks) assert.equal(m.stateOffsetToAddr(off), addr, `offset ${off}`);
});

test("RAM read/write round-trips at real addresses; state lives where it lives", () => {
  const m = space();
  m.write8(0x4000, 0x11); // work
  m.write8(0x5000, 0x22); // video
  m.write8(0x5800, 0x33); // objram
  assert.equal(m.read8(0x4000), 0x11);
  assert.equal(m.read8(0x5000), 0x22);
  assert.equal(m.read8(0x5800), 0x33);
  const dump = m.dumpState();
  assert.equal(dump[0], 0x11);
  assert.equal(dump[WORK_RAM_SIZE], 0x22);
  assert.equal(dump[WORK_RAM_SIZE + VIDEO_RAM_SIZE], 0x33);
});

/* ---------------------------------------------------------------- memory: mirror MASK decoding */

test("WORK RAM mirror 0x0400: 0x4000 and 0x4400 are the same cell (A10 don't-care)", () => {
  const m = space();
  m.write8(0x4000, 0x5a);
  assert.equal(m.read8(0x4400), 0x5a);
  m.write8(0x47ff, 0x7e);
  assert.equal(m.workRam[0x3ff], 0x7e);
});

test("VIDEORAM mirror 0x0400 folds 0x5000-0x57FF onto 1KB; OBJRAM at 0x5800 is distinct", () => {
  const m = space();
  m.write8(0x5000, 0x5a);
  assert.equal(m.read8(0x5400), 0x5a, "0x5400 mirrors videoram[0]");
  m.write8(0x5800, 0xee); // objram, NOT videoram
  assert.equal(m.videoRam[0], 0x5a, "0x5800 did not touch videoram");
});

test("OBJRAM mirror 0x0700 folds 0x5800-0x5FFF onto 256 bytes", () => {
  const m = space();
  m.write8(0x5800, 0xa0);
  m.write8(0x58ff, 0xb0);
  assert.equal(m.objRam[0], 0xa0);
  assert.equal(m.objRam[0xff], 0xb0);
  m.write8(0x5f00, 0xc0); // mirror bits 0x0700 don't-care
  assert.equal(m.objRam[0], 0xc0, "0x5F00 mirrors objram[0]");
});

test("watchdog: 0x7800 (mirror 0x07FF) READS return 0xFF and pet the dog", () => {
  const m = space();
  assert.equal(m.read8(0x7800), 0xff, "reset_r returns unmap_value_high");
  assert.equal(m.watchdogReads, 1);
  assert.equal(m.read8(0x7fff), 0xff, "0x7FFF mirrors the watchdog");
  assert.equal(m.watchdogReads, 2);
});

test("★ unmapped reads FLOAT HIGH (0xFF), they do NOT throw (unmap_value_high)", () => {
  const m = space();
  assert.equal(m.read8(0x4800), 0xff, "gap above WORK RAM mirror block");
  assert.equal(m.read8(0x8000), 0xff, "gap above the I/O page");
  assert.equal(m.read8(0xffff), 0xff);
});

test("write to ROM throws; other unmapped writes are dropped + counted", () => {
  const m = space();
  assert.throws(() => m.write8(0x0000, 0x00), UnmappedAccess, "write to ROM throws");
  assert.throws(() => m.write8(0x3fff, 0x00), UnmappedAccess);
  m.write8(0x4800, 0x00); // gap -> dropped
  m.write8(0x7000, 0x00); // 0x7000 write reg 0 is unmapped (0x7000 is a READ port) -> dropped
  assert.equal(m.unmappedWrites, 2);
});

/* --------------------------------------------------------------- memory: single-byte D0 latches */

test("0x6000 block: start_lamp / coin_lock / coin_count_0 by low-3-bits, mirror 0x07F8", () => {
  const io = new Io();
  const m = space(io);
  m.write8(0x6000, 0x01); assert.equal(io.startLamp[0], 1, "0x6000 -> start_lamp[0]");
  m.write8(0x6001, 0x01); assert.equal(io.startLamp[1], 1, "0x6001 -> start_lamp[1]");
  m.write8(0x6002, 0x01); assert.equal(io.coinLock, 1, "0x6002 -> coin_lock");
  m.write8(0x6003, 0x01); assert.equal(io.coinCounter[0], 1, "0x6003 -> coin_count_0");
  // mirror 0x07F8: 0x6403 has the same low 3 bits -> coin_count_0.
  io.coinCounter[0] = 0;
  m.write8(0x6403, 0x01); assert.equal(io.coinCounter[0], 1, "0x6403 mirrors coin_count_0");
});

test("0x7000 block: irq_enable / stars_enable / flip_x / flip_y at reg 1/4/6/7 (D0)", () => {
  const io = new Io();
  const m = space(io);
  m.write8(0x7001, 0x01); assert.equal(io.irqEnable, 1, "0x7001 -> irq_enable");
  m.write8(0x7004, 0x01); assert.equal(io.starsEnable, 1, "0x7004 -> stars_enable");
  m.write8(0x7006, 0x01); assert.equal(io.flipX, 1, "0x7006 -> flip_x");
  m.write8(0x7007, 0x01); assert.equal(io.flipY, 1, "0x7007 -> flip_y");
  // D0-only: even value clears.
  m.write8(0x7001, 0xfe); assert.equal(io.irqEnable, 0, "even -> D0=0");
  // reg 0/2/3/5 in the 0x7000 block are unmapped writes.
  const before = m.unmappedWrites;
  m.write8(0x7002, 0x01); m.write8(0x7005, 0x01);
  assert.equal(m.unmappedWrites, before + 2);
});

/* ------------------------------------------------------------- memory: discrete-sound writes */

test("sound writes route to the io sink: 0x6004-7 lfo, 0x6800-7 sound_w, 0x7800 pitch", () => {
  const io = new Io();
  const m = space(io);
  const seen = [];
  io.onSoundWrite = (kind, reg, v) => seen.push([kind, reg, v]);
  m.write8(0x6004, 0x11); // lfo reg 0
  m.write8(0x6007, 0x22); // lfo reg 3
  m.write8(0x6800, 0x33); // sound_w reg 0
  m.write8(0x6807, 0x44); // sound_w reg 7
  m.write8(0x7800, 0x55); // pitch
  assert.deepEqual(seen, [
    ["lfo", 0, 0x11], ["lfo", 3, 0x22],
    ["sound", 0, 0x33], ["sound", 7, 0x44],
    ["pitch", 0, 0x55],
  ]);
  assert.equal(io.soundLfo[0], 0x11);
  assert.equal(io.soundReg[7], 0x44);
  assert.equal(io.soundPitchVal, 0x55);
});

test("isHardwareWrite: sound + latch pages only (not RAM/VRAM/OBJRAM/ROM)", () => {
  assert.equal(AddressSpace.isHardwareWrite(0x6000), true, "start_lamp/coin/lfo block");
  assert.equal(AddressSpace.isHardwareWrite(0x6800), true, "sound_w block");
  assert.equal(AddressSpace.isHardwareWrite(0x7800), true, "pitch block");
  assert.equal(AddressSpace.isHardwareWrite(0x7001), true, "irq_enable latch");
  assert.equal(AddressSpace.isHardwareWrite(0x7007), true, "flip_y latch");
  assert.equal(AddressSpace.isHardwareWrite(0x7000), false, "0x7000 reg 0 is a read port, not a write device");
  assert.equal(AddressSpace.isHardwareWrite(0x4000), false, "work RAM");
  assert.equal(AddressSpace.isHardwareWrite(0x5000), false, "VRAM");
  assert.equal(AddressSpace.isHardwareWrite(0x5800), false, "OBJRAM");
  assert.equal(AddressSpace.isHardwareWrite(0x0000), false, "ROM");
});

test("writeTrace records hardware writes with bus-cycle offset; RAM writes are not traced", () => {
  const io = new Io();
  const m = space(io);
  m.writeTrace = [];
  m.clock = () => 1000;
  m.write8(0x7001, 0x01, 10); // latch, ld (nn),a offset
  m.write8(0x4000, 0x22, 10); // RAM -> NOT traced
  m.write8(0x6800, 0x5a, 10); // sound
  assert.deepEqual(m.writeTrace.map((w) => w.addr), [0x7001, 0x6800]);
  assert.equal(m.writeTrace[0].cycle, 1010);
});

/* ---------------------------------------------------------------------- inputs + latch semantics */

test("nmiMask reflects irq_enable (0x7001 D0); flipX/flipY are D0-direct", () => {
  const io = new Io();
  assert.equal(io.nmiMask, false, "NMI disabled at reset");
  io.setIrqEnable(1);
  assert.equal(io.nmiMask, true);
  io.setIrqEnable(0);
  assert.equal(io.nmiMask, false);
  io.setFlipX(1); assert.equal(io.flipScreenX, true);
  io.setFlipY(1); assert.equal(io.flipScreenY, true);
});

test("idle input values: IN0=0x00, IN1=0x00, IN2=0x04 (Lives dip) -- MAME-measured", () => {
  assert.equal(IDLE_IN0, 0x00);
  assert.equal(IDLE_IN1, 0x00);
  assert.equal(IDLE_IN2, 0x04, "b2 Lives dip default = 3 lives");
  const io = new Io();
  assert.equal(io.in0, 0x00);
  assert.equal(io.in1, 0x00);
  assert.equal(io.in2, 0x04);
});

test("inputs are ACTIVE HIGH: a pressed bit sets in the read; unknown port key throws", () => {
  const io = new Io();
  const m = space(io);
  io.inputAssert = { 0: 0x01 }; // COIN1 is IN0 bit0
  assert.equal(m.read8(0x6000), 0x01, "COIN1 pressed reads high");
  io.inputAssert = { 0: 0x10 }; // fire is IN0 bit4
  assert.equal(m.read8(0x6000), 0x10);
  io.inputAssert = { 1: 0x01 }; // START1 is IN1 bit0
  assert.equal(m.read8(0x6800), 0x01);
  io.inputAssert = { 2: 0x00 };
  assert.equal(m.read8(0x7000), 0x04, "IN2 idle (Lives) preserved when nothing pressed");
  io.inputAssert = null;
  assert.equal(m.read8(0x6000), 0x00, "released reads idle 0");
  io.inputAssert = { 0xdead: 0x01 };
  assert.throws(() => io.readIn0(), NotImplemented);
});

test("loadStateFrom copies value-state, latches, and the sound registers", () => {
  const a = new Io();
  a.setIrqEnable(1); a.setStarsEnable(1); a.setFlipX(1); a.setCoinCounter(1, 1);
  a.in2 = 0x77; a.soundLfo[2] = 0x9a; a.soundReg[3] = 0xbc; a.soundPitchVal = 0xde;
  const b = new Io();
  b.loadStateFrom(a);
  assert.equal(b.irqEnable, 1);
  assert.equal(b.starsEnable, 1);
  assert.equal(b.flipX, 1);
  assert.equal(b.coinCounter[1], 1);
  assert.equal(b.in2, 0x77);
  assert.equal(b.soundLfo[2], 0x9a);
  assert.equal(b.soundReg[3], 0xbc);
  assert.equal(b.soundPitchVal, 0xde);
});

/* ------------------------------------------------------------- hardware.json drift vs memory.js */

test("hardware.json stateRegions + sizes match the memory.js constants (no drift)", () => {
  const hw = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "hardware.json"), "utf8"),
  );
  assert.equal(hw.stateDumpSize, STATE_DUMP_SIZE, "stateDumpSize");
  const byName = Object.fromEntries(hw.stateRegions.map((r) => [r.name, r]));
  assert.equal(byName.ram.base, WORK_RAM_BASE);
  assert.equal(byName.ram.size, WORK_RAM_SIZE);
  assert.equal(byName.vram.base, VIDEO_RAM_BASE);
  assert.equal(byName.vram.size, VIDEO_RAM_SIZE);
  assert.equal(byName.objram.base, OBJ_RAM_BASE);
  assert.equal(byName.objram.size, OBJ_RAM_SIZE);
  // interrupt is the NMI at the Z80 vector 0x0066, gated by irq_enable.
  assert.equal(hw.interrupt.kind, "NMI");
  assert.equal(hw.interrupt.vector, 0x0066);
});
