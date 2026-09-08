// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2932 (ROM 0x2932-0x2950). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2932.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2932 } from "../loc_2932.js";

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

test("loc_2932: seeds $42/$43/$62/$63/$72/$73 from consts EOR $F0-$F2; 46 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1fff); // RTS -> 0x2000
  m.ram[0x00f2] = 0x33;
  m.ram[0x00f0] = 0x55;
  m.ram[0x00f1] = 0x0c;

  loc_2932(m);

  assert.equal(m.ram[0x0043], 0x23, "$43 = 0x10 ^ $F2(0x33)");
  assert.equal(m.ram[0x0063], 0x80, "$63 = 0x80");
  assert.equal(m.ram[0x0062], 0x80, "$62 = 0x80");
  assert.equal(m.ram[0x0073], 0x5d, "$73 = 0x08 ^ $F0(0x55)");
  assert.equal(m.ram[0x0072], 0x00, "$72 = 0x0c ^ $F1(0x0c)");
  assert.equal(m.ram[0x0042], 0x22, "$42 = 0x11 ^ $F2(0x33)");
  assert.equal(m.regs.a, 0x22, "A = last EOR result");
  assert.equal(m.regs.fZ, false, "Z clear (A = 0x22)");
  assert.equal(m.regs.fN, false, "N clear (A = 0x22)");
  assert.equal(m.cycles, 46, "46 T");
  assert.equal(m.pc, 0x2000, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_2932 MUTATION: EOR $F2 mischarged 4T not 3T blows the golden T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1fff);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2936 ? 4 : c); // first EOR $F2 steps to 0x2936
  loc_2932(m);
  assert.notEqual(m.cycles, 46, "a mischarged cycle blows the golden T-state total");
});
