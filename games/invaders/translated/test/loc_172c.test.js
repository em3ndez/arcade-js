// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_172c (ROM 0x172c-0x173d): branches on mem[0x2025]. Zero -> B=0xfd,
// tail-jump to 0x19dc; non-zero -> B=0x02, tail-jump to 0x18fa. Both arms delegate (jmp), so
// no push16 and the mock records the delegate target.
//
// Run: node --test games/invaders/translated/test/loc_172c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_172c } from "../loc_172c.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_172c: mem[0x2025]!=0 -> B=0x02, delegate to 0x18fa; 47 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.ram[0x2025] = 0x01;

  loc_172c(m);

  assert.equal(m.regs.b, 0x02, "non-zero arm seeds B=0x02");
  assert.equal(m.regs.a, 0x01, "A holds the loaded mode byte");
  assert.equal(m.tstates, 13 + 7 + 10 + 7 + 10, "lda+cpi+jnz(taken)+mvi+jmp");
  assert.deepEqual(m.calls, [0x18fa], "delegates to loc_18fa");
  assert.equal(m.pc, 0x18fa, "last step lands at the delegate");
});

test("loc_172c: mem[0x2025]==0 -> B=0xfd, delegate to 0x19dc; 47 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.ram[0x2025] = 0x00;

  loc_172c(m);

  assert.equal(m.regs.b, 0xfd, "zero arm seeds B=0xfd");
  assert.equal(m.regs.a, 0x00, "A holds the loaded mode byte");
  assert.equal(m.tstates, 13 + 7 + 10 + 7 + 10, "lda+cpi+jnz(not-taken)+mvi+jmp");
  assert.deepEqual(m.calls, [0x19dc], "delegates to loc_19dc");
  assert.equal(m.pc, 0x19dc, "last step lands at the delegate");
});

test("loc_172c MUTATION: lda 0x2025 mis-charged 7T not 13T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.ram[0x2025] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x172f ? 7 : c);
  loc_172c(m);
  assert.notEqual(m.tstates, 47, "golden T-state total catches the mis-charged lda");
});
