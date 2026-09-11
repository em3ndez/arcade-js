// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c765 (ROM 0xc765). Writes a {0x00,0x71} header word then tail-calls into
// loc_c772's body at c774 (y preserved). Minimal 6502 harness with recorded calls[]. Run:
// node --test games/tempest/translated/test/equivalence-c765.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c765 } from "../loc_c765.js";

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

test("loc_c765: writes {0x00,0x71} at ($74),0..1, y=2, bne tail-calls c774, 25 T", () => {
  const m = makeMachine();
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x20; // ($74) -> 0x2000

  loc_c765(m);

  assert.equal(m.ram[0x2000], 0x00, "($74),0 = 0x00 (tya)");
  assert.equal(m.ram[0x2001], 0x71, "($74),1 = 0x71");
  assert.equal(m.regs.y, 0x02, "y = 2 at the branch");
  assert.deepEqual(m.calls, [0xc774], "bne always taken -> tail-call into c774");
  assert.equal(m.pc, 0xc774, "pc at the c774 entry");
  assert.equal(m.cycles, 25, "2+2+6+2+2+6+2+3");
});
