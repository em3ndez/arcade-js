// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b0e7 (ROM 0xb0e7-0xb101) -- straight-line fixed-init block, then rts.
// Run: node --test games/tempest/translated/test/equivalence-b0e7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b0e7 } from "../loc_b0e7.js";

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
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

test("loads the fixed init block, no calls, rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  loc_b0e7(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x00], 0x0a);
  assert.equal(m.ram[0x02], 0x00);
  assert.equal(m.ram[0x04], 0xdf);
  assert.equal(m.ram[0x01], 0x12);
  assert.equal(m.ram[0x014e], 0x19);
  assert.equal(m.ram[0x014d], 0x18);
  assert.equal(m.regs.a, 0x18, "last lda leaves 0x18 in A");
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.equal(m.cycles, 38);
});
