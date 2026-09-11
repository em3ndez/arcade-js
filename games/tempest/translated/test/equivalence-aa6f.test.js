// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aa6f (ROM 0xaa6f-0xaa76) -- jsr $a8b4, A=0/X=6, tail-jmp $ab17.
// Run: node --test games/tempest/translated/test/equivalence-aa6f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aa6f } from "../loc_aa6f.js";

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

// only path: jsr $a8b4 (push), immediates, tail-jmp $ab17 (no push)
test("loc_aa6f: jsr $a8b4, A=0/X=6, tail-jmp $ab17", () => {
  const m = makeMachine(); m.regs.s = 0xfd;
  loc_aa6f(m);
  assert.deepEqual(m.calls, [0xa8b4, 0xab17], "jsr then tail-jmp, both delegates");
  assert.deepEqual(m.retAddrs, [0xaa71], "only the jsr pushed a return (0xaa6f+2); tail jmp did not");
  assert.equal(m.regs.a, 0x00, "lda #0");
  assert.equal(m.regs.x, 0x06, "ldx #6");
  assert.equal(m.pc, 0xab17, "tail jmp lands on the delegate entry");
  assert.equal(m.cycles, 13, "jsr 6 + lda 2 + ldx 2 + jmp 3");
});
