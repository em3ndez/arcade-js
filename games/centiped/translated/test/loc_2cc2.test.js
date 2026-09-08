// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2cc2 (ROM 0x2cc2-0x2ce9). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2cc2.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2cc2 } from "../loc_2cc2.js";

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

// Entry carry CLEAR, X=3, $86 non-negative: arms every field including $b7, zeroes $b2-$b5/$b8, returns C=0.
function setup() {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.regs.fC = false; // BCS $2ca6 not taken
  m.regs.x = 0x03;   // STA $34,X -> $37
  m.ram[0x0086] = 0x00; // non-negative -> BMI not taken -> $b7 armed
  return m;
}

test("loc_2cc2: arms the slot, sets $b7, zeroes $b2-$b5/$b8, C=0; 58 T; RTS", () => {
  const m = setup();
  loc_2cc2(m);

  assert.equal(m.regs.a, 0x00, "A = last LDA #$00");
  assert.equal(m.regs.x, 0x03, "X unchanged");
  assert.equal(m.ram[0x0087], 0x30, "$87 timer armed");
  assert.equal(m.ram[0x0043], 0x20, "$43 = 0x20");
  assert.equal(m.ram[0x0037], 0xff, "$34,X = 0xff");
  assert.equal(m.ram[0x0042], 0x28, "$42 = 0x28");
  assert.equal(m.ram[0x00b7], 0x13, "$b7 armed (BMI fell through)");
  assert.equal(m.ram[0x00b2], 0x00, "$b2 zeroed");
  assert.equal(m.ram[0x00b3], 0x00, "$b3 zeroed");
  assert.equal(m.ram[0x00b4], 0x00, "$b4 zeroed");
  assert.equal(m.ram[0x00b5], 0x00, "$b5 zeroed");
  assert.equal(m.ram[0x00b8], 0x00, "$b8 zeroed");
  assert.equal(m.regs.fC, false, "C cleared by CLC");
  assert.equal(m.regs.fZ, true, "Z set from A = 0x00");
  assert.equal(m.cycles, 58, "58 T on this path");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no bail: $2ca6 not called");
  assert.deepEqual(m.pcSeq, [
    0x2cc4, 0x2cc6, 0x2cc8, 0x2cca, 0x2ccc, 0x2cce, 0x2cd0, 0x2cd2, 0x2cd4, 0x2cd6,
    0x2cd8, 0x2cda, 0x2cdc, 0x2cde, 0x2ce0, 0x2ce2, 0x2ce4, 0x2ce6, 0x2ce8, 0x2ce9, 0x1234,
  ], "executed instruction/step boundary sequence");
});

test("loc_2cc2 CARRY-IN: entry carry set RTS-to-caller ($2ca6 is a bare RTS), no fields touched", () => {
  const m = setup();
  m.regs.fC = true;
  loc_2cc2(m);
  assert.deepEqual(m.calls, [], "BCS $2ca6 taken -> the RTS returns to the caller, not a call");
  assert.equal(m.ram[0x0087], 0x00, "no field armed on the bail path");
  assert.equal(m.cycles, 3 + 6, "taken branch 3T + RTS 6T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
});

test("loc_2cc2 MUTATION: STA $34,X mischarged 3T not 4T is caught by the T-state total", () => {
  const m = setup();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2cd0 ? 3 : c); // only STA $34,X steps to 0x2cd0
  loc_2cc2(m);
  assert.notEqual(m.cycles, 58, "a mischarged cycle blows the golden T-state total");
});
