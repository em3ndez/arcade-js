// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_dd27 (ROM 0xdd27-0xdd28) -- lda #$d0, falls into loc_dd29.
// Run: node --test games/tempest/translated/test/equivalence-dd27.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_dd27 } from "../loc_dd27.js";

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

test("loc_dd27: A=$d0, falls into loc_dd29", () => {
  const m = makeMachine();
  m.regs.a = 0x00;

  loc_dd27(m);

  assert.equal(m.regs.a, 0xd0, "A = $d0");
  assert.equal(m.regs.fN, true, "$d0 -> N set");
  assert.equal(m.regs.fZ, false, "$d0 -> Z clear");
  assert.deepEqual(m.calls, [0xdd29], "falls into loc_dd29");
  assert.equal(m.pc, 0xdd29, "fall-through target");
  assert.equal(m.cycles, 2, "lda imm = 2");
});
