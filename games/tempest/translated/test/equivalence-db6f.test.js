// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_db6f (ROM 0xdb6f). Minimal 6502 harness (Regs + flat RAM + page-1 stack +
// call recorder). The bne at db7c tests A=0x33 (constant, always taken). Run: node --test games/tempest/translated/test/equivalence-db6f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_db6f } from "../loc_db6f.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(target) { this.calls.push(target); this.pc = target; if (this._retPushed) { this._retPushed = false; this.pull16(); } },
  };
}

test("loc_db6f: Y=$50>>1, A=0x68 into jsr df4c, then X=0x4e/A=0x33, bne to loc_db88; 22 T", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.ram[0x50] = 0x0a; // >>1 -> 0x05

  loc_db6f(m);

  assert.equal(m.regs.y, 0x05, "Y = $50 >> 1");
  assert.equal(m.regs.x, 0x4e, "db78 ldx #0x4e");
  assert.equal(m.regs.a, 0x33, "db7a lda #0x33");
  assert.deepEqual(m.calls, [0xdf4c, 0xdb88], "jsr df4c then bne into loc_db88");
  assert.equal(m.pc, 0xdb88, "final PC at the branch target");
  assert.equal(m.cycles, 3 + 2 + 2 + 2 + 6 + 2 + 2 + 3, "22 T");
});
