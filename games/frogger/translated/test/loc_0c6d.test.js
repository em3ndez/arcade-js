// SPDX-License-Identifier: GPL-3.0-only
// loc_0c6d: attract MARQUEE assembler — phase-counter dispatch (0x83D7) through the jr-trampoline
// table at 0x0C82. Cycle assertions use zero-cost callee stubs so the total is exactly this unit's
// own T-states (the mutation surface); one real-callee run proves control flow rejoins the tail.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0c6d } from "../loc_0c6d.js";
import { loc_0028 } from "../loc_0028.js";
import { loc_0ba0 } from "../loc_0ba0.js";
import { loc_0ba9 } from "../loc_0ba9.js";
import { loc_0b9b } from "../loc_0b9b.js";

// A callee that consumes its pushed return address at zero T-state cost, so m.cycles reflects only
// loc_0c6d's own charges (including the 11 for rst 0x28 and 17 for call, which ARE its charges).
const nop = (m) => { m.pop16(); };

function mkStub() {
  const routines = new Map([[0x0028, nop], [0x0ba0, nop], [0x0b9b, nop]]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
function mkReal() {
  const routines = new Map([
    [0x0028, loc_0028], [0x0ba0, loc_0ba0], [0x0ba9, loc_0ba9], [0x0b9b, loc_0b9b],
  ]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const wr = (m, a) => m.mem.workRam[a - 0x8000];

test("phase 0: (0x83d7)=1 -> arm 0x0cc0 parks 0x83d8=0xc0; 137 T (no callees)", () => {
  const m = mkStub();
  m.mem.workRam[0x83d7 - 0x8000] = 0x01;
  loc_0c6d(m);
  assert.equal(wr(m, 0x83d7), 0, "phase counter decremented to 0");
  assert.equal(wr(m, 0x83d8), 0xc0, "phase-0 parks 0x83d8=0xc0");
  assert.equal(m.cycles, 137);
});

test("phase 1: (0x83d7)=2 -> arm 0x0c51 -> tail 0x83d8=0x80; 267 T", () => {
  const m = mkStub();
  m.mem.workRam[0x83d7 - 0x8000] = 0x02;
  loc_0c6d(m);
  assert.equal(wr(m, 0x83d7), 1);
  assert.equal(wr(m, 0x83d8), 0x80, "shared tail parks 0x83d8=0x80");
  assert.equal(m.cycles, 267);
});

test("phase 2: (0x83d7)=3 -> arm 0x0ceb -> tail 0x83d8=0x80; 308 T", () => {
  const m = mkStub();
  m.mem.workRam[0x83d7 - 0x8000] = 0x03;
  loc_0c6d(m);
  assert.equal(wr(m, 0x83d7), 2);
  assert.equal(wr(m, 0x83d8), 0x80);
  assert.equal(m.cycles, 308);
});

test("phase 3: (0x83d7)=4 -> arm 0x0cc6 -> tail 0x83d8=0x80; 305 T", () => {
  const m = mkStub();
  m.mem.workRam[0x83d7 - 0x8000] = 0x04;
  loc_0c6d(m);
  assert.equal(wr(m, 0x83d7), 3);
  assert.equal(wr(m, 0x83d8), 0x80);
  assert.equal(m.cycles, 305);
});

test("phase 4 via reload: (0x83d7)=0 -> reload 5 -> arm 0x0c8a sprite bands + tail; 338 T", () => {
  const m = mkStub();
  m.mem.workRam[0x83d7 - 0x8000] = 0x00;
  loc_0c6d(m);
  assert.equal(wr(m, 0x83d7), 4, "reloaded to 5 then decremented to 4");
  for (const a of [0x801d, 0x8023, 0x8029, 0x802f]) assert.equal(wr(m, a), 0x06, `sprite Y ${a.toString(16)}`);
  for (const a of [0x801b, 0x8021, 0x8027, 0x802d]) assert.equal(wr(m, a), 0x03, `sprite code ${a.toString(16)}`);
  assert.equal(wr(m, 0x83d8), 0x80);
  assert.equal(m.cycles, 338);
});

test("real callees: phase 1 completes and rejoins the tail (0x83d8=0x80)", () => {
  const m = mkReal();
  m.mem.workRam[0x83d7 - 0x8000] = 0x02;
  loc_0c6d(m);
  assert.equal(wr(m, 0x83d7), 1);
  assert.equal(wr(m, 0x83d8), 0x80, "control returned from the real blit callees into the tail");
});
