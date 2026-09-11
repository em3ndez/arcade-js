// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9bcf (ROM 0x9bcf-0x9bcf) -- a bare rts leaf: pops the return address and charges
// 6 cycles, touching no memory or registers.
// Run: node --test games/tempest/translated/test/equivalence-9bcf.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9bcf } from "../loc_9bcf.js";

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

test("bare rts: pops return, +1, 6 cycles, no side effects", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  loc_9bcf(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.regs.s, 0xfd, "stack balanced");
  assert.equal(m.cycles, 6);
});
