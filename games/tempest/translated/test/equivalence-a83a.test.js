// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a83a (ROM 0xa83a). Author-derived minimal 6502 harness (Regs + flat RAM +
// page-1 stack seam + call recorder); the whole-machine boot-first diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-a83a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a83a } from "../loc_a83a.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(addr) { this.calls.push(addr); this.pc = addr; return addr; },
  };
}

test("loc_a83a: $05 positive -> bpl to tail, clears bit7 of $4e, rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.mem.write8(0x05, 0x00);   // positive -> bpl taken
  m.mem.write8(0x4e, 0x84);

  loc_a83a(m);

  assert.equal(m.mem.read8(0x4e), 0x04, "$4e &= 0x7f");
  assert.equal(m.pc, 0x1234, "rts to pushed+1");
  assert.deepEqual(m.calls, [], "no subroutine call on the bpl path");
  assert.equal(m.cycles, 20, "3+3+3+2+3+6");
});

test("loc_a83a: $05 negative, $0125!=0 -> inc $0125, cmp table, jsr loc_a888", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x05, 0x80);     // negative -> bpl fall
  m.mem.write8(0x0125, 0x05);   // !=0 -> bne 0xa866
  m.mem.write8(0x03aa, 0x00);   // x index
  m.mem.write8(0xa883, 0x0a);   // table[0]; 0x06 < 0x0a -> bcc taken
  m.mem.write8(0x4e, 0x40);

  loc_a83a(m);

  assert.equal(m.mem.read8(0x0125), 0x06, "inc $0125");
  assert.equal(m.mem.read8(0x4e), 0x40, "$4e &= 0x7f");
  assert.deepEqual(m.calls, [0xa888], "tail work calls loc_a888");
  assert.equal(m.pc, 0xa87c, "rts pops the loc_a888 jsr return (harness stubs the callee's own rts)");
  assert.equal(m.cycles, 53, "full a866 path incl jsr + tail + rts");
});

test("loc_a83a: $05 neg, $0125==0, $0201 neg -> bmi to clv path, no table work", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.mem.write8(0x05, 0x80);
  m.mem.write8(0x0125, 0x00);   // ==0 -> bne fall
  m.mem.write8(0x0201, 0x80);   // negative -> bmi 0xa863
  m.mem.write8(0x4e, 0xff);

  loc_a83a(m);

  assert.equal(m.mem.read8(0x0125), 0x00, "$0125 untouched");
  assert.equal(m.mem.read8(0x4e), 0x7f, "only the final and #$7f ran");
  assert.equal(m.regs.fV, false, "clv cleared V");
  assert.equal(m.pc, 0x2001, "rts to pushed+1");
  assert.deepEqual(m.calls, []);
});
