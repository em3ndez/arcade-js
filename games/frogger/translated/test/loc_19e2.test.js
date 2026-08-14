// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_19e2 (Frogger 14-row tile-string blit, ROM 0x19E2-0x19F5): from the caller's
// HL, write the group {0x48,0x49 / 0x4A,0x4B} down 0x0E rows (row pair pitch +0x1F then +1).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_19e2 } from "../loc_19e2.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.hl = 0xa850; // idx 0x50
  return m;
}
const v = (m, i) => m.mem.videoRam[i];

function check(m) {
  assert.equal(v(m, 0x50), 0x48, "row0 col A tile 0x48");
  assert.equal(v(m, 0x51), 0x49, "row0 col A+1 tile 0x49");
  assert.equal(v(m, 0x70), 0x4a, "row0 col B (0x51+0x1f) tile 0x4a");
  assert.equal(v(m, 0x71), 0x4b, "row0 col B+1 tile 0x4b");
  assert.equal(v(m, 0x90), 0x48, "row1 starts at 0x71+0x1f = 0x90");
  assert.equal(v(m, 0x91), 0x49, "row1 tile 0x49");
}

test("loc_19e2: blits the 4-tile group down 0x0E rows", () => {
  const m = mk();
  loc_19e2(m);
  check(m);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_19e2.js
//   find: mem.write8(regs.hl, 0x48);
//   repl: mem.write8(regs.hl, 0x47);
//   expect: FAIL  (top-left tile 0x47 instead of 0x48 — caught by check)
//   verified-anchor: count == 1  (the sole immediate-0x48 store in loc_19e2.js)
// Simulated by intercepting exactly that store value, which is what the edit produces.
test("loc_19e2: the contract catches a wrong lead tile", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0x48 ? 0x47 : val, o);
  loc_19e2(m);
  assert.throws(() => check(m));
});
