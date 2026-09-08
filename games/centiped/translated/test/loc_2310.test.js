// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2310 (ROM 0x2310-0x231f). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2310.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2310 } from "../loc_2310.js";

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

test("loc_2310: $44,x negative -> BMI keeps Y=$ff; 26 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.x = 0x00;
  m.ram[0x0054] = 0x11; // $54,x -> $8b
  m.ram[0x0044] = 0x80; // negative -> BMI taken, Y stays $ff
  m.ram[0x0064] = 0x22; // $64,x -> A

  loc_2310(m);

  assert.equal(m.ram[0x008b], 0x11, "$8b = $54,x");
  assert.equal(m.regs.y, 0xff, "Y = $ff (BMI taken, LDY #$01 skipped)");
  assert.equal(m.regs.a, 0x22, "A = $64,x");
  assert.equal(m.regs.fN, false, "N from A = 0x22");
  assert.equal(m.cycles, 4 + 3 + 2 + 4 + 3 + 4 + 6, "26 T (BMI taken)");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_2310: $44,x non-negative -> Y=$01; 27 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.x = 0x00;
  m.ram[0x0054] = 0x11;
  m.ram[0x0044] = 0x00; // non-negative -> BMI not taken -> LDY #$01
  m.ram[0x0064] = 0x33;

  loc_2310(m);

  assert.equal(m.regs.y, 0x01, "Y = $01 (LDY #$01 executed)");
  assert.equal(m.regs.a, 0x33, "A = $64,x");
  assert.equal(m.cycles, 4 + 3 + 2 + 4 + 2 + 2 + 4 + 6, "27 T (BMI not taken)");
  assert.equal(m.pc, 0x1234);
});

test("loc_2310 MUTATION: BMI-taken mischarged 2T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.x = 0x00;
  m.ram[0x0044] = 0x80; // BMI taken -> steps to 0x231c
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x231c ? 2 : c);
  loc_2310(m);
  assert.notEqual(m.cycles, 26, "a mischarged branch cycle blows the golden T-state total");
});
