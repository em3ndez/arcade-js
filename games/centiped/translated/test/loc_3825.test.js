// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3825 (ROM 0x3825-0x382b). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3825.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3825 } from "../loc_3825.js";

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

test("loc_3825: clears $8C then BEQ (always taken) re-enters 0x3801; 8 T", () => {
  const m = makeMachine();
  m.ram[0x008c] = 0xff; // seed non-zero to prove the clear
  m.regs.a = 0x55;      // untouched by this routine

  loc_3825(m);

  assert.equal(m.regs.y, 0x00, "Y = 0");
  assert.equal(m.ram[0x008c], 0x00, "$8C cleared");
  assert.equal(m.regs.a, 0x55, "A untouched");
  assert.equal(m.regs.fZ, true, "Z set by LDY #$00");
  assert.equal(m.cycles, 2 + 3 + 3, "8 T (BEQ taken, same page)");
  assert.equal(m.pc, 0x3801, "re-enters the draw loop at 0x3801");
  assert.deepEqual(m.calls, [0x3801], "hands to 0x3801");
  assert.deepEqual(m.pcSeq, [0x3827, 0x3829, 0x3801], "ldy, sty, beq-taken");
});

test("loc_3825 MUTATION: BEQ taken mischarged 2T not 3T is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3801 ? 2 : c);
  loc_3825(m);
  assert.notEqual(m.cycles, 8, "dropping the +1 taken penalty blows the total");
});
