// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_335e (ROM 0x335e-0x3360). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_335e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_335e } from "../loc_335e.js";

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

test("loc_335e: X=0x02, then falls through into loc_3360; 2 T", () => {
  const m = makeMachine();

  loc_335e(m);

  assert.equal(m.regs.x, 0x02, "X loaded with 0x02");
  assert.equal(m.regs.fN, false, "N clear (0x02 bit7=0)");
  assert.equal(m.regs.fZ, false, "Z clear (0x02 != 0)");
  assert.equal(m.cycles, 2, "2 T");
  assert.equal(m.pc, 0x3360, "PC at the fall-through target 0x3360");
  assert.deepEqual(m.calls, [0x3360], "control continues into loc_3360");
});

test("loc_335e MUTATION: LDX #$02 mischarged 3T not 2T is caught by the T-state total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3360 ? 3 : c); // the LDX #$02 step lands at 0x3360
  loc_335e(m);
  assert.notEqual(m.cycles, 2, "a mischarged cycle blows the golden T-state total");
});
