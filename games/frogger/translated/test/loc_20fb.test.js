// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_20fb (Frogger column scroll-wrap handler, ROM 0x20FB-0x218F). Builds a VRAM
// address from the (0x8273) object's col/row fields + base 0xA808, dispatches on (0x8110) to one of
// three 2-byte-column stamps (tables 0x2190 / 0x2194 / 0x2198), toggling (0x8107) for the 0xA0/0x80
// arms, and finally writes (0x811A) = (0x8275) - 1. An unmatched (0x8110) falls straight to that tail.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_20fb } from "../loc_20fb.js";

// Synthetic ROM carrying the three stamp tables at 0x2190/0x2194/0x2198 (real ROM bytes).
function rom() {
  const r = new Uint8Array(0x4000);
  const t = [0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x10, 0x10, 0x10, 0x10];
  t.forEach((b, i) => (r[0x2190 + i] = b));
  return r;
}

function mk(sel) {
  const m = new Machine(rom(), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.write8(0x8273, 0x08); // (ix+0x00) column field
  m.mem.write8(0x8274, 0x01); // (ix+0x01) column count -> A = 0x20
  m.mem.write8(0x8275, 0x02); // (ix+0x02) row count -> tail writes 0x01, copy does 2 rows
  m.mem.write8(0x8110, sel);  // dispatch selector
  return m;
}

const voff = (a) => 0x800 + (a & 0x3ff);
// With the mk() setup the VRAM base resolves to 0xA830; the copy stamps 2 rows (pitch 0x1F) per column
// for C=2 columns, HL running continuously, so the 8 destinations are fixed:
const CELLS = [0xa830, 0xa831, 0xa850, 0xa851, 0xa870, 0xa871, 0xa890, 0xa891];

function base(before, after) {
  const e = before.slice();
  e[0x11a] = 0x01; // (0x811a) = (0x8275) - 1
  for (let a = 0x7f0; a < 0x800; a++) e[a] = after[a]; // stack scratch excluded
  return e;
}

test("loc_20fb: unmatched (0x8110) falls to the tail — only (0x811A) moves; 334 T; SP balanced", () => {
  const m = mk(0x00);
  const before = m.dumpState();
  loc_20fb(m);
  const after = m.dumpState();
  assert.deepEqual(after, base(before, after), "no stamp; only (0x811a) written");
  assert.equal(m.cycles, 334, "prologue + full dispatch fall-through + tail");
  assert.equal(m.regs.sp, 0x8800, "stack balanced");
});

test("loc_20fb: (0x8110)==0x50 stamps table 0x2190 into the 8 cells; 775 T", () => {
  const m = mk(0x50);
  const before = m.dumpState();
  loc_20fb(m);
  const after = m.dumpState();
  const e = base(before, after);
  const vals = [0x94, 0x95, 0x96, 0x97, 0x94, 0x95, 0x96, 0x97]; // DE resets to 0x2190 each column
  CELLS.forEach((a, i) => (e[voff(a)] = vals[i]));
  assert.deepEqual(after, e, "table 0x2190 stamped, (0x8107) untouched");
  assert.equal(m.cycles, 775, "prologue + arm 0x213E (2 columns) + tail");
  assert.equal(m.regs.sp, 0x8800, "stack balanced");
});

test("loc_20fb: (0x8110)==0xA0 stamps table 0x2198 and sets (0x8107)=1; 829 T", () => {
  const m = mk(0xa0);
  const before = m.dumpState();
  loc_20fb(m);
  const after = m.dumpState();
  const e = base(before, after);
  e[0x107] = 0x01; // (0x8107) set by this arm
  CELLS.forEach((a) => (e[voff(a)] = 0x10)); // table 0x2198 is all 0x10
  assert.deepEqual(after, e, "table 0x2198 stamped + (0x8107)=1");
  assert.equal(m.cycles, 829, "prologue + arm 0x2165 + tail");
});

test("loc_20fb: (0x8110)==0x80 stamps table 0x2194 and clears a set (0x8107)", () => {
  const m = mk(0x80);
  m.mem.write8(0x8107, 0x01); // pre-set so the arm's clear path runs
  const before = m.dumpState();
  loc_20fb(m);
  const after = m.dumpState();
  const e = base(before, after);
  e[0x107] = 0x00; // cleared by the 0x80 arm
  const vals = [0x98, 0x99, 0x9a, 0x9b, 0x98, 0x99, 0x9a, 0x9b]; // table 0x2194
  CELLS.forEach((a, i) => (e[voff(a)] = vals[i]));
  assert.deepEqual(after, e, "table 0x2194 stamped + (0x8107) cleared");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_20fb.js
//   find: regs.a = 0x01;
//   repl: regs.a = 0x02;
//   expect: FAIL ((0x8107) becomes 0x02 not 0x01 — caught by the 0xA0 check)
//   verified-anchor: count == 1 (the sole ld a,0x01 feeding (0x8107) in loc_20fb.js)
// Simulated by intercepting the (0x8107) store (1 -> 2), which is what that edit produces.
test("loc_20fb: the contract catches a wrong (0x8107) flag", () => {
  const m = mk(0xa0);
  const before = m.dumpState();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x8107 && v === 0x01 ? 0x02 : v, o);
  loc_20fb(m);
  const after = m.dumpState();
  const e = base(before, after);
  e[0x107] = 0x01;
  CELLS.forEach((a) => (e[voff(a)] = 0x10));
  assert.throws(() => assert.deepEqual(after, e));
});
