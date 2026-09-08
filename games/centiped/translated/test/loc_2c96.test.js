// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2c96 (ROM 0x2c96-0x2cc2). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. m.call is a no-op recorder, so A after each JSR $382b equals its pre-call SBC result.
// Run: node --test games/centiped/translated/test/loc_2c96.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2c96 } from "../loc_2c96.js";

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

test("loc_2c96: X=5 in-bounds dx/dy stores $8d, sums to A=0x08 and falls through to loc_2cc2", () => {
  const m = makeMachine();
  m.regs.x = 0x05;
  m.ram[0x0059] = 0x05; // LDA $54,X  (0x54+5)
  m.ram[0x0063] = 0x00; // SBC $63 -> dx = 0x05
  m.ram[0x0069] = 0x03; // LDA $64,X  (0x64+5)
  m.ram[0x0073] = 0x00; // SBC $73 -> dy = 0x03

  loc_2c96(m);

  assert.equal(m.ram[0x008d], 0x05, "dx (0x05, in [0x07)) stored at $8d");
  assert.equal(m.regs.a, 0x08, "CLC/ADC $8d: dy(0x03) + dx(0x05) = 0x08");
  assert.equal(m.pc, 0x2cc2, "X!=0x0d -> BEQ not taken -> CMP #$0c -> fall through to loc_2cc2");
  assert.deepEqual(m.calls, [0x382b, 0x382b, 0x2cc2], "two folds then the fall-through call");
  assert.equal(m.cycles, 57, "golden T-state total for the in-bounds fall-through path");
});

test("loc_2c96: X!=0x0d with dx>=0x07 backward-branches to the 0x2ca6 RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1233); // RTS -> 0x1234
  m.regs.x = 0x05;
  m.ram[0x0059] = 0x40; // dx = 0x40
  m.ram[0x0063] = 0x00;

  loc_2c96(m);

  assert.equal(m.pc, 0x1234, "BCS $2ca6 (0x40 >= 0x07) hits the RTS, returns to pushed + 1");
  assert.deepEqual(m.calls, [0x382b], "only the first fold ran");
  assert.equal(m.cycles, 31, "golden T-state total for the early-RTS path");
});

test("loc_2c96 MUTATION: mischarging LDA $64,X (4T->3T) blows the golden total", () => {
  const m = makeMachine();
  m.regs.x = 0x05;
  m.ram[0x0059] = 0x05; m.ram[0x0063] = 0x00; m.ram[0x0069] = 0x03; m.ram[0x0073] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2caf ? 3 : c); // the LDA $64,X step lands at 0x2caf
  loc_2c96(m);
  assert.notEqual(m.cycles, 57, "a mischarged zp,X load is caught by the T-state total");
});
