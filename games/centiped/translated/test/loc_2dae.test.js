// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2dae (ROM 0x2dae-0x2db6). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2dae.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2dae } from "../loc_2dae.js";

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

test("loc_2dae: DEC $94,X (X=$88) then restore X and fall into loc_2db6; 15 T", () => {
  const m = makeMachine();
  m.regs.x = 0x77;      // entry X, saved to $8d then restored
  m.ram[0x0088] = 0x03; // object index -> DEC touches $94+3 = $97
  m.ram[0x0097] = 0x05; // counter before the decrement

  loc_2dae(m);

  assert.equal(m.ram[0x008d], 0x77, "STX $8d saved the entry X");
  assert.equal(m.ram[0x0097], 0x04, "DEC $94,X decremented $97");
  assert.equal(m.regs.x, 0x77, "X restored from $8d");
  assert.equal(m.regs.fZ, false, "Z clear (last LDX loaded 0x77)");
  assert.equal(m.regs.fN, false, "N clear (0x77 bit7 = 0)");
  assert.equal(m.cycles, 3 + 3 + 6 + 3, "15 T");
  assert.equal(m.pc, 0x2db6, "PC at the fall-through target");
  assert.deepEqual(m.pcSeq, [0x2db0, 0x2db2, 0x2db4, 0x2db6], "step boundaries");
  assert.deepEqual(m.calls, [0x2db6], "falls through into loc_2db6");
});

test("loc_2dae MUTATION: DEC $94,X mischarged 7T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.x = 0x77;
  m.ram[0x0088] = 0x03;
  m.ram[0x0097] = 0x05;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2db4 ? 7 : c); // the DEC step lands at 0x2db4
  loc_2dae(m);
  assert.notEqual(m.cycles, 15, "a mischarged cycle blows the golden T-state total");
});
