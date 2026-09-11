// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a888 (ROM 0xa888). Author-derived minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-a888.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a888 } from "../loc_a888.js";

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

test("loc_a888: $0125 < 3 -> bcc, rts (no scan)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.mem.write8(0x0125, 0x02);

  loc_a888(m);

  assert.equal(m.pc, 0x2001, "rts to pushed+1");
  assert.deepEqual(m.calls, []);
  assert.equal(m.cycles, 15, "4+2+3+6");
});

test("loc_a888: $0125>=3 & even, entry found -> clear bits0-1 of $028a,y, jmp loc_a398", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x0125, 0x04);   // >=3, and #1 == 0 -> bne fall
  m.mem.write8(0x011c, 0x02);   // y start
  m.mem.write8(0x02e1, 0x05);   // $02df+2 nonzero -> found at y=2
  m.mem.write8(0x028c, 0x07);   // $028a+2

  loc_a888(m);

  assert.equal(m.mem.read8(0x028c), 0x04, "0x07 & 0xfc = 0x04");
  assert.equal(m.pc, 0xa398, "tail jmp target");
  assert.deepEqual(m.calls, [0xa398]);
  assert.equal(m.cycles, 37, "found on first scanned entry");
});

test("loc_a888: no nonzero entry -> scan down, zero $0125, rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.mem.write8(0x0125, 0x04);   // even, >=3
  m.mem.write8(0x011c, 0x01);   // scan y=1 then y=0 then dey->0xff exits
  // all $02df entries left zero

  loc_a888(m);

  assert.equal(m.mem.read8(0x0125), 0x00, "no entry -> $0125 zeroed");
  assert.equal(m.pc, 0x3001, "rts to pushed+1");
  assert.deepEqual(m.calls, []);
});
