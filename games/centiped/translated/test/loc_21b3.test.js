// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_21b3 (ROM 0x21b3-0x21be). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_21b3.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_21b3 } from "../loc_21b3.js";

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

test("loc_21b3: ($FD & 0x30) >> 3 indexes the 0x21BF table into A; 23 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.ram[0x00fd] = 0x30; // bits 5,4 set -> (0x30 & 0x30) >> 3 = 6
  m.ram[0x21c5] = 0xab; // table[6] at 0x21BF+6; distinctive, to prove the indexed read

  loc_21b3(m);

  assert.equal(m.regs.y, 0x06, "Y = (($FD & 0x30) >> 3) = 6");
  assert.equal(m.regs.a, 0xab, "A = table[Y] = ram[0x21C5]");
  assert.equal(m.regs.fC, false, "C cleared by the last LSR (0x06 has bit0 = 0)");
  assert.equal(m.regs.fN, true, "N from A = 0xAB (bit7)");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.cycles, 3 + 2 + 2 + 2 + 2 + 2 + 4 + 6, "23 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_21b3 MUTATION: LDA abs,Y mischarged 5T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x00fd] = 0x30;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x21be ? 5 : c); // the LDA $21BF,Y step lands at 0x21be
  loc_21b3(m);
  assert.notEqual(m.cycles, 23, "a mischarged cycle blows the golden T-state total");
});
