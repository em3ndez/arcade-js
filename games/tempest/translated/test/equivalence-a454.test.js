// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a454 (ROM 0xa454-0xa461). For slots x=7..0, if $02d3,x != 0 call a463.
// Run: node --test games/tempest/translated/test/equivalence-a454.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a454 } from "../loc_a454.js";

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

test("loc_a454: calls a463 for each nonzero $02d3,x, high x first, 113 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1d00);
  m.ram[0x02d5] = 0x01; // slot 2 active
  m.ram[0x02d8] = 0x01; // slot 5 active
  loc_a454(m);
  assert.deepEqual(m.calls, [0xa463, 0xa463], "jsr a463 twice (x=5 then x=2)");
  assert.equal(m.regs.s, 0xfd, "stack balanced across the two jsr/ret pairs");
  assert.equal(m.pc, 0x1d01, "rts -> pushed + 1");
  assert.equal(m.cycles, 113, "6 skipped slots + 2 called slots");
});

test("loc_a454: all slots zero -> no calls, 103 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1d00);
  loc_a454(m);
  assert.deepEqual(m.calls, [], "no active slots -> no calls");
  assert.equal(m.pc, 0x1d01, "rts -> pushed + 1");
  assert.equal(m.cycles, 103, "8 skipped slots + ldx + rts");
});
