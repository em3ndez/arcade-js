// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a3ca (ROM 0xa3ca-0xa3d3). Falls through into loc_a3d4 (recorded as a call with
// pc left at 0xa3d4). Run: node --test games/tempest/translated/test/equivalence-a3ca.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a3ca } from "../loc_a3ca.js";

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

test("loc_a3ca: saves A across jsr ccc1, copies $02df,y -> $29, restores A, falls into a3d4, 20 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x42; m.regs.y = 0x02;
  m.ram[0x02e1] = 0x99; // $02df + 2
  loc_a3ca(m);
  assert.equal(m.ram[0x29], 0x99, "$02df,y -> $29");
  assert.equal(m.regs.a, 0x42, "A restored by pla after the jsr");
  assert.equal(m.regs.s, 0xfd, "stack balanced (pha/pla + jsr/ret)");
  assert.deepEqual(m.calls, [0xccc1, 0xa3d4], "jsr ccc1 then fall into a3d4");
  assert.equal(m.pc, 0xa3d4, "falls through to loc_a3d4");
  assert.equal(m.cycles, 20, "pha3 + jsr6 + lda4 + sta3 + pla4");
});
