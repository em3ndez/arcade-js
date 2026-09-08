// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3aa7 (ROM 0x3aa7-0x3ac0). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3aa7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3aa7 } from "../loc_3aa7.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_3aa7: store A to 0x1600,X, pulse 0x1680 (8,9,8,0), load 0x1700,X into A; 39 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.regs.x = 0x10;
  m.regs.a = 0x77;
  m.ram[0x1710] = 0x3c; // read back by LDA $1700,X

  loc_3aa7(m);

  assert.equal(m.ram[0x1610], 0x77, "STA $1600,X wrote A to 0x1610");
  assert.equal(m.ram[0x1680], 0x00, "last STY $1680 leaves 0 (the 8,9,8,0 pulse ends at 0)");
  assert.equal(m.regs.a, 0x3c, "A = LDA $1700,X = 0x1710 = 0x3c");
  assert.equal(m.regs.y, 0x00, "Y ends at 0 (LDY #$00 before the last store)");
  assert.equal(m.regs.fZ, false, "Z clear from A = 0x3c");
  assert.equal(m.cycles, 5 + 2 + 4 + 2 + 4 + 2 + 4 + 2 + 4 + 4 + 6, "39 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_3aa7 MUTATION: STA $1600,X mischarged 6T not 5T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.x = 0x10;
  m.regs.a = 0x77;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3aaa ? 6 : c); // the STA $1600,X step lands at 0x3aaa
  loc_3aa7(m);
  assert.notEqual(m.cycles, 39, "a mischarged cycle blows the golden T-state total");
});
