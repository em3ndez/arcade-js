// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_dde9 (ROM 0xdde9-0xddec) -- lda #$04; bne $ddf3 (always taken, A!=0).
// Run: node --test games/tempest/translated/test/equivalence-dde9.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_dde9 } from "../loc_dde9.js";

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

test("loc_dde9: A=$04, bne taken -> tail-call $ddf3 (loc_ddf1 Y=$ff entry)", () => {
  const m = makeMachine();

  loc_dde9(m);

  assert.equal(m.regs.a, 0x04, "A = $04");
  assert.equal(m.regs.fZ, false, "$04 -> Z clear -> bne taken");
  assert.deepEqual(m.calls, [0xddf3], "tail-call to mid-loc_ddf1 entry $ddf3");
  assert.equal(m.pc, 0xddf3, "branch target");
  assert.equal(m.cycles, 5, "lda imm 2 + branch taken 3");
});
