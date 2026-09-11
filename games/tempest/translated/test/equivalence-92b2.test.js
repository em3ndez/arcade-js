// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_92b2 (ROM 0x92b2-0x92c4) -- swaps $03aa,x <-> $03bc,x for x=0x11..0 via Y. Run:
//   node --test games/tempest/translated/test/equivalence-92b2.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_92b2 } from "../loc_92b2.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_92b2: swaps the two 18-byte blocks $03aa <-> $03bc; 457 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x9000);
  for (let k = 0; k <= 0x11; k++) { m.ram[0x03aa + k] = 0x10 + k; m.ram[0x03bc + k] = 0x80 + k; }
  loc_92b2(m);
  for (let k = 0; k <= 0x11; k++) {
    assert.equal(m.mem.read8(0x03aa + k), 0x80 + k, `$03aa+${k} got the $03bc value`);
    assert.equal(m.mem.read8(0x03bc + k), 0x10 + k, `$03bc+${k} got the $03aa value`);
  }
  assert.equal(m.regs.x, 0xff, "x underflowed at loop exit");
  assert.equal(m.pc, 0x9001, "rts -> pushed+1");
  assert.equal(m.cycles, 2 + (17 * 25 + 24) + 6, "457 T (18 iters, 17 taken + 1 exit)");
});
