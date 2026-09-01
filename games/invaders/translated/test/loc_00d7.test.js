// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_00d7 (ROM 0x00d7-0x00e1): seed 0x21fb/0x22fb with 0x02, then
// tail-jump into 0x08e4 (delegated, record-only). Pins the two writes, A, T-states, and delegate.
//
// Run: node --test games/invaders/translated/test/loc_00d7.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_00d7 } from "../loc_00d7.js";

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

test("loc_00d7: writes 0x02 to 0x21fb/0x22fb, delegates to 0x08e4; 43 T", () => {
  const m = makeMachine();

  loc_00d7(m);

  assert.equal(m.mem.read8(0x21fb), 0x02, "0x21fb := 0x02");
  assert.equal(m.mem.read8(0x22fb), 0x02, "0x22fb := 0x02");
  assert.equal(m.regs.a, 0x02, "A := 0x02");
  assert.equal(m.tstates, 7 + 13 + 13 + 10, "mvi(7)+sta(13)+sta(13)+jmp(10)");
  assert.deepEqual(m.calls, [0x08e4], "tail-jump delegates to loc_08e4");
  assert.equal(m.pc, 0x08e4, "last step lands at the delegate");
});

test("loc_00d7 MUTATION: sta 0x22fb mis-charged 7T not 13T is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x00df ? 7 : c); // 0x00df is the addr AFTER sta 0x22fb
  loc_00d7(m);
  assert.notEqual(m.tstates, 43, "golden T-state total catches the mis-charged sta");
});
