// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ddf7 (ROM 0xddf7-0xddfa) -- lda #$03; bne $ddfd (always taken, A!=0).
// Run: node --test games/tempest/translated/test/equivalence-ddf7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ddf7 } from "../loc_ddf7.js";

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
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_ddf7: A=$03, bne taken -> tail-call $ddfd (loc_ddfb Y=$00 entry)", () => {
  const m = makeMachine();

  loc_ddf7(m);

  assert.equal(m.regs.a, 0x03, "A = $03");
  assert.equal(m.regs.fZ, false, "$03 -> Z clear -> bne taken");
  assert.deepEqual(m.calls, [0xddfd], "tail-call to mid-loc_ddfb entry $ddfd");
  assert.equal(m.pc, 0xddfd, "branch target");
  assert.equal(m.cycles, 5, "lda imm 2 + branch taken 3");
});
