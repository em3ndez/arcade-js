// SPDX-License-Identifier: GPL-3.0-only
// loc_236d: in-play extra-frog spawn/animate driver — gates, dwell count-down, phase reset, and the
// push-ret computed dispatch into the four B3 hop-frame handlers.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_236d } from "../loc_236d.js";
import { loc_1b8b, loc_1be4 } from "../loc_1b8b.js";
import { loc_1c41, loc_1ca0 } from "../loc_1c41.js";

// The push-ret dispatch reads a frame code from ROM 0x2e68+phase; seed the entry the test exercises.
function mk(romBytes = {}) {
  const routines = new Map([
    [0x1b8b, loc_1b8b], [0x1be4, loc_1be4], [0x1c41, loc_1c41], [0x1ca0, loc_1ca0],
  ]);
  const rom = new Uint8Array(0x4000);
  for (const [addr, v] of Object.entries(romBytes)) rom[Number(addr)] = v;
  const m = new Machine(rom, routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const wr = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_236d: gate 0x826c set -> ret nz; 28 T, no writes", () => {
  const m = mk();
  m.mem.write8(0x826c, 0x01);
  m.mem.write8(0x8299, 0x30);
  m.mem.write8(0x829a, 0x07);
  loc_236d(m);
  assert.equal(wr(m, 0x8299), 0x30, "dwell untouched");
  assert.equal(wr(m, 0x829a), 0x07, "phase untouched");
  assert.equal(m.cycles, 28, "T total");
});

test("loc_236d: gate 0x8004 set -> ret nz; 50 T", () => {
  const m = mk();
  m.mem.write8(0x8004, 0x02);
  loc_236d(m);
  assert.equal(m.cycles, 50, "T total");
});

test("loc_236d: dwell running -> loc_23e6 counts it down; 98 T", () => {
  const m = mk();
  m.mem.write8(0x8299, 0x05);
  loc_236d(m);
  assert.equal(wr(m, 0x8299), 0x04, "dwell -= 1");
  assert.equal(m.cycles, 98, "T total");
});

test("loc_236d: frame 0xff -> loc_23ac reset; clears phase+flags, 231 T", () => {
  const m = mk({ 0x2e69: 0xff });
  m.mem.write8(0x825b, 0xaa);
  loc_236d(m);
  assert.equal(wr(m, 0x829a), 0x00, "phase reset");
  assert.equal(wr(m, 0x8299), 0x00, "dwell cleared");
  assert.equal(wr(m, 0x825b), 0x00, "0x825b cleared");
  assert.equal(m.cycles, 231, "T total");
});

test("loc_236d: frame 0x02 -> dispatch jp 0x1ca0 (early-ret); 271 T", () => {
  const m = mk({ 0x2e69: 0x02 });
  m.mem.write8(0x8047, 0x10); // frog Y < 0x30 -> loc_1ca0 rets immediately
  loc_236d(m);
  assert.equal(wr(m, 0x8299), 0x30, "dwell armed");
  assert.equal(wr(m, 0x829a), 0x01, "phase advanced");
  assert.equal(wr(m, 0x8045), 0x00, "handler wrote nothing (early ret)");
  assert.equal(m.cycles, 271, "T total incl. loc_1ca0 early ret");
});

test("loc_236d: frame 0x0b -> dispatch jp 0x1b8b (early-ret); 271 T", () => {
  const m = mk({ 0x2e69: 0x0b });
  m.mem.write8(0x8047, 0xf5); // frog Y >= 0xf0 -> loc_1b8b rets immediately
  loc_236d(m);
  assert.equal(wr(m, 0x8299), 0x30, "dwell armed");
  assert.equal(wr(m, 0x829a), 0x01, "phase advanced");
  assert.equal(wr(m, 0x8045), 0x00, "handler wrote nothing (early ret)");
  assert.equal(m.cycles, 271, "T total");
});
