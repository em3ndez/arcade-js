// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_d8ca (ROM 0xd8ca) -- the S-as-counter POKEY/EAROM write loop. The two inner
// loops spin on bit $0c00 (a 3kHz sync line); the harness toggles $0c00 bit7 on each read so every inner
// pass consumes exactly two reads with no spin (each iteration reads an even count, keeping phase).
// Run: node --test games/tempest/translated/test/equivalence-d8ca.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_d8ca } from "../loc_d8ca.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  let tick = 0;
  const mem = {
    read8: (a) => {
      a &= 0xffff;
      if (a === 0x0c00) return (tick++ & 1) ? 0x80 : 0x00; // even read: bit7=0 (pass bmi); odd: bit7=1 (pass bpl)
      return ram[a];
    },
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    call(target) { this.calls.push(target); }, // record the tail jmp target; do not execute it
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_d8ca: A=0x00 -> low nibble 0 (inx), S=1, two outer passes, tail-jmp loc_da0a", () => {
  const m = makeMachine();
  m.regs.a = 0x00;

  loc_d8ca(m);

  assert.equal(m.mem.read8(0x79), 0x00, "sty 0x79 = input Y (=A)");
  // pass1 takes bne @d8e0 (S=1 -> lda #0xc0); pass2 falls through (S=0 -> lda #0x60). Last writer wins.
  assert.equal(m.mem.read8(0x60c0), 0x60, "final 0x60c0 from pass2 (S==0 path, #0x60)");
  assert.equal(m.mem.read8(0x60c1), 0x00, "final 0x60c1 = stx (X drained to 0) in pass2");
  assert.equal(m.mem.read8(0x60e0), 0x00, "final 0x60e0 = sta #0 (d90f) in pass2");

  assert.equal(m.regs.y, 0x00, "Y drained to 0 by inner loop B");
  assert.equal(m.regs.x, 0xff, "tsx(0)->dex = 0xff on the exit pass");
  assert.equal(m.regs.s, 0xff, "txs stored 0xff");
  assert.equal(m.regs.a, 0x00, "A = 0 (lda #0 @d90d, used through inner B)");

  assert.equal(m.pc, 0xda0a, "tail jmp target");
  assert.deepEqual(m.calls, [0xda0a], "jmp 0xda0a delegated once");
  assert.ok(m.cycles > 50000, "hardware-sync loops accrue a large cycle total");
});

test("loc_d8ca: A=0x01 -> low nibble 1 (bne @d8d6 taken, no inx), S=0, single outer pass", () => {
  const m = makeMachine();
  m.regs.a = 0x01;

  loc_d8ca(m);

  assert.equal(m.mem.read8(0x79), 0x01, "sty 0x79 = 1");
  assert.equal(m.mem.read8(0x60c0), 0x60, "S==0 -> #0x60 path");
  assert.equal(m.mem.read8(0x60c1), 0x00, "stx drained X = 0");
  assert.equal(m.regs.x, 0xff, "exit-pass X");
  assert.equal(m.regs.s, 0xff, "exit-pass S");
  assert.equal(m.pc, 0xda0a, "tail jmp target");
  assert.deepEqual(m.calls, [0xda0a], "single outer pass then jmp 0xda0a");
  assert.ok(m.cycles > 50000, "large cycle total");
});
