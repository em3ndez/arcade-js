// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2ec6 (ROM 0x2ec6-0x2f4f). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2ec6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2ec6 } from "../loc_2ec6.js";

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

// Path: $72=0, $ef=0 -> BEQ $2ed1 taken; A=0 so BCS not taken; through 2ed5.. BNE $2f05 taken;
// the 0x2c2b JSR stub leaves Z (from LDY #$00) set, so BEQ $2f4d taken -> LDX #$0d falls into loc_2f4f.
test("loc_2ec6: BEQ->BNE->post-JSR BEQ path advances $72/$8b/$8d and falls into loc_2f4f; 78 T", () => {
  const m = makeMachine();
  m.ram[0x0072] = 0x00;
  m.ram[0x00ef] = 0x00;
  m.ram[0x00f0] = 0x00;
  m.ram[0x0073] = 0x00;
  m.ram[0x0062] = 0x10;
  m.ram[0x00f4] = 0x00;
  m.ram[0x00f3] = 0x00;

  loc_2ec6(m);

  assert.equal(m.ram[0x008b], 0x10, "STA $8b <- $62");
  assert.equal(m.ram[0x0072], 0x07, "STA $72 <- 0x07 (0x07^$f4 + $72)");
  assert.equal(m.ram[0x008d], 0x00, "STY $8d <- Y($72=0)");
  assert.equal(m.regs.a, 0x01, "A = 0x01^$f3 + $8d(0)");
  assert.equal(m.regs.x, 0x0d, "LDX #$0d");
  assert.equal(m.regs.y, 0x00, "LDY #$00");
  assert.deepEqual(m.calls, [0x2c2b, 0x2f4f], "JSR $2c2b then fall into loc_2f4f");
  assert.equal(m.pc, 0x2f4f, "falls through into loc_2f4f");
  assert.equal(m.cycles, 78, "golden T-state total for this path");
});

test("loc_2ec6 MUTATION: BNE $2f05 taken mischarged 3T not 4T (page-cross dropped) blows the total", () => {
  const m = makeMachine();
  m.ram[0x0072] = 0x00;
  m.ram[0x00ef] = 0x00;
  m.ram[0x0062] = 0x10;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2f05 ? 3 : c); // BNE taken to 0x2f05 crosses 0x2e->0x2f
  loc_2ec6(m);
  assert.notEqual(m.cycles, 78, "a dropped page-cross cycle blows the golden T-state total");
});
