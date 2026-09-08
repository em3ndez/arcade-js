// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2ac7 (ROM 0x2ac7-0x2ace). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2ac7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2ac7 } from "../loc_2ac7.js";

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

test("loc_2ac7: DEX underflows to 0xff (N set) -> BMI taken -> RTS; 11 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.regs.x = 0x00;

  loc_2ac7(m);

  assert.equal(m.regs.x, 0xff, "X = 0x00 - 1 = 0xff");
  assert.equal(m.regs.fN, true, "N set from 0xff");
  assert.equal(m.cycles, 2 + 3 + 6, "DEX + BMI(taken) + RTS = 11 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no JMP on the BMI-taken path");
});

test("loc_2ac7: DEX stays non-negative -> BMI not taken -> JMP loc_2962; 7 T", () => {
  const m = makeMachine();
  m.regs.x = 0x05;

  loc_2ac7(m);

  assert.equal(m.regs.x, 0x04, "X = 0x05 - 1 = 0x04");
  assert.equal(m.regs.fN, false, "N clear from 0x04");
  assert.equal(m.cycles, 2 + 2 + 3, "DEX + BMI(not taken) + JMP = 7 T");
  assert.equal(m.pc, 0x2962, "JMP target");
  assert.deepEqual(m.calls, [0x2962], "tail JMP into loc_2962");
  assert.deepEqual(m.pcSeq, [0x2ac8, 0x2aca, 0x2962], "DEX -> BMI(nt) -> JMP");
});

test("loc_2ac7 MUTATION: BMI taken mischarged 2 T not 3 T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.x = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2acd ? 2 : c); // BMI-taken step lands at 0x2acd
  loc_2ac7(m);
  assert.notEqual(m.cycles, 11, "a mischarged taken-branch cycle blows the golden T-state total");
});
