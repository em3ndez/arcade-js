// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3836 (ROM 0x3836-0x384f). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3836.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3836 } from "../loc_3836.js";

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

test("loc_3836: A!=0 -> EOR $ef path; store via ($91), advance pointer; 43 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.regs.a = 0x03; // nonzero -> BEQ not taken -> EOR $ef executes
  m.ram[0x00ef] = 0x11;
  m.ram[0x0091] = 0x40; m.ram[0x0092] = 0x07; // ($91) pointer = 0x0740
  m.ram[0x00f3] = 0x00;

  loc_3836(m);

  assert.equal(m.ram[0x0740], 0x12, "STA ($91),Y wrote A = 0x03 ^ 0x11 = 0x12 to 0x0740");
  assert.equal(m.regs.a, 0x07, "A = $f3(0x00) + $92(0x07) + C = 0x07");
  assert.equal(m.regs.y, 0x00, "Y left at 0 (LDY #$00)");
  assert.equal(m.ram[0x0091], 0x71, "$91 = (0x20 ^ 0x11) + $91(0x40) = 0x31 + 0x40 = 0x71");
  assert.equal(m.ram[0x0092], 0x07, "$92 = $f3(0x00) + $92(0x07) + C = 0x07");
  assert.equal(m.regs.fC, false, "final ADC did not carry");
  assert.equal(m.regs.fZ, false, "A = 0x07 not zero");
  assert.equal(m.cycles, 2 + 2 + 3 + 2 + 6 + 2 + 3 + 2 + 3 + 3 + 3 + 3 + 3 + 6, "43 T (A!=0 path)");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_3836: A==0 -> BEQ taken skips EOR $ef; 41 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.a = 0x00; // BEQ taken
  m.ram[0x00ef] = 0x11;
  m.ram[0x0091] = 0x40; m.ram[0x0092] = 0x07;
  m.ram[0x00f3] = 0x00;

  loc_3836(m);

  assert.equal(m.ram[0x0740], 0x00, "store A = 0 (EOR skipped)");
  assert.equal(m.cycles, 2 + 3 + 2 + 6 + 2 + 3 + 2 + 3 + 3 + 3 + 3 + 3 + 6, "41 T (A==0 path)");
});

test("loc_3836 MUTATION: STA ($91),Y mischarged 5T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.a = 0x03;
  m.ram[0x0091] = 0x40; m.ram[0x0092] = 0x07;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x383f ? 5 : c); // the STA ($91),Y step lands at 0x383f
  loc_3836(m);
  assert.notEqual(m.cycles, 43, "a mischarged cycle blows the golden T-state total");
});
