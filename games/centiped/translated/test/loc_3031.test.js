// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3031 (ROM 0x3031-0x3037). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3031.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3031 } from "../loc_3031.js";

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

test("loc_3031: DEX underflow (X 0 -> 0xff) sets N, BMI $3049 taken; 5 T", () => {
  const m = makeMachine();
  m.regs.x = 0x00; // DEX -> 0xff, N set

  loc_3031(m);

  assert.equal(m.regs.x, 0xff, "DEX wrapped to 0xff");
  assert.equal(m.regs.fN, true, "N set from 0xff");
  assert.equal(m.cycles, 2 + 3, "5 T");
  assert.equal(m.pc, 0x3049, "BMI $3049 taken");
  assert.deepEqual(m.pcSeq, [0x3032, 0x3049], "step boundaries");
  assert.deepEqual(m.calls, [0x3049], "exits to loc_3049");
});

test("loc_3031: DEX to 0 (N clear), BMI not taken, JMP $2f4f; 7 T", () => {
  const m = makeMachine();
  m.regs.x = 0x01; // DEX -> 0x00, N clear, Z set

  loc_3031(m);

  assert.equal(m.regs.x, 0x00, "DEX -> 0");
  assert.equal(m.regs.fN, false, "N clear");
  assert.equal(m.regs.fZ, true, "Z set");
  assert.equal(m.cycles, 2 + 2 + 3, "7 T");
  assert.equal(m.pc, 0x2f4f, "JMP $2f4f");
  assert.deepEqual(m.pcSeq, [0x3032, 0x3034, 0x2f4f], "step boundaries");
  assert.deepEqual(m.calls, [0x2f4f], "loops via loc_2f4f");
});

test("loc_3031 MUTATION: BMI-taken step mischarged 4T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3049 ? 4 : c);
  loc_3031(m);
  assert.notEqual(m.cycles, 5, "a mischarged cycle blows the golden T-state total");
});
