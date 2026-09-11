// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_994d (ROM 0x994d-0x99a4) -- free-slot allocator scanning $02df ($011c..0). Minimal
// 6502 harness (no JSRs in this routine). Covers: slot found (main seed block), the $2a==0x0f special case
// (bit $0111 / $60ca), and the no-free-slot exit. Run: node --test games/tempest/translated/test/equivalence-994d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_994d } from "../loc_994d.js";

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
  };
}

// Seed the main-path allocation: free slot at index y=3, ordinary type ($2a != 0x0f).
function seedAlloc(m) {
  m.regs.s = 0xfd;
  m.push16(0x6000); // RTS -> 0x6001
  m.regs.x = 0x09;
  m.regs.y = 0x55; // incoming y saved to $36
  m.ram[0x011c] = 0x03; // scan start
  m.ram[0x02df + 0x03] = 0x00; // slot 3 free
  m.ram[0x29] = 0x07; // stored to $02df,y
  m.ram[0x2a] = 0x05; // != 0x0f
  m.ram[0x2b] = 0x33;
  m.ram[0x2c] = 0x11;
  m.ram[0x2d] = 0x22;
  m.ram[0x0108] = 0x40;
  m.ram[0x0145] = 0x00; // $0142 + (($2b & 7)=3)
}

test("loc_994d: free slot at y=3 -> full seed, count++ , A=0x10, x/y restored; 110 T", () => {
  const m = makeMachine();
  seedAlloc(m);

  loc_994d(m);

  assert.equal(m.ram[0x02df + 0x03], 0x07, "$02df,y = $29");
  assert.equal(m.ram[0x02b9 + 0x03], 0x05, "$02b9,y = $2a (ordinary)");
  assert.equal(m.ram[0x02cc + 0x03], 0x06, "$02cc,y = ($2a+1)&0x0f");
  assert.equal(m.ram[0x02a6 + 0x03], 0x00, "$02a6,y cleared");
  assert.equal(m.ram[0x028a + 0x03], 0x11, "$028a,y = $2c");
  assert.equal(m.ram[0x0291 + 0x03], 0x22, "$0291,y = $2d");
  assert.equal(m.ram[0x0283 + 0x03], 0x33, "$0283,y = $2b");
  assert.equal(m.ram[0x0108], 0x41, "active count $0108 incremented");
  assert.equal(m.ram[0x0145], 0x01, "$0142,($2b&7) lane counter bumped");
  assert.equal(m.regs.a, 0x10, "A = 0x10 (success)");
  assert.equal(m.regs.fNZ, true, "Z clear (0x10)");
  assert.equal(m.regs.x, 0x09, "x restored from $36");
  assert.equal(m.regs.y, 0x55, "y restored from $36");
  assert.equal(m.pc, 0x6001, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no subroutine calls");
  assert.equal(m.cycles, 110, "110 T");
});

test("loc_994d: $2a==0x0f + bit $0111 N-set -> $60ca & 0x0e path; 121 T", () => {
  const m = makeMachine();
  seedAlloc(m);
  m.ram[0x2a] = 0x0f; // triggers the special case
  m.ram[0x0111] = 0x80; // bit7 set -> BPL not taken
  m.ram[0x60ca] = 0x3f; // & 0x0e -> 0x0e

  loc_994d(m);

  assert.equal(m.ram[0x02b9 + 0x03], 0x0e, "$02b9,y = $60ca & 0x0e");
  assert.equal(m.ram[0x02cc + 0x03], 0x0f, "$02cc,y = (0x0e+1)&0x0f");
  assert.equal(m.regs.a, 0x10, "A = 0x10 (success)");
  assert.equal(m.cycles, 121, "121 T (main path + 11 for the special-case block)");
});

test("loc_994d: no free slot ($011c..0 all occupied) -> A=0, Z set, y restored; 53 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x6000);
  m.regs.x = 0x09;
  m.regs.y = 0x77; // saved to $36, restored at exit
  m.ram[0x011c] = 0x02;
  m.ram[0x02df + 0x00] = 0x01;
  m.ram[0x02df + 0x01] = 0x01;
  m.ram[0x02df + 0x02] = 0x01;

  loc_994d(m);

  assert.equal(m.regs.a, 0x00, "A = 0 (no slot)");
  assert.equal(m.regs.fZ, true, "Z set");
  assert.equal(m.regs.y, 0x77, "y restored from $36");
  assert.equal(m.pc, 0x6001, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 53, "53 T (3 loop iterations + exit)");
});

test("loc_994d MUTATION: a mischarged INC $0108 (5T not 6T) blows the 110 T total", () => {
  const m = makeMachine();
  seedAlloc(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x9989 ? 5 : c); // the INC $0108 step lands PC at 0x9989
  loc_994d(m);
  assert.notEqual(m.cycles, 110, "under-charging INC $0108 breaks the total");
});
