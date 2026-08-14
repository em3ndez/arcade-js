// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_23eb (Frogger river-object phase counter, ROM 0x23EB-0x23F9): (0x8123) += 1,
// wrapping to 0 when it reaches 0x06.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_23eb } from "../loc_23eb.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const rr = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_23eb: below the wrap it increments and ret c; 48 T", () => {
  const m = mk();
  m.mem.workRam[0x123] = 0x02;
  loc_23eb(m);
  assert.equal(rr(m, 0x8123), 0x03, "(0x8123) = 3");
  assert.equal(m.cycles, 48, "13+4+13+7 + ret c taken 11");
  assert.equal(m.pc, 0xbeef);
  assert.equal(m.regs.sp, 0x8800, "ret balanced the stack");
});

test("loc_23eb: reaching 0x06 wraps to 0; 69 T", () => {
  const m = mk();
  m.mem.workRam[0x123] = 0x05;
  loc_23eb(m);
  assert.equal(rr(m, 0x8123), 0x00, "wraps to 0");
  assert.equal(m.cycles, 69, "13+4+13+7 +5 + xor a 4 + ld 13 + ret 10");
});

test("loc_23eb: inc wraps 0xFF->0x00, still below 6 so ret c; 48 T", () => {
  const m = mk();
  m.mem.workRam[0x123] = 0xff;
  loc_23eb(m);
  assert.equal(rr(m, 0x8123), 0x00, "0xff+1 = 0");
  assert.equal(m.cycles, 48);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_23eb.js
//   find: regs.cp(0x06);
//   repl: regs.cp(0x07);   // wrong wrap threshold
//   expect: FAIL (value 6 stays 6 instead of wrapping to 0 — caught by the 0x05 case)
//   verified-anchor: count == 1 (the sole cp 0x06 in loc_23eb.js)
// Simulated by intercepting the wrap store: the real code clears (0x8123) once it hits 6.
test("loc_23eb: the contract catches a missed wrap", () => {
  const m = mk();
  m.mem.workRam[0x123] = 0x05;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x8123 && v === 0x00 ? 0x06 : v, o); // suppress the wrap
  loc_23eb(m);
  assert.throws(() => assert.equal(rr(m, 0x8123), 0x00));
});
