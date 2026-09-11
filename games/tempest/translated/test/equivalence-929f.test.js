// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_929f (ROM 0x929f-0x92ac) -- zero $030a..$0311, then $0116. Run:
//   node --test games/tempest/translated/test/equivalence-929f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_929f } from "../loc_929f.js";

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

test("loc_929f: zeroes $030a..$0311 plus $0116; 93 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x7000);
  for (let a = 0x030a; a <= 0x0311; a++) m.ram[a] = 0xcc;
  m.ram[0x0116] = 0xcc;
  loc_929f(m);
  for (let a = 0x030a; a <= 0x0311; a++) assert.equal(m.mem.read8(a), 0x00, `zeroed ${a.toString(16)}`);
  assert.equal(m.mem.read8(0x0116), 0x00, "$0116 zeroed");
  assert.equal(m.mem.read8(0x0312), 0x00, "one past the block untouched");
  assert.equal(m.regs.x, 0xff, "x underflowed at loop exit");
  assert.equal(m.pc, 0x7001, "rts -> pushed+1");
  assert.equal(m.cycles, 2 + 2 + (7 * 10 + 9) + 4 + 6, "93 T");
});
