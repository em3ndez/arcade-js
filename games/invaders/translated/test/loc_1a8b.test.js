// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1a8b (ROM 0x1a8b-0x1a92): seat HL=0x2501, mask A to its low nibble, then
// tail-jump (delegate) to loc_09c5. No stack traffic -- pin HL, the masked A, the delegate, and T.
//
// Run: node --test games/invaders/translated/test/loc_1a8b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1a8b } from "../loc_1a8b.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1a8b, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

const GOLDEN_T = 10 + 7 + 10; // lxi h + ani + jmp

test("loc_1a8b: seats HL=0x2501, masks A low nibble, delegates to loc_09c5; 27 T", () => {
  const m = makeMachine();
  m.regs.a = 0xf5; // high nibble must be dropped by ani 0x0f

  loc_1a8b(m);

  assert.equal(m.regs.hl, 0x2501, "HL := 0x2501");
  assert.equal(m.regs.a, 0x05, "A := A & 0x0f");
  assert.deepEqual(m.calls, [0x09c5], "tail-jump delegates to loc_09c5");
  assert.equal(m.tstates, GOLDEN_T, "golden T: lxi(10)+ani(7)+jmp(10)");
  assert.equal(m.pc, 0x09c5, "final step lands at the delegate target");
  assert.deepEqual(m.pcSeq, [0x1a8e, 0x1a90, 0x09c5], "step boundaries");
});

test("loc_1a8b MUTATION: ani mis-charged 8T not 7T is caught", () => {
  const m = makeMachine();
  m.regs.a = 0xf5;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a90 ? 8 : c); // ani -> step 0x1a90, real 7T
  loc_1a8b(m);
  assert.equal(m.tstates, GOLDEN_T + 1, "mis-charge shifts the total by 1");
  assert.notEqual(m.tstates, GOLDEN_T, "golden T-state total catches the mutant");
});
