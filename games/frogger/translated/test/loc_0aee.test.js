// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0aee (Frogger ring XOR step, ROM 0x0AEE-0x0B09): dec the cursor at (0x8400),
// wrapping 0->0x1F; then (0x8400+j) ^= (0x8400+cursor), j = (cursor+0x0D) folded below 0x20 by -0x1F.
// Leaf, no callees. HL/DE preserved (SP returns to the sentinel).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0aee } from "../loc_0aee.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const set = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

// A: cursor 0x05 -> 0x04, j = 0x04+0x0D = 0x11 (carry, no fold): (0x8411) ^= (0x8404).
test("loc_0aee: dec cursor, no wrap, no fold; 151 T", () => {
  const m = mk();
  set(m, 0x8400, 0x05); set(m, 0x8404, 0x3c); set(m, 0x8411, 0x0f);
  loc_0aee(m);
  assert.equal(r(m, 0x8400), 0x04, "cursor decremented");
  assert.equal(r(m, 0x8411), 0x33, "(0x8411) = 0x3c ^ 0x0f");
  assert.equal(r(m, 0x8404), 0x3c, "source byte untouched");
  assert.equal(m.regs.sp, 0x8800, "HL/DE balanced");
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.equal(m.cycles, 151, "jr nz + jr c both taken");
});

// B: cursor 0x01 -> 0x00 wraps to 0x1F; j = 0x1F+0x0D = 0x2C folds to 0x0D: (0x840D) ^= (0x841F).
test("loc_0aee: cursor wrap 0->0x1F and the -0x1F fold; 158 T", () => {
  const m = mk();
  set(m, 0x8400, 0x01); set(m, 0x841f, 0x55); set(m, 0x840d, 0x0a);
  loc_0aee(m);
  assert.equal(r(m, 0x8400), 0x1f, "cursor wrapped to 0x1F");
  assert.equal(r(m, 0x840d), 0x5f, "(0x840D) = 0x55 ^ 0x0a");
  assert.equal(r(m, 0x841f), 0x55, "source byte untouched");
  assert.equal(m.cycles, 158, "jr nz + jr c both fall through");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0aee.js
//   find: regs.add(0x0d);
//   repl: regs.add(0x0e);   // j = cursor+0x0E, shifting the XOR target by one
//   expect: FAIL  (writes (0x8412) not (0x8411); (0x8411) stays 0x0f — caught by check)
//   verified-anchor: count == 1  (the sole `regs.add(0x0d)` in loc_0aee.js)
// Simulated by substituting the add operand 0x0d -> 0x0e at the one site that uses it.
test("loc_0aee: the contract catches a wrong fold offset", () => {
  const m = mk();
  set(m, 0x8400, 0x05); set(m, 0x8404, 0x3c); set(m, 0x8411, 0x0f);
  const oadd = m.regs.add.bind(m.regs);
  m.regs.add = (v, c = 0) => oadd(v === 0x0d ? 0x0e : v, c);
  loc_0aee(m);
  assert.notEqual(r(m, 0x8411), 0x33, "target moved off (0x8411)");
});
