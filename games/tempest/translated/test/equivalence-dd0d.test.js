// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_dd0d (ROM 0xdd0d-0xdd26). Author-derived 6502 harness; callees are recorded &
// their JSR return balanced. loc_dd0d ends by falling through into loc_dd27.
// Run: node --test games/tempest/translated/test/equivalence-dd0d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_dd0d } from "../loc_dd0d.js";

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

test("loc_dd0d: 5 jsr sequence, tay, falls into loc_dd27", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x0d00, 0x11);
  m.mem.write8(0x0e00, 0x22);

  loc_dd0d(m);

  assert.deepEqual(m.calls, [0xdf53, 0xdf6a, 0xdd29, 0xdd27, 0xdbe0, 0xdd27],
    "jsr df53/df6a/dd29/dd27/dbe0 then fall into loc_dd27");
  assert.equal(m.regs.a, 0xe8, "A still $e8 (dbe0 stubbed)");
  assert.equal(m.regs.y, 0xe8, "tay copied A into Y");
  assert.equal(m.pc, 0xdd27, "fall-through target");
  assert.equal(m.cycles, 44, "6+2+6+2+4+6+4+6+6+2");
});
