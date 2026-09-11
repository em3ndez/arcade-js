// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_bcfd (ROM 0xbcfd-0xbd08): $55=A, $56/$58 from tables $0435/$0445,Y, then falls
// through into loc_bd09 (harness records the delegate call). Run: node --test games/tempest/translated/test/equivalence-bcfd.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_bcfd } from "../loc_bcfd.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], _retPushed: false,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_bcfd: writes $55/$56/$58, falls through to loc_bd09; 17 T", () => {
  const m = makeMachine();
  m.regs.a = 0x77;
  m.regs.y = 0x03;
  m.ram[0x0438] = 0xab; // $0435 + 3
  m.ram[0x0448] = 0xcd; // $0445 + 3

  loc_bcfd(m);

  assert.equal(m.ram[0x55], 0x77, "$55 = A");
  assert.equal(m.ram[0x56], 0xab, "$56 = $0435,Y");
  assert.equal(m.ram[0x58], 0xcd, "$58 = $0445,Y");
  assert.deepEqual(m.calls, [0xbd09], "fall-through delegates to loc_bd09");
  assert.equal(m.pc, 0xbd09, "PC at loc_bd09");
  assert.equal(m.cycles, 3 + 4 + 3 + 4 + 3, "sta/lda/sta/lda/sta");
});
