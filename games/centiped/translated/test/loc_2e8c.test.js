// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2e8c (ROM 0x2e8c-0x2e94). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2e8c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2e8c } from "../loc_2e8c.js";

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

// STA does not touch flags, so BNE/BEQ read the Z that the caller left in the accumulator's status.
test("loc_2e8c: nonzero velocity (Z clear) stores $55 and branches to loc_2e9d; 9 T", () => {
  const m = makeMachine();
  m.regs.a = 0x55;
  m.regs.fZ = false; // BNE $2e9d taken

  loc_2e8c(m);

  assert.equal(m.ram[0x0060], 0x55, "STA $60");
  assert.equal(m.ram[0x008b], 0x55, "STA $8b");
  assert.equal(m.cycles, 3 + 3 + 3, "9 T");
  assert.equal(m.pc, 0x2e9d, "BNE $2e9d taken");
  assert.deepEqual(m.pcSeq, [0x2e8e, 0x2e90, 0x2e9d], "step boundaries");
  assert.deepEqual(m.calls, [0x2e9d], "branches to loc_2e9d");
});

test("loc_2e8c: zero velocity (Z set) stores 0, BEQ $2e9a routes through the JMP to loc_20e8; 14 T", () => {
  const m = makeMachine();
  m.regs.a = 0x00;
  m.regs.fZ = true; // BNE not taken, BEQ $2e9a taken

  loc_2e8c(m);

  assert.equal(m.ram[0x0060], 0x00, "STA $60");
  assert.equal(m.ram[0x008b], 0x00, "STA $8b");
  assert.equal(m.cycles, 3 + 3 + 2 + 3 + 3, "14 T (incl. the $2e9a JMP charge)");
  assert.equal(m.pc, 0x20e8, "$2e9a is JMP $20e8 -> lands on loc_20e8");
  assert.deepEqual(m.pcSeq, [0x2e8e, 0x2e90, 0x2e92, 0x2e9a, 0x20e8], "step boundaries");
  assert.deepEqual(m.calls, [0x20e8], "routes the interior JMP to the loc_20e8 head");
});

test("loc_2e8c MUTATION: BNE-taken step mischarged 4T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.a = 0x55;
  m.regs.fZ = false;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2e9d ? 4 : c);
  loc_2e8c(m);
  assert.notEqual(m.cycles, 9, "a mischarged cycle blows the golden T-state total");
});
