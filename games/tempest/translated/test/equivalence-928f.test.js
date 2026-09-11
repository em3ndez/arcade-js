// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_928f (ROM 0x928f-0x929e) -- zero $02d3..$02de, then $0135 and $a6. Run:
//   node --test games/tempest/translated/test/equivalence-928f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_928f } from "../loc_928f.js";

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

test("loc_928f: zeroes $02d3..$02de plus $0135 and $a6; 136 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x6000);
  for (let a = 0x02d3; a <= 0x02de; a++) m.ram[a] = 0x99;
  m.ram[0x0135] = 0x99; m.ram[0xa6] = 0x99;
  loc_928f(m);
  for (let a = 0x02d3; a <= 0x02de; a++) assert.equal(m.mem.read8(a), 0x00, `zeroed ${a.toString(16)}`);
  assert.equal(m.mem.read8(0x0135), 0x00, "$0135 zeroed");
  assert.equal(m.mem.read8(0xa6), 0x00, "$a6 zeroed");
  assert.equal(m.mem.read8(0x02df), 0x00, "one past the block untouched");
  assert.equal(m.regs.x, 0xff, "x underflowed at loop exit");
  assert.equal(m.pc, 0x6001, "rts -> pushed+1");
  assert.equal(m.cycles, 2 + 2 + (11 * 10 + 9) + 4 + 3 + 6, "136 T");
});
