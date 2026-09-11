// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a33a (ROM 0xa33a-0xa342). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam); JSRs are opaque (harness records + balances the pushed return). Run:
// node --test games/tempest/translated/test/equivalence-a33a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a33a } from "../loc_a33a.js";

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
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_a33a: A=5, jsr $a352, dec $0201, rts; 20 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1233); // rts -> 0x1234
  m.ram[0x0201] = 0x10;
  loc_a33a(m);
  assert.equal(m.regs.a, 0x05, "lda #5");
  assert.equal(m.regs.fZ, false, "A=5 not zero");
  assert.equal(m.regs.fN, false, "A=5 not negative");
  assert.equal(m.ram[0x0201], 0x0f, "$0201 decremented");
  assert.deepEqual(m.calls, [0xa352], "jsr $a352 (mid-routine entry)");
  assert.equal(m.pc, 0x1234, "rts -> pushed return + 1 (jsr balanced)");
  assert.equal(m.cycles, 20, "lda 2 + jsr 6 + dec abs 6 + rts 6");
});

test("loc_a33a: dec wraps 0x00 -> 0xff and sets N (RMW result flags)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000);
  m.ram[0x0201] = 0x00;
  loc_a33a(m);
  assert.equal(m.ram[0x0201], 0xff, "0x00 - 1 wraps to 0xff");
  assert.equal(m.regs.fN, true, "dec result 0xff sets N");
  assert.equal(m.regs.fZ, false, "0xff not zero");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
});

test("loc_a33a: dec 0x01 -> 0x00 sets Z", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x3000);
  m.ram[0x0201] = 0x01;
  loc_a33a(m);
  assert.equal(m.ram[0x0201], 0x00, "0x01 - 1 = 0");
  assert.equal(m.regs.fZ, true, "dec result 0 sets Z");
  assert.equal(m.cycles, 20, "cycle total invariant to data");
});
