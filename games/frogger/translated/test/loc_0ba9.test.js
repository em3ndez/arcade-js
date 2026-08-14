// SPDX-License-Identifier: GPL-3.0-only
// loc_0ba9: write A's low nibble to (HL), step HL up one 32-wide row (L -= 0x20, borrow into H).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0ba9 } from "../loc_0ba9.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("loc_0ba9: masks to a nibble, steps a row up (no borrow); 40 T", () => {
  const m = mk();
  m.regs.hl = 0xab20; m.regs.a = 0x1f;
  loc_0ba9(m);
  assert.equal(vr(m, 0xab20), 0x0f, "low nibble stored");
  assert.equal(m.regs.hl, 0xab00, "L -= 0x20, no borrow");
  assert.equal(m.cycles, 40, "ret nc taken");
});

test("loc_0ba9: borrow into H when L < 0x20; 48 T", () => {
  const m = mk();
  m.regs.hl = 0xa800; m.regs.a = 0x35;
  loc_0ba9(m);
  assert.equal(vr(m, 0xa800), 0x05, "low nibble stored");
  assert.equal(m.regs.hl, 0xa7e0, "borrow: H -= 1, L wraps to 0xE0");
  assert.equal(m.cycles, 48, "dec h + ret");
});
