// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c9f1 (ROM 0xc9f1-0xca17). Minimal 6502 harness. Covers a 3-slot max scan that
// decrements the result ($05 positive -> #$14), and an all-zero scan ($05 negative -> #$10, skip dec). Run:
//   node --test games/tempest/translated/test/equivalence-c9f1.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c9f1 } from "../loc_c9f1.js";

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

test("loc_c9f1: max of $46..$48 (=0x30) decremented to 0x2f; $05 positive -> $00=0x14; 91 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000); // rts -> 0x1001
  m.ram[0x3e] = 0x02; // scan x = 2,1,0
  m.ram[0x46] = 0x10;
  m.ram[0x47] = 0x30; // the max
  m.ram[0x48] = 0x20;
  m.ram[0x05] = 0x00; // positive -> bit -> bpl taken -> keep #$14
  loc_c9f1(m);
  assert.equal(m.ram[0x0126], 0x2f, "max 0x30 then dec -> 0x2f");
  assert.equal(m.ram[0x00], 0x14, "$00 = 0x14 ($05 positive)");
  assert.equal(m.regs.x, 0xff, "X = 0xff (dex past 0)");
  assert.equal(m.regs.y, 0x30, "Y = pre-dec $0126");
  assert.equal(m.regs.a, 0x14, "A = 0x14");
  assert.equal(m.pc, 0x1001, "rts");
  assert.equal(m.cycles, 91, "3-slot scan T-state total");
});

test("loc_c9f1: all-zero scan -> $0126=0 (skip dec), $05 negative -> $00=0x10; 52 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.ram[0x3e] = 0x00; // single pass x=0
  m.ram[0x46] = 0x00; // max stays 0
  m.ram[0x05] = 0x80; // negative -> bpl not taken -> lda #$10
  loc_c9f1(m);
  assert.equal(m.ram[0x0126], 0x00, "$0126 = 0 (beq skips dec)");
  assert.equal(m.ram[0x00], 0x10, "$00 = 0x10 ($05 negative)");
  assert.equal(m.regs.x, 0xff, "X = 0xff");
  assert.equal(m.regs.y, 0x00, "Y = 0");
  assert.equal(m.regs.a, 0x10, "A = 0x10");
  assert.equal(m.pc, 0x2001, "rts");
  assert.equal(m.cycles, 52, "all-zero scan T-state total");
});
