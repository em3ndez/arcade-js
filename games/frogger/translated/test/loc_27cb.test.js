// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_27cb (Frogger collision-block writer, ROM 0x27CB-0x27DD) and its sibling
// loc_27de. loc_27cb writes (B, 0x19, 0x03, 0x10) at 0x8040-0x8043 and (0x8340)=0xA0; loc_27de zeroes
// the same 0x8040-0x8043 block.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_27cb, loc_27de } from "../loc_27cb.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  for (let a = 0x040; a <= 0x043; a++) m.mem.workRam[a] = 0xaa;
  m.mem.workRam[0x340] = 0x11;
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

function checkWritten(m, bVal) {
  assert.equal(r(m, 0x8040), bVal, "(0x8040) = B");
  assert.equal(r(m, 0x8041), 0x19, "(0x8041) = 0x19");
  assert.equal(r(m, 0x8042), 0x03, "(0x8042) = 0x03");
  assert.equal(r(m, 0x8043), 0x10, "(0x8043) = 0x10");
  assert.equal(r(m, 0x8340), 0xa0, "(0x8340) = 0xA0");
}

test("loc_27cb: writes the 4-byte block from B and sets (0x8340); 95 T", () => {
  const m = mk();
  m.regs.b = 0x7e;
  loc_27cb(m);
  checkWritten(m, 0x7e);
  assert.equal(m.cycles, 95);
});

test("loc_27de: zeroes 0x8040-0x8043, leaves (0x8340); 70 T", () => {
  const m = mk();
  loc_27de(m);
  assert.equal(r(m, 0x8040), 0x00, "(0x8040) = 0");
  assert.equal(r(m, 0x8041), 0x00, "(0x8041) = 0");
  assert.equal(r(m, 0x8042), 0x00, "(0x8042) = 0");
  assert.equal(r(m, 0x8043), 0x00, "(0x8043) = 0");
  assert.equal(r(m, 0x8340), 0x11, "(0x8340) is not loc_27de's");
  assert.equal(m.cycles, 70);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_27cb.js
//   find: mem.write8(regs.hl, 0x19);
//   repl: mem.write8(regs.hl, 0x18);
//   expect: FAIL  ((0x8041) becomes 0x18 -- caught by checkWritten)
//   verified-anchor: count == 1  (the sole 0x19 literal in loc_27cb.js)
test("loc_27cb: the contract catches a wrong slot-1 value", () => {
  const m = mk();
  m.regs.b = 0x7e;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0x19 ? 0x18 : val, o);
  loc_27cb(m);
  assert.throws(() => checkWritten(m, 0x7e));
});
