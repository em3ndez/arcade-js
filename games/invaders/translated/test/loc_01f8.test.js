// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_01f8 (ROM 0x01f8-0x0208): the shared body fed by loc_01ef/
// loc_01f5. Runs a 4-pass loop -- each pass pushes DE, sets B=0x2c, calls loc_1a32, restores DE,
// decrements C; rets when C hits 0. The mock's `call` POPS the return address the call site pushed
// (models the callee's ret) so push d/pop d stay balanced across the call -- if a push16 were
// dropped, DE would come back as the stray 0x0203 and the balance assertion fails.
// Run: node --test games/invaders/translated/test/loc_01f8.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_01f8 } from "../loc_01f8.js";

const CALLER_RET = 0xabcd;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x01f8, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // model the callee's ret popping the pushed return addr -> stack stays balanced
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

const PC_SEQ = [
  0x01fa, 0x01fd, // mvi c / lxi d
  0x01fe, 0x0200, 0x1a32, 0x0204, 0x0205, 0x01fd, // pass 1 (jnz taken)
  0x01fe, 0x0200, 0x1a32, 0x0204, 0x0205, 0x01fd, // pass 2
  0x01fe, 0x0200, 0x1a32, 0x0204, 0x0205, 0x01fd, // pass 3
  0x01fe, 0x0200, 0x1a32, 0x0204, 0x0205, 0x0208, // pass 4 (jnz not taken)
  CALLER_RET, // ret
];

test("loc_01f8: 4-pass loop over loc_1a32, rets to caller; 267 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_01f8(m);

  assert.equal(m.tstates, 7 + 10 + 4 * 60 + 10, "T: setup(17)+4*loop(60)+ret(10)");
  assert.deepEqual(m.calls, [0x1a32, 0x1a32, 0x1a32, 0x1a32], "loc_1a32 four times");
  assert.equal(m.regs.c, 0x00, "C decremented to 0");
  assert.equal(m.regs.b, 0x2c, "B := 0x2c (last mvi)");
  assert.equal(m.regs.de, 0x1d20, "DE restored by pop d each pass (push/pop balanced across call)");
  assert.equal(m.regs.sp, 0x2400, "stack fully unwound (every push16 matched a callee ret)");
  assert.equal(m.pc, CALLER_RET, "ret returns to the seated caller");
  assert.deepEqual(m.pcSeq, PC_SEQ, "step boundaries");
});

test("loc_01f8 MUTATION: `mvi c` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01fa ? 4 : c);
  loc_01f8(m);
  assert.equal(m.tstates, 264, "mutation loses 3 T (7 -> 4)");
  assert.notEqual(m.tstates, 267, "golden T-state total catches the mutant");
});
