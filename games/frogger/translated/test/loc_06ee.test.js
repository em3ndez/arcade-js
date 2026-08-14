// SPDX-License-Identifier: GPL-3.0-only
// loc_06ee: swap the work pages IN (player 1) or tail to loc_0726 (player 2).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_06ee } from "../loc_06ee.js";
import { loc_0726 } from "../loc_0726.js";

function fill(m) {
  let s = 0x1234abcd >>> 0;
  for (let i = 0; i < 0x800; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    m.mem.workRam[i] = (s >>> 16) & 0xff;
  }
}
function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0726, loc_0726]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; fill(m); m.push16(0xbeef);
  return m;
}
const w = (m, a) => m.mem.workRam[a - 0x8000];
function copied(m, snap, dst, src, n) {
  for (let i = 0; i < n; i++)
    assert.equal(w(m, dst + i), snap[src - 0x8000 + i], `[${(dst + i).toString(16)}]`);
}

test("loc_06ee: player 1 swaps the four blocks IN and latches (0x803F); 9646 T", () => {
  const m = mk();
  m.mem.workRam[0x83fd - 0x8000] = 0x01;
  const snap = m.mem.workRam.slice();
  loc_06ee(m);
  copied(m, snap, 0x85c0, 0x800c, 0x2b);
  copied(m, snap, 0x8600, 0x80ff, 0xb7);
  copied(m, snap, 0x800c, 0x86c0, 0x2b);
  copied(m, snap, 0x80ff, 0x8500, 0xb7);
  assert.equal(w(m, 0x803f), 0x01, "(0x803F) latched");
  assert.equal(m.cycles, 9646, "swap-in T total");
});

test("loc_06ee: player 2 tails to loc_0726 (swap-OUT); 9710 T", () => {
  const m = mk();
  m.mem.workRam[0x83fd - 0x8000] = 0x02;
  m.mem.workRam[0x8295 - 0x8000] = 0x00; // drive loc_0726 down its init-latch path
  const snap = m.mem.workRam.slice();
  loc_06ee(m);
  copied(m, snap, 0x8500, 0x80ff, 0xb7);
  copied(m, snap, 0x86c0, 0x800c, 0x2b);
  copied(m, snap, 0x80ff, 0x8600, 0xb7);
  copied(m, snap, 0x800c, 0x85c0, 0x2b);
  assert.equal(w(m, 0x803f), 0x01, "(0x803F) latched by loc_0726");
  assert.equal(w(m, 0x825b), 0x00, "(0x825B) cleared");
  assert.equal(w(m, 0x8295), 0x01, "(0x8295) latched");
  assert.equal(m.cycles, 9710, "prefix 29 + loc_0726 body 9681");
});

test("loc_06ee: a 1-T undercharge on an LDIR setup is caught", () => {
  const m = mk();
  m.mem.workRam[0x83fd - 0x8000] = 0x01;
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x06f7 && t === 10 ? 9 : t);
  loc_06ee(m);
  assert.equal(m.cycles, 9645, "undercharge shows");
});
