// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ccf2 (ROM 0xccf2-0xccf5) -- seeds A=$7f, unconditional branch-delegate
// to $ccc3 (bne always taken, same-page 3 cyc, no push).
// Run: node --test games/tempest/translated/test/equivalence-ccf2.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ccf2 } from "../loc_ccf2.js";

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

test("seeds A=$7f, delegates to $ccc3 (no push)", () => {
  const m = makeMachine();
  loc_ccf2(m);
  assert.equal(m.regs.a, 0x7f, "A seeded to $7f");
  assert.deepEqual(m.calls, [0xccc3], "branch-delegate target");
  assert.equal(m.retAddrs, undefined, "branch, not jsr -> nothing pushed");
  assert.equal(m.pc, 0xccc3, "landed at delegate body");
  assert.equal(m.cycles, 5, "lda 2 + bne taken 3");
});
