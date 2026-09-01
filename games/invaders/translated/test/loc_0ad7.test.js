// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0ad7 (ROM 0x0ad7-0x0ae1): stores A into the delay counter 0x20c0
// then spins at loc_0ada until it reaches zero, then RETs. The real counter is decremented by
// the interrupt; here a countdown read8 (2 -> 1 -> 0) drives three loop passes so the loop
// back-edge and the exit arm are both exercised. Pins the store, loop count, T-states, RET.
//
// Run: node --test games/invaders/translated/test/loc_0ad7.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0ad7 } from "../loc_0ad7.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    // reads of 0x20c0 post-decrement it (the interrupt-driven countdown), else plain RAM.
    read8: (a) => {
      a &= 0xffff;
      if (a === 0x20c0) { const v = ram[a]; if (v > 0) ram[a] = v - 1; return v; }
      return ram[a];
    },
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

test("loc_0ad7: stores A, spins 0x20c0 down to 0 (3 passes), rets; 104 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780; m.push16(CALLER_RET);
  m.regs.a = 0x02; // seeds the counter to 2 -> 1 -> 0

  loc_0ad7(m);

  assert.equal(m.tstates, 13 + 3 * (13 + 4 + 10) + 10, "T: sta(13)+3*(lda13+ana4+jnz10)+ret(10)");
  assert.equal(m.ram[0x20c0], 0x00, "counter drained to 0");
  assert.equal(m.regs.a, 0x00, "A holds the final read (0)");
  assert.deepEqual(m.calls, [], "makes no calls (pure spin + ret)");
  assert.equal(m.pc, CALLER_RET, "RET returns to the caller");
  assert.deepEqual(
    m.pcSeq,
    [0x0ada, 0x0add, 0x0ade, 0x0ada, 0x0add, 0x0ade, 0x0ada, 0x0add, 0x0ade, 0x0ae1, CALLER_RET],
    "store, three loop passes (back-edge to 0x0ada), fall to ret, return",
  );
});

test("loc_0ad7 MUTATION: RET mis-charged 5T (cond not-taken) not 10T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780; m.push16(CALLER_RET);
  m.regs.a = 0x02;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === CALLER_RET ? 5 : c);
  loc_0ad7(m);
  assert.notEqual(m.tstates, 104, "golden T-state total catches the mutant");
});
