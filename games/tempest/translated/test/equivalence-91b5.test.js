// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_91b5 (ROM 0x91b5) -- A*2 -> X table index, loads 16-bit pointer 0x91c6,x into
// $2a/$2b and zeroes $29. Minimal 6502 harness (Regs + flat RAM/ROM image + page-1 stack seam),
// author-derived. Run: node --test games/tempest/translated/test/equivalence-91b5.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_91b5 } from "../loc_91b5.js";

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

test("loc_91b5: index 3 -> x=6, no page cross, loads table pointer into $2a/$2b", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // RTS -> 0x2001
  m.regs.a = 0x03; // asl -> 0x06 -> x=6
  m.mem.write8(0x91c6 + 6, 0x34); // low byte of entry
  m.mem.write8(0x91c7 + 6, 0x12); // high byte of entry

  loc_91b5(m);

  assert.equal(m.regs.x, 0x06, "A*2 -> X");
  assert.equal(m.mem.read8(0x29), 0x00, "$29 cleared");
  assert.equal(m.mem.read8(0x2a), 0x34, "$2a = table[0x91cc]");
  assert.equal(m.mem.read8(0x2b), 0x12, "$2b = table[0x91cd]");
  assert.equal(m.regs.a, 0x12, "A holds last loaded byte");
  assert.equal(m.pc, 0x2001, "RTS -> pushed+1");
  assert.equal(m.cycles, 29, "2+2+2+3+4+3+4+3+6, no page cross at x=6");
});

test("loc_91b5: large index crosses the 0x9200 page boundary (+1 each abs,x load)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.regs.a = 0x1d; // asl -> 0x3a -> x=58; 0x91c6+0x3a = 0x9200 (page cross)
  m.mem.write8(0x91c6 + 0x3a, 0xaa);
  m.mem.write8(0x91c7 + 0x3a, 0xbb);

  loc_91b5(m);

  assert.equal(m.regs.x, 0x3a, "0x1d*2 = 0x3a");
  assert.equal(m.mem.read8(0x2a), 0xaa);
  assert.equal(m.mem.read8(0x2b), 0xbb);
  assert.equal(m.cycles, 31, "two abs,x loads cross the page -> 5 T each (29 + 2)");
});
