// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ab0d (ROM 0xab0d) -- loads A=0x20, X=0x80, tail-jumps to df57.
// Run: node --test games/tempest/translated/test/equivalence-ab0d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ab0d } from "../loc_ab0d.js";

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

test("loc_ab0d: A=0x20, X=0x80, tail-jump df57; 7 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;

  loc_ab0d(m);

  assert.equal(m.regs.a, 0x20, "A = 0x20");
  assert.equal(m.regs.x, 0x80, "X = 0x80");
  assert.equal(m.regs.fN, true, "0x80 -> N set (from ldx)");
  assert.equal(m.pc, 0xdf57, "jmp lands at df57");
  assert.deepEqual(m.calls, [0xdf57], "tail-call df57");
  assert.equal(m.cycles, 2 + 2 + 3, "7 T (imm+imm+jmp)");
});
