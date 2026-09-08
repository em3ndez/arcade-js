// SPDX-License-Identifier: GPL-3.0-only
/**
 * Centipede board-hardware tests (Atari centiped.cpp, no ROM needed) — the boot-bring-up devices the §2
 * skeleton had stubbed to throw, validated against the driver: the ROM-region write no-op (0x2000-0x3FFF is
 * .rom(), writes ignored save the 0x2000 watchdog), the ER2055 EAROM (high-score NVRAM), and the POKEY
 * RANDOM RNG (poly17 shift register, phase cross-validated vs MAME). Plus the input/DSW idle values.
 * Run: node --test boards/centiped/test/board.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { AddressSpace, PROG_ROM_SIZE } from "../memory.js";
import { Io, IDLE_DSW1, IDLE_DSW2, IDLE_IN1, IDLE_IN3 } from "../io.js";

const space = (io = new Io(), rom = new Uint8Array(PROG_ROM_SIZE)) => new AddressSpace(rom, io);

// A reference poly17 built the same way as MAME's poly_init_9_17 (RANDOM = (poly17>>8)&0xff).
function refPoly17() {
  const n = 0x1ffff;
  const t = new Uint8Array(n);
  let lfsr = n;
  for (let i = 0; i < n; i++) {
    const in8 = (((lfsr >> 8) & 1) ^ ((lfsr >> 13) & 1)) & 1;
    const in0 = lfsr & 1;
    lfsr = lfsr >>> 1;
    lfsr = (lfsr & 0xff7f) | (in8 << 7);
    lfsr = ((in0 << 16) | lfsr) >>> 0;
    t[i] = (lfsr >> 8) & 0xff;
  }
  return t;
}

/* --------------------------------------------------------- ROM-region writes are no-ops (driver .rom()) */

test("a write to the 0x2001-0x3FFF ROM region is ignored (MAME .rom()); the ROM read is unchanged", () => {
  const rom = new Uint8Array(PROG_ROM_SIZE);
  rom[0x0400] = 0xab; // CPU 0x2400
  const m = space(new Io(), rom);
  assert.doesNotThrow(() => m.write8(0x2400, 0x00)); // reset's `sta $2400` — a no-op on real HW
  assert.equal(m.read8(0x2400), 0xab, "the ROM byte is unchanged (the write did not land)");
  assert.doesNotThrow(() => m.write8(0x3fff, 0x5a));
  assert.doesNotThrow(() => m.write8(0x2001, 0x5a));
});

test("0x2000 write is the watchdog (kicks), NOT a ROM no-op — the two devices at one address differ", () => {
  const m = space();
  const before = m.watchdogKicks;
  m.write8(0x2000, 0x00);
  assert.equal(m.watchdogKicks, before + 1, "0x2000 write kicks the watchdog");
});

/* -------------------------------------------------------------------------- ER2055 EAROM (high-score NVRAM) */

test("EAROM: a written cell reads back through the ER2055 control/clock protocol; fresh cells read 0xFF", () => {
  const io = new Io();
  // Write 0x5A to address 0x10. earomControl(0x0A): cs1=1(bit3), c1=0(bit1 set), c2=0 -> write mode (AND into 0xFF).
  io.earomWrite(0x10, 0x5a);
  io.earomControl(0x0a);
  // Move the address/latch away so the read must pull from the cell array, not the stale data latch.
  io.earomWrite(0x20, 0x00);
  io.earomWrite(0x10, 0x00);
  // Read address 0x10. earomControl(0x09)=read+clk-high, then 0x08=clk-low -> falling edge latches cells[0x10].
  io.earomControl(0x09);
  io.earomControl(0x08);
  assert.equal(io.earomRead(), 0x5a, "cells[0x10] written earlier reads back");

  // A fresh (never-written) cell reads 0xFF.
  io.earomWrite(0x2a, 0x00);
  io.earomControl(0x09);
  io.earomControl(0x08);
  assert.equal(io.earomRead(), 0xff, "an unwritten EAROM cell is fresh (0xFF)");
});

/* ------------------------------------------------------------------------------- POKEY RANDOM (poly17 RNG) */

test("POKEY RANDOM: prev-access poly17 model, phase from the SKCTL enable (matches MAME's synchronize timing)", () => {
  const P = refPoly17();
  const io = new Io();

  // Before SK_RESET, the counter is held at 0 -> poly17[0].
  assert.equal(io.pokeyRandom(100), P[0], "RANDOM frozen at poly17[0] until SKCTL enables the counter");

  // SKCTL (reg 0x0F) = 0x03 at cycle 1000 -> origin C0.
  io.pokeyWrite(0x0f, 0x03, 1000);
  // A read returns the poly at the PREVIOUS access's clock; the SKCTL write was the last access (cycle 1000).
  assert.equal(io.pokeyRandom(2000), P[(1000 - 1000) % P.length], "first read after enable: p17 = lastAccess-C0 = 0");
  // Next read: previous access was the 2000-cycle read -> p17 = 2000-1000 = 1000.
  assert.equal(io.pokeyRandom(3000), P[(2000 - 1000) % P.length], "prev-access: p17 = 1000, not the current cycle");

  // Mutation guard: a current-cycle model would return poly17[3000-1000]; the two differ, so the test is meaningful.
  assert.notEqual(P[1000], P[2000], "poly17[1000] != poly17[2000] (a naive current-cycle model would fail here)");
});

/* ----------------------------------------------------------------------------------- input / DSW idle values */

test("input ports read their driver idle values (DSW1/DSW2/IN1/IN3) with no input asserted", () => {
  const m = space();
  assert.equal(m.read8(0x0800), IDLE_DSW1);
  assert.equal(m.read8(0x0801), IDLE_DSW2);
  assert.equal(m.read8(0x0c01), IDLE_IN1);
  assert.equal(m.read8(0x0c03), IDLE_IN3);
});
