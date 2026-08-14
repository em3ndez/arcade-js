// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for the shared scroll copy engine (ROM 0x20BF-0x20FA). loc_20cc takes the destination
// base from (0x13EF); loc_20bf (the 2nd entry) from (0x13F5). Each copies C column pairs (2 bytes,
// row pitch 0x20, B rows); the column stride is B*0x20 + (0x81B1).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_20cc, loc_20bf } from "../loc_20cc.js";

// A synthetic ROM: destination bases at (0x13EF)/(0x13F5), and 4 source bytes at 0x1400.
function rom(destCC, destBF) {
  const r = new Uint8Array(0x4000);
  r[0x13ef] = destCC & 0xff; r[0x13f0] = (destCC >> 8) & 0xff;
  r[0x13f5] = destBF & 0xff; r[0x13f6] = (destBF >> 8) & 0xff;
  r[0x1400] = 0x11; r[0x1401] = 0x22; r[0x1402] = 0x33; r[0x1403] = 0x44;
  return r;
}

function mk(destCC, destBF) {
  const m = new Machine(rom(destCC, destBF), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  // DE = source, B = 2 rows, C = 2 columns, (0x81b1) = per-column base advance.
  m.regs.de = 0x1400;
  m.regs.b = 0x02;
  m.regs.c = 0x02;
  m.mem.write8(0x81b1, 0x02);
  return m;
}

const voff = (a) => 0x800 + (a & 0x3ff); // state-dump offset of a video-RAM address
const STRIDE = 0x02 * 0x20 + 0x02; // 2 rows * 0x20 pitch + (0x81b1)=0x02 -> 0x42

// The cells a 2-column/2-row copy stamps: within a column, byte0/byte1 at each row (pitch 0x20);
// the next column base is STRIDE further on.
function stampMap(d) {
  const out = [];
  for (let c = 0; c < 2; c++) {
    const base = d + c * STRIDE;
    out.push([base + 0x00, 0x11], [base + 0x01, 0x22], [base + 0x20, 0x33], [base + 0x21, 0x44]);
  }
  return out;
}

function expected(before, after, dest) {
  const e = before.slice();
  e[0x002] = 0x14; e[0x003] = 0x02; // (0x8001)hi=0x14 source save, (0x8003)=2 rows
  for (const [a, v] of stampMap(dest)) e[voff(a)] = v;
  for (let a = 0x7f0; a < 0x800; a++) e[a] = after[a]; // stack scratch below the fake return is excluded
  return e;
}

test("loc_20cc: copies from the (0x13EF) base; only the 8 cells + 2 saves move; 653 T; SP balanced", () => {
  const dest = 0xa808;
  const m = mk(dest, 0xa810);
  const before = m.dumpState();
  loc_20cc(m);
  const after = m.dumpState();
  assert.deepEqual(after, expected(before, after, dest), "exactly the copy + saves changed");
  assert.equal(m.cycles, 653, "T-states for the 2x2 copy via the 0x20CC prologue");
  assert.equal(m.regs.sp, 0x8800, "push/pop balanced and the ret popped the return");
});

test("loc_20bf: 2nd entry copies from the (0x13F5) base instead; 665 T", () => {
  const dest = 0xa810; // distinct from (0x13EF) so this proves the entry reads (0x13F5)
  const m = mk(0xa808, dest);
  const before = m.dumpState();
  loc_20bf(m);
  const after = m.dumpState();
  assert.deepEqual(after, expected(before, after, dest), "copy landed at the (0x13F5) base");
  assert.equal(m.cycles, 665, "T-states include the extra jr into the shared loop");
  assert.equal(m.regs.sp, 0x8800, "stack balanced");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_20cc.js
//   find: regs.de = 0x0020;
//   repl: regs.de = 0x0021;   // row pitch off by one
//   expect: FAIL (row 1 lands at base+0x21/+0x22 instead of +0x20/+0x21 — the deepEqual map breaks)
//   verified-anchor: count == 1 (the sole ld de,0x0020 row-pitch in loc_20cc.js)
// Simulated below by corrupting one copied byte, which the same memory-equivalence map catches.
test("loc_20cc: the memory-equivalence map catches a corrupted copy", () => {
  const dest = 0xa808;
  const m = mk(dest, 0xa810);
  const before = m.dumpState();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, v === 0x33 ? 0x99 : v, o); // one source byte lands wrong
  loc_20cc(m);
  const after = m.dumpState();
  assert.throws(() => assert.deepEqual(after, expected(before, after, dest)));
});
