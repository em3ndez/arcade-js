// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_27b3 (Frogger collision-flag reset, ROM 0x27B3-0x27CA) and its second entry
// loc_27bc. loc_27b3: guarded by (0x8135) -- if 0, ret; else clear (0x8134) and fall into loc_27bc,
// which zeroes 0x8040-0x8043 and (0x8135). loc_27bc is entered directly by the goal scorer.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_27b3, loc_27bc } from "../loc_27b3.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x27bc, loc_27bc]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  for (let a = 0x040; a <= 0x043; a++) m.mem.workRam[a] = 0xaa;
  m.mem.workRam[0x134] = 0x55;
  m.mem.workRam[0x135] = 0x07;
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

function checkBlockCleared(m) {
  assert.equal(r(m, 0x8040), 0x00, "(0x8040) = 0");
  assert.equal(r(m, 0x8041), 0x00, "(0x8041) = 0");
  assert.equal(r(m, 0x8042), 0x00, "(0x8042) = 0");
  assert.equal(r(m, 0x8043), 0x00, "(0x8043) = 0");
  assert.equal(r(m, 0x8135), 0x00, "(0x8135) = 0");
}

test("loc_27b3: (0x8135)!=0 clears (0x8134) and delegates to loc_27bc; 122 T", () => {
  const m = mk();
  loc_27b3(m);
  checkBlockCleared(m);
  assert.equal(r(m, 0x8134), 0x00, "(0x8134) cleared before the fall-through");
  assert.deepEqual(m.calls, [0x27bc], "fall-through modelled as a delegate");
  assert.equal(m.cycles, 122, "loc_27b3 39 T + loc_27bc 83 T");
});

test("loc_27b3: (0x8135)==0 rets without resetting; 28 T", () => {
  const m = mk();
  m.mem.workRam[0x135] = 0x00;
  loc_27b3(m);
  assert.equal(m.cycles, 28, "ld a 13 + and a 4 + ret z taken 11");
  assert.equal(r(m, 0x8040), 0xaa, "block untouched");
  assert.deepEqual(m.calls, [], "no delegate");
});

test("loc_27bc: entered directly, zeroes the block and (0x8135); 83 T", () => {
  const m = mk();
  loc_27bc(m);
  checkBlockCleared(m);
  assert.equal(r(m, 0x8134), 0x55, "0x8134 is loc_27b3's, not loc_27bc's");
  assert.equal(m.cycles, 83);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_27b3.js
//   find: regs.hl = 0x8040;
//   repl: regs.hl = 0x8041;
//   expect: FAIL  (writes land at 0x8041-0x8044, leaving 0x8040 dirty -- caught by checkBlockCleared)
//   verified-anchor: count == 1  (the sole ld hl,0x8040 in loc_27b3.js, inside loc_27bc)
test("loc_27bc: the contract catches a wrong block base", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a >= 0x8040 && a <= 0x8043 ? a + 1 : a, val, o);
  loc_27bc(m);
  assert.throws(() => checkBlockCleared(m));
});
