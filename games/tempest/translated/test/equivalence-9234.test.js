// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9234 (ROM 0x9234-0x9245) -- $03ab=[$015b]; fill $03ac..$03bb with [$015a]. Run:
//   node --test games/tempest/translated/test/equivalence-9234.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9234 } from "../loc_9234.js";

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

test("loc_9234: copies $015b->$03ab and fills the 16-byte block; 179 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x015b] = 0xaa;
  m.ram[0x015a] = 0x33;
  loc_9234(m);
  assert.equal(m.mem.read8(0x03ab), 0xaa, "$03ab = [$015b]");
  for (let a = 0x03ac; a <= 0x03bb; a++) assert.equal(m.mem.read8(a), 0x33, `filled ${a.toString(16)}`);
  assert.equal(m.mem.read8(0x03bc), 0x00, "one past the block untouched");
  assert.equal(m.regs.x, 0xff, "x underflowed to 0xff (loop exit)");
  assert.equal(m.regs.a, 0x33, "A holds the fill value");
  assert.equal(m.pc, 0x3001, "rts -> pushed+1");
  assert.equal(m.cycles, 4 + 4 + 4 + 2 + (15 * 10 + 9) + 6, "179 T (16 iters, 15 taken + 1 exit)");
});
