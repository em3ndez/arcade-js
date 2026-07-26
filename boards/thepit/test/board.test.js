// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit board-hardware tests (FIRST DRAFT, game #2).
 *
 * Tests boards/thepit/{memory,io,video}.js as the subject: the memory map / mirrors /
 * unmapped-access / state-dump layout, the io device split + watchdog kick + control
 * latch, and the palette decode. Pure logic — no ROM image needed, so this runs on a
 * fresh clone and gives the first REAL validation of the game #2 scaffold.
 * Run: node --test boards/thepit/test/board.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  AddressSpace, UnmappedAccess, STATE_DUMP_SIZE,
  WORK_RAM_BASE, WORK_RAM_SIZE, COLOR_RAM_BASE, VIDEO_RAM_BASE, ATTRSPR_BASE,
} from "../memory.js";
import { Io, Watchdog } from "../io.js";
import { decodePalette, SCREEN_W, SCREEN_H } from "../video.js";

const rom = () => new Uint8Array(0x5000); // 20KB dummy program
const space = () => new AddressSpace(rom(), new Io());

test("state dump is 4352 bytes: work 2048 + colour 1024 + video 1024 + attr/spr 256", () => {
  assert.equal(STATE_DUMP_SIZE, 4352);
  assert.equal(WORK_RAM_SIZE, 2048);
  const m = space();
  assert.equal(m.dumpState().length, 4352);
});

test("dumpState / stateOffsetToAddr are inverse across every region boundary", () => {
  const m = space();
  const checks = [
    [0, WORK_RAM_BASE], [2047, WORK_RAM_BASE + 2047],
    [2048, COLOR_RAM_BASE], [3071, COLOR_RAM_BASE + 1023],
    [3072, VIDEO_RAM_BASE], [4095, VIDEO_RAM_BASE + 1023],
    [4096, ATTRSPR_BASE], [4351, ATTRSPR_BASE + 255],
  ];
  for (const [off, addr] of checks) assert.equal(m.stateOffsetToAddr(off), addr, `offset ${off}`);
});

test("RAM read/write round-trips at real addresses; state lives where it lives", () => {
  const m = space();
  m.write8(0x8000, 0x11); m.write8(0x8800, 0x22); m.write8(0x9000, 0x33); m.write8(0x9840, 0x44);
  assert.equal(m.read8(0x8000), 0x11);
  assert.equal(m.read8(0x8800), 0x22);
  assert.equal(m.read8(0x9000), 0x33);
  assert.equal(m.read8(0x9840), 0x44); // sprite RAM
  assert.equal(m.workRam[0], 0x11);
  assert.equal(m.colorRam[0], 0x22);
  assert.equal(m.attrsprRam[0x40], 0x44);
});

test("colour and video RAM mirror (write the mirror, read the base)", () => {
  const m = space();
  m.write8(0x8c00, 0xab); // colour mirror -> 0x8800
  assert.equal(m.read8(0x8800), 0xab);
  m.write8(0x9400, 0xcd); // video mirror -> 0x9000
  assert.equal(m.read8(0x9000), 0xcd);
});

test("unmapped access throws loudly (a coverage signal, not a silent 0)", () => {
  const m = space();
  assert.throws(() => m.read8(0x6000), UnmappedAccess);   // gap between ROM and RAM
  assert.throws(() => m.read8(0x5000), UnmappedAccess);   // just past ROM
  assert.throws(() => m.write8(0x0000, 0x00), UnmappedAccess); // write to ROM
});

test("io: IN0 reads ~mux (input_port_0_r): idle 0x00, muxes to IN2 on flip (latch b6)", () => {
  const io = new Io();
  // 0xA000 returns ~mux: released switches (raw 0xff active-low) complement to 0x00.
  assert.equal(io.readIn0(), 0x00);
  io.in2 = 0x5a;
  io.writeControlLatch(6, 1); // set flip/mux -> LS157 selects IN2 (cocktail)
  assert.equal(io.readIn0(), 0xa5); // ~0x5a
  assert.equal(io.flipX, true);
});

test("io: IN0 injected press pulls a physical bit low, reads back high after ~", () => {
  const io = new Io();
  io.inputAssert = { 0xa000: 0x02 }; // press Right (physical bit 1, active low)
  assert.equal(io.readIn0(), 0x02); // ~(0xff & ~0x02) = ~0xfd = 0x02
  io.inputAssert = null;
  assert.equal(io.readIn0(), 0x00); // released again
});

test("io: control latch bits — NMI mask (b0), flipY (b7)", () => {
  const io = new Io();
  assert.equal(io.nmiMask, false);
  io.writeControlLatch(0, 1);
  assert.equal(io.nmiMask, true);
  io.writeControlLatch(7, 1);
  assert.equal(io.flipY, true);
  io.writeControlLatch(0, 0);
  assert.equal(io.nmiMask, false);
});

test("io: reading 0xB800 kicks the watchdog (the read IS the kick)", () => {
  const io = new Io();
  io.watchdog.framesSinceKick = 5;
  const m = new AddressSpace(rom(), io);
  m.read8(0xb800);
  assert.equal(io.watchdog.framesSinceKick, 0);
});

test("watchdog resets the machine after timeoutFrames with no kick", () => {
  const w = new Watchdog(3);
  assert.equal(w.tickFrame(), false);
  assert.equal(w.tickFrame(), false);
  assert.equal(w.tickFrame(), true); // 3rd un-kicked frame -> reset
  w.kick();
  assert.equal(w.tickFrame(), false);
});

test("palette: 32 PROM pens + 8 synthetic; RGB from bit weights 0x21/0x47/0x97", () => {
  const prom = new Uint8Array(32);
  prom[0] = 0x00;       // all bits 0 -> black
  prom[1] = 0x07;       // r bits 0,1,2 all set -> 0x21+0x47+0x97 = 0xFF
  prom[2] = 0xc0;       // b bits 6,7 set -> 0x47+0x97 = 0xDE (blue bit0 is always 0)
  const pal = decodePalette(prom);
  assert.equal(pal.length, 40);
  assert.deepEqual(pal[0], [0, 0, 0]);
  assert.deepEqual(pal[1], [0x21 + 0x47 + 0x97, 0, 0]);
  assert.deepEqual(pal[2], [0, 0, 0x47 + 0x97]);
  // synthetic pen 39 = i(7) -> r,g,b all on
  assert.deepEqual(pal[39], [0xff, 0xff, 0xff]);
  assert.equal(SCREEN_W, 256);
  assert.equal(SCREEN_H, 224);
});
