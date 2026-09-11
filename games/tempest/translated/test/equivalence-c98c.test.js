// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c98c (ROM 0xc98c-0xc9ae). Minimal 6502 harness; JSRs opaque. Covers the
// bump+jsr-chain path (bcs & beq not taken) and the skip path (bcs taken, beq taken). Run:
//   node --test games/tempest/translated/test/equivalence-c98c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c98c } from "../loc_c98c.js";

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

test("loc_c98c: $46,x<0x62 bumps it & $9f, $0102,x!=0 -> jsr chain, jmp 9009; 56 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x3d] = 0x00;   // X=0
  m.ram[0x46] = 0x10;   // < 0x62 -> bcs not taken
  m.ram[0x9f] = 0x05;
  m.ram[0x0102] = 0x07; // != 0 -> beq not taken -> jsr chain
  loc_c98c(m);
  assert.equal(m.ram[0x46], 0x11, "$46,x incremented");
  assert.equal(m.ram[0x9f], 0x06, "$9f incremented");
  assert.equal(m.ram[0x00], 0x18, "$00 = 0x18");
  assert.equal(m.regs.x, 0xff, "X = 0xff (ldx #$ff)");
  assert.equal(m.regs.a, 0x07, "A = $0102,x");
  assert.equal(m.pc, 0x9009, "tail jmp $9009");
  assert.deepEqual(m.calls, [0x91b5, 0xca6c, 0xccb9, 0x9009], "full jsr chain then jmp");
  assert.equal(m.cycles, 56, "bump+chain T-state total");
});

test("loc_c98c: $46,x>=0x62 (no bump) & $0102,x==0 -> jmp 9009 only; 27 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x3d] = 0x00;   // X=0
  m.ram[0x46] = 0x70;   // >= 0x62 -> bcs taken (no bump)
  m.ram[0x9f] = 0x05;
  m.ram[0x0102] = 0x00; // == 0 -> beq taken -> skip chain
  loc_c98c(m);
  assert.equal(m.ram[0x46], 0x70, "$46,x unchanged");
  assert.equal(m.ram[0x9f], 0x05, "$9f unchanged");
  assert.equal(m.ram[0x00], 0x18, "$00 = 0x18");
  assert.equal(m.regs.x, 0x00, "X unchanged (no ldx #$ff)");
  assert.equal(m.regs.a, 0x00, "A = $0102,x = 0");
  assert.equal(m.pc, 0x9009, "tail jmp");
  assert.deepEqual(m.calls, [0x9009], "no jsr chain");
  assert.equal(m.cycles, 27, "skip-path T-state total");
});
