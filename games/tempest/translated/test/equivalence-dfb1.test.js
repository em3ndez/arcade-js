// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_dfb1 (ROM 0xdfb1) -- loop over a run of objects, emitting hi then lo nibble of
// each ($00,x) via loc_df19; decrements X and $ae; bpl loops; rts.
// Run: node --test games/tempest/translated/test/equivalence-dfb1.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_dfb1 } from "../loc_dfb1.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_dfb1: single iteration ($ae=0), two loc_df19 calls, rts, 87 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.regs.a = 0x00;
  m.regs.y = 0x01;               // dey -> Y=0 -> $ae=0; A+ $ae=0 -> X=0
  m.mem.write8(0x00, 0x53);      // $00,x read into loc_df19 (stubbed)

  loc_dfb1(m);

  assert.deepEqual(m.calls, [0xdf19, 0xdf19], "hi then lo nibble, one iteration");
  assert.equal(m.mem.read8(0xaf), 0x00, "$af = X of the (last) iteration");
  assert.equal(m.mem.read8(0xae), 0xff, "$ae decremented below 0 -> bpl exits");
  assert.equal(m.pc, 0x1234, "rts to pushed+1");
  assert.equal(m.cycles, 87, "21 (prologue) + 60 (iter, bne fall) + 6 (rts)");
});

test("loc_dfb1: two iterations ($ae=1), four loc_df19 calls, 147 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.regs.a = 0x00;
  m.regs.y = 0x02;               // dey -> Y=1 -> $ae=1; A + $ae = 1 -> X=1
  m.mem.write8(0x00, 0x53);
  m.mem.write8(0x01, 0x24);

  loc_dfb1(m);

  assert.equal(m.calls.length, 4, "two iterations, two loc_df19 calls each");
  assert.deepEqual(m.calls, [0xdf19, 0xdf19, 0xdf19, 0xdf19]);
  assert.equal(m.mem.read8(0xae), 0xff, "$ae ends at -1");
  assert.equal(m.pc, 0x2001);
  assert.equal(m.cycles, 147, "21 (prologue) + 60 (iter1, bne taken/bpl taken) + 60 (iter2, bne fall) + 6 (rts)");
});
