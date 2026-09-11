// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_d8a9 (ROM 0xd8a9). Minimal 6502 harness (Regs + flat RAM + page-1 stack +
// call recorder that pops a jsr's pushed return). Run: node --test games/tempest/translated/test/equivalence-d8a9.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_d8a9 } from "../loc_d8a9.js";

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
    call(target) { this.calls.push(target); this.pc = target; if (this._retPushed) { this._retPushed = false; this.pull16(); } },
  };
}

test("loc_d8a9: A->$29, Y->A, jsr df75, then jmp dfb1; A=0x29 Y=0x01; 18 T", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.regs.a = 0xab;
  m.regs.y = 0x07;

  loc_d8a9(m);

  assert.equal(m.mem.read8(0x29), 0xab, "d8a9 sta $29 stores the incoming A");
  assert.equal(m.regs.a, 0x29, "d8af lda #0x29");
  assert.equal(m.regs.y, 0x01, "d8b1 ldy #0x01");
  assert.deepEqual(m.calls, [0xdf75, 0xdfb1], "jsr df75 then tail-jmp dfb1");
  assert.equal(m.pc, 0xdfb1, "final PC at the jmp target");
  assert.equal(m.cycles, 3 + 2 + 6 + 2 + 2 + 3, "18 T");
});
