// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a3d4 (ROM 0xa3d4-0xa3d5). One instruction (sta $2c) that falls through into
// loc_a3d6 (recorded as a call). Run: node --test games/tempest/translated/test/equivalence-a3d4.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a3d4 } from "../loc_a3d4.js";

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

test("loc_a3d4: stores A into $2c, falls through to a3d6, 3 T", () => {
  const m = makeMachine();
  m.regs.a = 0x07;
  loc_a3d4(m);
  assert.equal(m.ram[0x2c], 0x07, "A -> $2c");
  assert.deepEqual(m.calls, [0xa3d6], "falls into loc_a3d6");
  assert.equal(m.pc, 0xa3d6, "pc at next routine");
  assert.equal(m.cycles, 3, "sta zp = 3 T");
});
