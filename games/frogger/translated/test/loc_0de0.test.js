// SPDX-License-Identifier: GPL-3.0-only
// loc_0de0: attract board-DEMO cell assembler. The unit is self-contained (no call/rst) up to the
// fall-through into loc_0e74, so every path's memory + T-state total is asserted exactly. Three
// paths: dwell not expired (early ret), a mid-cell ret (phase counter still nonzero), and the full
// run that reloads the phase counter and tails into loc_0e74.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0de0 } from "../loc_0de0.js";
import { loc_0e74 } from "../loc_0e74.js";

function mk() {
  const routines = new Map([[0x0e74, loc_0e74]]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const wr = (m, a) => m.mem.workRam[a - 0x8000];
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("dwell not expired: (0x83bc)=5 -> dec to 4, ret nz; 74 T", () => {
  const m = mk();
  m.mem.workRam[0x83bc - 0x8000] = 0x05;
  loc_0de0(m);
  assert.equal(wr(m, 0x800d), 0x03);
  assert.equal(wr(m, 0x800f), 0x03);
  assert.equal(wr(m, 0x83bc), 0x04, "dwell decremented, no dispatch");
  assert.equal(m.cycles, 74);
});

test("phase 7 (direct arm 0x0e0d), mid-cell ret: (0x83d7)=7 -> 6, ret nz; 386 T", () => {
  const m = mk();
  m.mem.workRam[0x83bc - 0x8000] = 0x01; // dwell expires this tick
  m.mem.workRam[0x83d7 - 0x8000] = 0x07;
  loc_0de0(m);
  assert.equal(wr(m, 0x83bc), 0x20, "dwell reloaded");
  assert.equal(wr(m, 0x83d7), 0x06, "phase counter decremented, still nonzero");
  for (const a of [0x8040, 0x8041, 0x8042, 0x8043]) assert.equal(wr(m, a), 0x00, `band ${a.toString(16)}`);
  assert.equal(vr(m, 0xab06), 0xd4);
  assert.equal(vr(m, 0xab07), 0xd5);
  assert.equal(vr(m, 0xab26), 0xd6);
  assert.equal(vr(m, 0xab27), 0xd7);
  assert.equal(m.cycles, 386);
});

test("phase 1 (arm 0x0e49 via jr-tramp), full run reloads + tails into loc_0e74; 450 T", () => {
  const m = mk();
  m.mem.workRam[0x83bc - 0x8000] = 0x01;
  m.mem.workRam[0x83d7 - 0x8000] = 0x01; // last cell -> reload path
  loc_0de0(m);
  assert.equal(wr(m, 0x83bc), 0x20);
  assert.equal(wr(m, 0x83d7), 0x07, "phase counter reloaded to 7 at 0");
  assert.equal(wr(m, 0x83bf), 0x00, "attract phase reset");
  assert.equal(wr(m, 0x83bb), 0x00);
  assert.equal(wr(m, 0x83d6), 0x05, "loc_0e74 set game-mode = attract idle");
  for (const a of [0x8058, 0x8059, 0x805a, 0x805b]) assert.equal(wr(m, a), 0x00, `band ${a.toString(16)}`);
  assert.equal(vr(m, 0xa8c6), 0xd8);
  assert.equal(vr(m, 0xa8c7), 0xd9);
  assert.equal(vr(m, 0xa8e6), 0xda);
  assert.equal(vr(m, 0xa8e7), 0xdb);
  assert.equal(m.cycles, 450);
});
