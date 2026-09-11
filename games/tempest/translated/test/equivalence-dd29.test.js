// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_dd29 (ROM 0xdd29-0xdd2a) -- ldx #$f8, falls into loc_dd2b.
// Run: node --test games/tempest/translated/test/equivalence-dd29.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_dd29 } from "../loc_dd29.js";

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

test("loc_dd29: X=$f8, falls into loc_dd2b", () => {
  const m = makeMachine();
  m.regs.x = 0x00;

  loc_dd29(m);

  assert.equal(m.regs.x, 0xf8, "X = $f8");
  assert.equal(m.regs.fN, true, "$f8 -> N set");
  assert.deepEqual(m.calls, [0xdd2b], "falls into loc_dd2b");
  assert.equal(m.pc, 0xdd2b, "fall-through target");
  assert.equal(m.cycles, 2, "ldx imm = 2");
});
