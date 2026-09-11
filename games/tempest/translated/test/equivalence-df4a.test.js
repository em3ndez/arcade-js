// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df4a (ROM 0xdf4a-0xdf4b) -- ldy $73, falls into loc_df4c.
// Run: node --test games/tempest/translated/test/equivalence-df4a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df4a } from "../loc_df4a.js";

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

test("loc_df4a: Y = $73, falls into loc_df4c", () => {
  const m = makeMachine();
  m.mem.write8(0x0073, 0x42);

  loc_df4a(m);

  assert.equal(m.regs.y, 0x42, "Y = $73");
  assert.equal(m.regs.fZ, false, "$42 -> Z clear");
  assert.deepEqual(m.calls, [0xdf4c], "falls into loc_df4c");
  assert.equal(m.pc, 0xdf4c, "fall-through target");
  assert.equal(m.cycles, 3, "ldy zp = 3");
});
