// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0aba (Frogger one-time display-field setup, ROM 0x0ABA-0x0AED). Guarded by
// (0x842D): sets (0x842D)=1/(0x803F)=3/(0x83E0)=0, blits via rst 0x28 (stubbed), fills 0x0F rows of
// tile 0x0C down from 0xA8DF, and seeds (0x83DC)=0x3C20/(0x83DE)=0x60.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0aba } from "../loc_0aba.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0028, bal]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const v = (m, i) => m.mem.videoRam[i]; // 0xa8df & 0x3ff = 0x0df

function check(m) {
  assert.equal(r(m, 0x842d), 0x01, "(0x842d) = 1");
  assert.equal(r(m, 0x803f), 0x03, "(0x803f) = 3");
  assert.equal(r(m, 0x83e0), 0x00, "(0x83e0) = 0");
  assert.equal(v(m, 0x0df), 0x0c, "fill row 0 tile 0x0c");
  assert.equal(v(m, 0x0df + 14 * 0x20), 0x0c, "fill row 14 (last) tile 0x0c");
  assert.equal(v(m, 0x0df + 15 * 0x20), 0x00, "row 15 not written");
  assert.equal(r(m, 0x83dc), 0x20, "(0x83dc) low = 0x20");
  assert.equal(r(m, 0x83dd), 0x3c, "(0x83dd) high = 0x3c");
  assert.equal(r(m, 0x83de), 0x60, "(0x83de) = 0x60");
}

test("loc_0aba: lays out the display field once (rst 0x28 issued)", () => {
  const m = mk();
  loc_0aba(m);
  check(m);
  assert.deepEqual(m.calls, [0x0028], "one blit issued");
});

test("loc_0aba: (0x842D)!=0 rets without redoing the layout; 28 T", () => {
  const m = mk();
  m.mem.workRam[0x42d] = 0x01;
  loc_0aba(m);
  assert.equal(m.cycles, 28, "ld a,(nn)13 + or a 4 + ret nz taken 11");
  assert.deepEqual(m.calls, [], "no blit");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0aba.js
//   find: regs.bc = 0x0f0c;
//   repl: regs.bc = 0x0f0d;   // C = 0x0d, the fill tile
//   expect: FAIL  (fills tile 0x0d instead of 0x0c — caught by check)
//   verified-anchor: count == 1  (the sole ld bc,0x0f0c in loc_0aba.js)
// Simulated by intercepting exactly the 0x0c fill store, which is what the edit produces.
test("loc_0aba: the contract catches a wrong fill tile", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0x0c ? 0x0d : val, o);
  loc_0aba(m);
  assert.throws(() => check(m));
});
