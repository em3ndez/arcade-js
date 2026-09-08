// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2bd9 (ROM 0x2bd9-0x2c2a). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2bd9.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2bd9 } from "../loc_2bd9.js";

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

// Timer expired ($a0=0), slot Y=0x0b free (negative) -> spawn: seed the slot fields and bump $94,X.
function setup() {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x0097] = 0x01; // BEQ $2c2a not taken
  m.ram[0x0087] = 0x00; // BNE $2c2a not taken
  m.ram[0x00a0] = 0x00; // timer 0 -> BEQ $2be8 taken (spawn path)
  m.ram[0x0088] = 0x02; // X = $88
  m.ram[0x003f] = 0x80; // slot Y=0x0b negative -> BMI $2bf5 first pass
  m.ram[0x00f0] = 0x00; // EOR mask for the $64 field
  m.ram[0x100a] = 0x00; // AND #$02 == 0 -> the $04/$fe fallthrough
  m.ram[0x00a3] = 0x70; // $a1,X (X=2) >= 0x60 -> SBC #$08
  m.ram[0x0096] = 0x00; // INC $94,X target
  return m;
}

test("loc_2bd9: spawn into slot 0x0b seeds fields and bumps $96; 110 T; RTS", () => {
  const m = setup();
  loc_2bd9(m);

  assert.equal(m.regs.a, 0xfe, "A = last LDA #$fe");
  assert.equal(m.regs.x, 0x02, "X = $88");
  assert.equal(m.regs.y, 0x0b, "Y = the free slot found on the first pass");
  assert.equal(m.ram[0x003f], 0x00, "STA #$00 cleared the slot's $34 field");
  assert.equal(m.ram[0x006f], 0x40, "$64 field = 0x40 ^ $f0");
  assert.equal(m.ram[0x005f], 0x04, "$54 field ends 0x04 (AND #$02 branch)");
  assert.equal(m.ram[0x007f], 0x02, "$74 field = 0x02");
  assert.equal(m.ram[0x004f], 0xfe, "$44 field = 0xfe");
  assert.equal(m.ram[0x00a3], 0x68, "$a1,X clamped by SBC #$08");
  assert.equal(m.ram[0x00a0], 0x68, "$a0 = the clamped value");
  assert.equal(m.ram[0x0096], 0x01, "INC $94,X bumped $96");
  assert.equal(m.regs.fC, true, "C set (SBC had no borrow)");
  assert.equal(m.regs.fZ, false, "Z clear from INC result 0x01");
  assert.equal(m.cycles, 110, "110 T on this path");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
  assert.deepEqual(m.pcSeq, [
    0x2bdb, 0x2bdd, 0x2bdf, 0x2be1, 0x2be3, 0x2be8, 0x2bea, 0x2bec, 0x2bef, 0x2bf5,
    0x2bf7, 0x2bfa, 0x2bfc, 0x2bfe, 0x2c01, 0x2c03, 0x2c06, 0x2c08, 0x2c0b, 0x2c0d,
    0x2c0f, 0x2c11, 0x2c13, 0x2c15, 0x2c17, 0x2c1a, 0x2c1c, 0x2c1e, 0x2c20, 0x2c23,
    0x2c25, 0x2c28, 0x2c2a, 0x1234,
  ], "executed instruction/step boundary sequence");
});

test("loc_2bd9 MUTATION: INC $94,X mischarged 5T not 6T is caught by the T-state total", () => {
  const m = setup();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2c2a ? 5 : c); // only INC $94,X steps to 0x2c2a here
  loc_2bd9(m);
  assert.notEqual(m.cycles, 110, "a mischarged cycle blows the golden T-state total");
});
