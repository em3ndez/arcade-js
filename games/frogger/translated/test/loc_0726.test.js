// SPDX-License-Identifier: GPL-3.0-only
// loc_0726: swap the work pages OUT; latch (0x825B)/(0x8295) unless (0x8295) already set.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0726 } from "../loc_0726.js";

function fill(m) {
  let s = 0x1234abcd >>> 0;
  for (let i = 0; i < 0x800; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    m.mem.workRam[i] = (s >>> 16) & 0xff;
  }
}
function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; fill(m); m.push16(0xbeef);
  return m;
}
const w = (m, a) => m.mem.workRam[a - 0x8000];
function copied(m, snap, dst, src, n) {
  for (let i = 0; i < n; i++)
    assert.equal(w(m, dst + i), snap[src - 0x8000 + i], `[${(dst + i).toString(16)}]`);
}

test("loc_0726: swaps the four blocks OUT and latches init when (0x8295)==0; 9681 T", () => {
  const m = mk();
  m.mem.workRam[0x8295 - 0x8000] = 0x00;
  const snap = m.mem.workRam.slice();
  loc_0726(m);
  copied(m, snap, 0x8500, 0x80ff, 0xb7);
  copied(m, snap, 0x86c0, 0x800c, 0x2b);
  copied(m, snap, 0x80ff, 0x8600, 0xb7);
  copied(m, snap, 0x800c, 0x85c0, 0x2b);
  assert.equal(w(m, 0x803f), 0x01, "(0x803F) latched");
  assert.equal(w(m, 0x825b), 0x00, "(0x825B) cleared");
  assert.equal(w(m, 0x8295), 0x01, "(0x8295) latched");
  assert.equal(m.cycles, 9681, "path B T total");
});

test("loc_0726: (0x8295) already set -> ret nz, no init latch; 9640 T", () => {
  const m = mk();
  m.mem.workRam[0x8295 - 0x8000] = 0x05;
  const snap = m.mem.workRam.slice();
  loc_0726(m);
  copied(m, snap, 0x8500, 0x80ff, 0xb7);
  copied(m, snap, 0x800c, 0x85c0, 0x2b);
  assert.equal(w(m, 0x803f), 0x01, "(0x803F) still latched");
  assert.equal(w(m, 0x8295), 0x05, "(0x8295) untouched");
  assert.equal(w(m, 0x825b), snap[0x825b - 0x8000], "(0x825B) untouched");
  assert.equal(m.cycles, 9640, "path A T total");
});

test("loc_0726: a 1-T undercharge on the final store is caught", () => {
  const m = mk();
  m.mem.workRam[0x8295 - 0x8000] = 0x00;
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0765 && t === 13 ? 12 : t);
  loc_0726(m);
  assert.equal(m.cycles, 9680, "undercharge shows");
});
