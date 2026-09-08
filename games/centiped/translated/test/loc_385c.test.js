// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_385c (ROM 0x385c-0x3871). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_385c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_385c } from "../loc_385c.js";

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

// C set at entry -> BCC $3862 not taken; AND #$0F keeps 0x25->0x05; BEQ not taken; CLC; ORA #$20 -> 0x25;
// PHP; CMP #$2A (0x25<0x2A -> C=0) -> BCC $386C taken (skips SBC); JSR $3836; PLP restores the PHP flags; RTS.
test("loc_385c: fold+wrap normalize path, PLP restores saved flags; 34 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3850); // RTS -> pulled + 1 = 0x3851
  m.regs.a = 0x25;
  m.regs.fC = true; // enters with carry set -> 385c BCC not taken

  loc_385c(m);

  assert.equal(m.regs.a, 0x25, "A = (0x25 & 0x0F) | 0x20 = 0x25");
  assert.equal(m.regs.fN, false, "N restored by PLP to the PHP-time value (A=0x25, bit7=0)");
  assert.equal(m.regs.fZ, false, "Z restored by PLP");
  assert.equal(m.regs.fC, false, "C restored by PLP to the CLC value at 0x3862");
  assert.deepEqual(m.calls, [0x3836], "one JSR to the emit sub");
  assert.equal(m.cycles, 2 + 2 + 2 + 2 + 2 + 3 + 2 + 3 + 6 + 4 + 6, "34 T");
  assert.equal(m.pc, 0x3851, "RTS returns to pushed + 1");
});

test("loc_385c MUTATION: PLP mischarged 3T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3850);
  m.regs.a = 0x25;
  m.regs.fC = true;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3870 ? 3 : c); // the PLP step lands at 0x3870
  loc_385c(m);
  assert.notEqual(m.cycles, 34, "a mischarged PLP blows the golden T-state total");
});
