// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2aeb (ROM 0x2aeb-0x2b24). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. m.call is a no-op recorder here, so post-JSR A/flags reflect pre-JSR state (LDA $73 sets the
// $2AF7 branch). Run: node --test games/centiped/translated/test/loc_2aeb.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2aeb } from "../loc_2aeb.js";

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

test("loc_2aeb: clamp path keeps A=0x50, stores $8b/$63, then $86>=0 tail falls through to loc_2b24", () => {
  const m = makeMachine();
  m.regs.a = 0x50; m.regs.fC = false; // ADC $63 seed
  m.ram[0x0063] = 0x00; // ADC addend 0; later overwritten by STA $63
  m.ram[0x0073] = 0x00; // LDA $73 -> Z set -> BNE $2af7 not taken (enters the clamp)
  m.ram[0x0086] = 0x00; // $86 >= 0 -> BPL $2b10 taken -> the $bb/$382d/$3226 tail
  m.ram[0x00bb] = 0x77;
  m.ram[0x0085] = 0x00;

  loc_2aeb(m);

  assert.equal(m.ram[0x008b], 0x50, "STA $8b wrote A(=0x50) after ADC/TAX");
  assert.equal(m.ram[0x0063], 0x50, "clamp kept 0x50 (0x0B<=0x50<0xF4) and STA $63");
  assert.equal(m.ram[0x00bb], 0x00, "STY $bb cleared $bb");
  assert.equal(m.ram[0x0085], 0x78, "ADC $85: 0x77 + 0x00 + C(1 from CMP #$0b) = 0x78");
  assert.equal(m.regs.a, 0x00, "final TYA -> A = Y = 0");
  assert.equal(m.pc, 0x2b24, "TYA lands at 0x2b24 (fall-through to loc_2b24)");
  assert.deepEqual(m.calls, [0x2c2b, 0x382d, 0x3226, 0x2b24], "JSR/JSR/JSR then the fall-through call");
  assert.equal(m.cycles, 71, "golden T-state total for the clamp+tail path");
});

test("loc_2aeb: $86<0 returns via the 0x2b12 RTS (no tail, no fall-through)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.regs.a = 0x50; m.regs.fC = false;
  m.ram[0x0063] = 0x00;
  m.ram[0x0073] = 0x00; // BNE $2af7 not taken
  m.ram[0x0086] = 0x80; // $86 < 0 -> BPL $2b10 not taken -> 0x2b12 RTS

  loc_2aeb(m);

  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [0x2c2b], "only the pre-clamp JSR ran; no tail");
});

test("loc_2aeb MUTATION: mischarging the BCC $2b02 taken (4T->3T) blows the golden total", () => {
  const m = makeMachine();
  m.regs.a = 0x50; m.regs.fC = false;
  m.ram[0x0063] = 0x00; m.ram[0x0073] = 0x00; m.ram[0x0086] = 0x00; m.ram[0x00bb] = 0x77; m.ram[0x0085] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2b02 ? 3 : c); // the BCC $2b02 taken step lands at 0x2b02
  loc_2aeb(m);
  assert.notEqual(m.cycles, 71, "a mischarged page-crossing branch is caught by the T-state total");
});
