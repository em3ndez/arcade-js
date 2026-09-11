// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a831 (ROM 0xa831-0xa839) -- clears $03aa and $0125. Minimal 6502 harness
// (Regs + flat RAM + page-1 stack seam), author-derived; the whole-machine boot-first state diff vs
// MAME is the integration check. Run: node --test games/tempest/translated/test/equivalence-a831.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a831 } from "../loc_a831.js";

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

test("loc_a831: $03aa and $0125 cleared, A=0 (Z set), returns pushed+1, 16 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.ram[0x03aa] = 0x7f;
  m.ram[0x0125] = 0xff;

  loc_a831(m);

  assert.equal(m.ram[0x03aa], 0x00, "$03aa cleared");
  assert.equal(m.ram[0x0125], 0x00, "$0125 cleared");
  assert.equal(m.regs.a, 0x00, "A = 0");
  assert.equal(m.regs.fZ, true, "A=0 -> Z set");
  assert.equal(m.regs.fN, false, "A=0 -> N clear");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no subroutine calls");
  assert.equal(m.cycles, 2 + 4 + 4 + 6, "16 T: lda# + sta abs + sta abs + rts");
});
