// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c473 (ROM 0xc473-0xc4e0) -- 16-pass clamp loop. jsr $c098 is opaque (harness
// records the call, balances the stack), so $61-$64 keep the values the test plants each pass. Covers the
// no-clamp path (both halves in range) and the high-clamp path ($59 counts the clamps). Author-derived.
// Run: node --test games/tempest/translated/test/equivalence-c473.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c473 } from "../loc_c473.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], _retPushed: false,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_c473: 16 passes, both halves in range -> no clamps, $59=0, A=0, 1608 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0xc900); m._retPushed = false; // caller return
  m.regs.a = 0x99; // -> $57 (unused by the clamp logic)
  m.regs.x = 0x0f; // -> $38 (start index), mirrors $37
  m.ram[0x61] = 0x05; m.ram[0x62] = 0x02; // positive, < 4  -> no clamp
  m.ram[0x63] = 0x07; m.ram[0x64] = 0x01; // positive, < 4  -> no clamp

  loc_c473(m);

  assert.equal(m.ram[0x57], 0x99, "A parameter stored to $57");
  assert.equal(m.ram[0x59], 0x00, "no clamps counted");
  assert.equal(m.regs.a, 0x00, "returns $59 in A");
  // every index 0x00..0x0f filled from the in-range values
  assert.equal(m.ram[0x031a + 0x0f], 0x02, "$031a,x = $62");
  assert.equal(m.ram[0x032a + 0x0f], 0x05, "$032a,x = $61 (via Y)");
  assert.equal(m.ram[0x033a + 0x0f], 0x01, "$033a,x = $64");
  assert.equal(m.ram[0x034a + 0x0f], 0x07, "$034a,x = $63 (via Y)");
  assert.equal(m.ram[0x031a + 0x00], 0x02, "last pass writes index 0 too");
  assert.equal(m.ram[0x034a + 0x00], 0x07, "index 0 second-half output");
  assert.deepEqual(m.calls, new Array(16).fill(0xc098), "jsr $c098 once per pass");
  assert.equal(m.pc, 0xc901, "rts -> caller + 1");
  assert.equal(m.cycles, 16 + 16 * 96 + 15 * 3 + 2 + 9, "1608 T");
});

test("loc_c473: first half over 4 (positive) clamps to 0x03/Y=0xff and counts each pass", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0xc900); m._retPushed = false;
  m.regs.x = 0x0f;
  m.ram[0x61] = 0x00; m.ram[0x62] = 0x50; // positive, >= 4 -> clamp to A=0x03, Y=0xff
  m.ram[0x63] = 0x07; m.ram[0x64] = 0x01; // in range

  loc_c473(m);

  assert.equal(m.ram[0x59], 0x10, "16 first-half clamps");
  assert.equal(m.regs.a, 0x10, "A returns $59");
  assert.equal(m.ram[0x031a + 0x0f], 0x03, "clamped magnitude 0x03");
  assert.equal(m.ram[0x032a + 0x0f], 0xff, "clamped sign 0xff (Y)");
  assert.equal(m.ram[0x033a + 0x0f], 0x01, "second half unclamped");
});

test("loc_c473: negative below 0xfc clamps to 0xfc/Y=0x01 (bmi path)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0xc900); m._retPushed = false;
  m.regs.x = 0x00; // single write at index 0 (and $38 dec goes negative after)
  m.ram[0x61] = 0x00; m.ram[0x62] = 0x80; // negative, < 0xfc -> clamp lower to 0xfc, Y=0x01
  m.ram[0x63] = 0x00; m.ram[0x64] = 0xfe; // negative, >= 0xfc -> no clamp

  loc_c473(m);

  // $38 starts 0x00 -> writes at index 0 first pass, then dec to 0xff (X reads $38 each pass)
  assert.equal(m.ram[0x031a + 0x00], 0xfc, "first-half lower clamp -> 0xfc");
  assert.equal(m.ram[0x032a + 0x00], 0x01, "first-half clamp sign Y=0x01");
  assert.equal(m.ram[0x033a + 0x00], 0xfe, "second half kept 0xfe (>= 0xfc)");
});
