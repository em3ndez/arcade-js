// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_970b (ROM 0x970b) -- per-frame dispatcher: nine jsr's in order then a
// tail jmp to loc_a504. Minimal 6502 harness recording calls. Run: node --test .../equivalence-970b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_970b } from "../loc_970b.js";

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

test("loc_970b: calls the nine subroutines in order then tail-jumps to 0xa504, 57 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;

  loc_970b(m);

  assert.deepEqual(m.calls, [
    0x9749, 0xa23f, 0xa83a, 0x98a2, 0x9b1e, 0xa18f, 0xa2a6, 0xa454, 0xa416, 0xa504,
  ], "nine jsr targets in ROM order, then the tail jmp target");
  assert.equal(m.pc, 0xa504, "final step sets PC to the jmp target");
  assert.equal(m.regs.s, 0xfd, "each jsr's return address consumed by its call -> stack balanced");
  assert.equal(m.cycles, 9 * 6 + 3, "nine jsr (6 each) + one jmp abs (3) = 57");
});
