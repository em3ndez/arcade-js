// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_af77 (ROM 0xaf77) -- jsr aaf5, then A=0x29/Y=1 and tail-jump dfb1.
// Run: node --test games/tempest/translated/test/equivalence-af77.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_af77 } from "../loc_af77.js";

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

test("loc_af77: jsr aaf5, then A=0x29 Y=1, tail-jump dfb1; 13 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;

  loc_af77(m);

  assert.equal(m.regs.a, 0x29, "A = 0x29");
  assert.equal(m.regs.y, 0x01, "Y = 0x01");
  assert.equal(m.pc, 0xdfb1, "jmp dfb1 tail");
  assert.deepEqual(m.calls, [0xaaf5, 0xdfb1], "jsr aaf5 then tail-jump dfb1");
  assert.equal(m.cycles, 6 + 2 + 2 + 3, "13 T (jsr, lda, ldy, jmp)");
});
