// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aa69 (ROM 0xaa69) -- jsr 0xaa92 then jmp 0xa8e7. Minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-aa69.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aa69 } from "../loc_aa69.js";

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

test("loc_aa69: calls 0xaa92 then tail-jumps to 0xa8e7, 9 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;

  loc_aa69(m);

  assert.deepEqual(m.calls, [0xaa92, 0xa8e7], "jsr 0xaa92 then jmp 0xa8e7");
  assert.equal(m.pc, 0xa8e7, "final PC is the jmp target");
  assert.equal(m.cycles, 9, "6 (jsr) + 3 (jmp abs)");
});

test("loc_aa69: jsr pushes the return address (0xaa6b) that its call pulls", () => {
  // Disable auto-balance to observe the pushed return address on the stack.
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.call = function (a) { this.calls.push(a); return undefined; };

  loc_aa69(m);

  // jsr at 0xaa69 pushes 0xaa6b (return-1); stack top (0x0100|s+1..) holds lo=0x6b, hi=0xaa.
  assert.equal(m.mem.read8(0x0100 | ((m.regs.s + 1) & 0xff)), 0x6b, "low byte of 0xaa6b pushed");
  assert.equal(m.mem.read8(0x0100 | ((m.regs.s + 2) & 0xff)), 0xaa, "high byte of 0xaa6b pushed");
});
