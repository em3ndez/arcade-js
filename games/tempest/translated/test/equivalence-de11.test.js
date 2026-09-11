// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_de11 (ROM 0xde11-0xde1a). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// No rts: the routine falls through into loc_de1b (the harness records the call, does not run it).
// Run: node --test games/tempest/translated/test/equivalence-de11.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_de11 } from "../loc_de11.js";

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

test("loc_de11: $01c7=7, $01c8=0, falls through into loc_de1b; 12 T", () => {
  const m = makeMachine();
  m.ram[0x01c7] = 0x55; // overwritten, not OR'd
  m.ram[0x01c8] = 0xaa; // overwritten

  loc_de11(m);

  assert.equal(m.ram[0x01c7], 0x07, "$01c7 = 0x07 (plain store, not OR)");
  assert.equal(m.ram[0x01c8], 0x00, "$01c8 = 0x00 (plain store)");
  assert.equal(m.regs.a, 0x00, "A left holding the last immediate (0x00)");
  assert.equal(m.pc, 0xde1b, "PC at loc_de1b entry after the last store");
  assert.deepEqual(m.calls, [0xde1b], "fall-through delegates to loc_de1b");
  assert.equal(m.cycles, 2 + 4 + 2 + 4, "lda2 sta4 lda2 sta4 = 12 T (no rts)");
});

test("loc_de11 MUTATION: an OR instead of a store would leave $01c7=0x57 not 0x07", () => {
  const m = makeMachine();
  m.ram[0x01c7] = 0x50;
  loc_de11(m);
  assert.equal(m.ram[0x01c7], 0x07, "plain store zeroes the prior 0x50 bits, proving it is sta not ora");
});
