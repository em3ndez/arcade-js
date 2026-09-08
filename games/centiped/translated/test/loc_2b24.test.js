// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2b24 (ROM 0x2b24-0x2b60). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. m.call is a no-op recorder, so LDY #$00 at 0x2b2b sets the $2B30 branch (BNE not taken).
// Run: node --test games/centiped/translated/test/loc_2b24.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2b24 } from "../loc_2b24.js";

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

test("loc_2b24: mid-range 0x50 walks the ladder to the 0x30 clamp, stores $73, falls through to loc_2b60", () => {
  const m = makeMachine();
  m.regs.a = 0x50; m.regs.fC = false; // ADC $73 seed
  m.ram[0x0073] = 0x00; // addend 0; later overwritten by STA $73
  m.ram[0x0063] = 0xaa; // LDY $63 -> STY $8b
  m.ram[0x0086] = 0x00; // $86 >= 0 -> BPL $2b5d taken -> out to loc_2b60

  loc_2b24(m);

  assert.equal(m.ram[0x008b], 0xaa, "STY $8b copied $63");
  assert.equal(m.ram[0x0073], 0x30, "0x31<=0x50<0x80 clamps to 0x30 and STA $73");
  assert.equal(m.regs.a, 0x30, "A holds the clamp value 0x30");
  assert.equal(m.pc, 0x2b60, "BPL out lands at loc_2b60");
  assert.deepEqual(m.calls, [0x2c2b, 0x2b60], "the $2C2B check then the BPL out-branch");
  assert.equal(m.cycles, 54, "golden T-state total for the 0x2b47 ladder arm + out-branch");
});

test("loc_2b24: A<0x08 clamps to 0x08; $86<0 returns via the 0x2b5f RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1233); // RTS -> 0x1234
  m.regs.a = 0x02; m.regs.fC = false;
  m.ram[0x0073] = 0x00;
  m.ram[0x0063] = 0x11;
  m.ram[0x0086] = 0x80; // $86 < 0 -> BPL not taken -> RTS

  loc_2b24(m);

  assert.equal(m.ram[0x0073], 0x08, "0x02 < 0x08 clamps to 0x08");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [0x2c2b], "no out-branch on the RTS path");
});

test("loc_2b24 MUTATION: flipping the low clamp to 0xf0 (BCS taken not modelled) is caught", () => {
  const m = makeMachine();
  m.regs.a = 0x50; m.regs.fC = false;
  m.ram[0x0073] = 0x00; m.ram[0x0063] = 0xaa; m.ram[0x0086] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2b47 ? 2 : c); // BCC $2b47 taken mischarged 3T->2T
  loc_2b24(m);
  assert.notEqual(m.cycles, 54, "a mischarged ladder branch blows the golden T-state total");
});
