// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_cd0a (ROM 0xcd0a) -- per-slot timer/animation stepper (X=15..0). Minimal 6502
// harness (Regs + flat RAM + page-1 stack seam), author-derived. Run:
//   node --test games/tempest/translated/test/equivalence-cd0a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_cd0a } from "../loc_cd0a.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0,
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_cd0a: all slots inactive (mem[0xc0..0xcf]=0) -> every slot skips at cd0e, no writes, 230 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.ram[0x60ff] = 0xaa; // canary in the shadow region

  loc_cd0a(m);

  assert.equal(m.regs.x, 0xff, "X walked 15..0 then dex -> 0xff (bmi taken)");
  assert.equal(m.pc, 0x2001, "rts returns to pushed + 1");
  assert.equal(m.ram[0x60ff], 0xaa, "no shadow write on the all-skip path");
  assert.equal(m.cycles, 230, "2 + 15*14 + 12 + 6");
});

test("loc_cd0a: slot 15 dec-and-exit -- dec 0xe0,x nonzero -> bne cd8e, 243 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.ram[0xcf] = 0x05; // mem[0xc0,15] nonzero -> not beq
  m.ram[0xbf] = 0x00; // cpx 0xbf: 15 != 0 -> not beq
  m.ram[0xef] = 0x02; // dec 0xe0,15 -> 0x01 (nonzero) -> bne cd8e

  loc_cd0a(m);

  assert.equal(m.ram[0xef], 0x01, "dec 0xe0,x wrote 0x01");
  assert.equal(m.ram[0xcf], 0x05, "0xc0,x untouched on the dec-exit path");
  assert.equal(m.regs.x, 0xff, "X ends at 0xff");
  assert.equal(m.pc, 0x2001, "rts");
  assert.equal(m.cycles, 243, "2 + 27 (slot 15) + 14*14 + 12 + 6");
});

test("loc_cd0a: slot 15 full Block-B path (bcs not taken) -- table copy + high-half store, 327 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.ram[0xcf] = 0x02; // counter -> +2 = 0x04 -> asl -> Y=8
  m.ram[0xbf] = 0x00; // 15 != 0
  m.ram[0xef] = 0x01; // dec 0xe0,x -> 0 -> falls to cd18
  m.ram[0xff] = 0x01; // dec 0xf0,x -> 0 -> bne cd54 NOT taken -> Block B (cd1c)
  // table at 0xcbcb indexed by Y=8
  m.ram[0xcbcb + 8] = 0x11; // -> d0,x
  m.ram[0xcbce + 8] = 0x22; // -> f0,x
  m.ram[0xcbcc + 8] = 0x33; // -> e0,x (nonzero -> bne cd51)

  loc_cd0a(m);

  assert.equal(m.ram[0xcf], 0x04, "0xc0,x incremented twice (0x02 -> 0x04)");
  assert.equal(m.ram[0xdf], 0x11, "0xd0,x <- table[0xcbcb+8]");
  assert.equal(m.ram[0xff], 0x22, "0xf0,x <- table[0xcbce+8]");
  assert.equal(m.ram[0xef], 0x33, "0xe0,x <- table[0xcbcc+8]");
  assert.equal(m.ram[0x60d7], 0x11, "X>=8 -> sta 0x60c8,x (0x60c8+15=0x60d7) = 0xd0,x value");
  assert.equal(m.ram[0x60c7], 0x00, "low-half shadow 0x60c0,x NOT written for X>=8");
  assert.equal(m.regs.x, 0xff, "X ends at 0xff");
  assert.equal(m.pc, 0x2001, "rts");
  assert.equal(m.cycles, 327, "2 + 111 (slot 15) + 14*14 + 12 + 6");
});
