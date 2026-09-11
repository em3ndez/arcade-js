// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b5eb (ROM 0xb5eb-0xb60a) -- jump-table entry. $0283,x sign picks:
// positive -> ldy $02b9,x; ldx $55; lda $b60b,x; jsr $bda0 (clv/bvc join to rts);
// negative -> jsr $b634; ldy #0; jsr $bdcb. Asserts each jsr's pushed return = jsraddr+2.
// Run: node --test games/tempest/translated/test/equivalence-b5eb.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b5eb } from "../loc_b5eb.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    // record each JSR's pushed return (must be jsraddr+2), then pop to balance S
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

test("positive $0283,x -> lda-table + jsr $bda0, clv/bvc join to rts (no page cross)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;             // positive -> bmi NOT taken
  m.ram[0x02b9] = 0x07;             // -> y
  m.ram[0x0055] = 0x00;             // -> x for lda $b60b,x
  m.ram[0xb60b] = 0x42;             // table value -> a
  loc_b5eb(m);
  assert.equal(m.ram[0x9e], 0x03, "sta $9e = 3");
  assert.equal(m.regs.y, 0x07, "ldy $02b9,x");
  assert.equal(m.regs.a, 0x42, "lda $b60b,x");
  assert.deepEqual(m.calls, [0xbda0]);
  assert.equal(m.retAddrs[0], 0xb5fe, "jsr $bda0 pushes b5fc+2");
  assert.equal(m.pc, 0x5001, "rts -> caller return + 1");
  assert.equal(m.cycles, 39);
});

test("negative $0283,x -> jsr $b634; ldy #0; jsr $bdcb", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x80;             // negative -> bmi taken
  loc_b5eb(m);
  assert.equal(m.ram[0x9e], 0x03, "sta $9e = 3");
  assert.equal(m.regs.y, 0x00, "ldy #0 before final jsr");
  assert.deepEqual(m.calls, [0xb634, 0xbdcb]);
  assert.equal(m.retAddrs[0], 0xb604, "jsr $b634 pushes b602+2");
  assert.equal(m.retAddrs[1], 0xb609, "jsr $bdcb pushes b607+2");
  assert.equal(m.pc, 0x5001, "rts -> caller return + 1");
  assert.equal(m.cycles, 32, "bmi 0xb602 same-page taken = 3 (no phantom page-cross)");
});

test("page-cross edge: x=0x80 crosses $0283/$02b9, $55 crosses $b60b", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;
  m.ram[0x0303] = 0x00;             // $0283+0x80, positive -> +1 cross
  m.ram[0x0339] = 0x11;             // $02b9+0x80 -> y, +1 cross
  m.ram[0x0055] = 0xf5;             // ldx -> 0xf5
  m.ram[0xb700] = 0x99;             // $b60b+0xf5 = $b700 -> a, +1 cross
  loc_b5eb(m);
  assert.equal(m.regs.y, 0x11, "ldy $0339");
  assert.equal(m.regs.a, 0x99, "lda $b700");
  assert.deepEqual(m.calls, [0xbda0]);
  assert.equal(m.retAddrs[0], 0xb5fe, "jsr $bda0 pushes b5fc+2");
  assert.equal(m.pc, 0x5001, "rts -> caller return + 1");
  assert.equal(m.cycles, 42);
});
