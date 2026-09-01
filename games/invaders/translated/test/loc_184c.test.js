// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_184c (ROM 0x184c-0x1855): C=(0x206c), call loc_0a93, BC preserved across
// the call via push b/pop b, ret. The mock's `call` pops the pushed return (models the callee ret),
// so pop b recovers the exact BC the push saved and the stack ends fully balanced.
//
// Run: node --test games/invaders/translated/test/loc_184c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_184c } from "../loc_184c.js";

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
    regs, mem, ram, calls: [], pushed: [], tstates: 0, pc: 0x184c, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushed.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; }, // balanced: models callee ret
  };
}

test("loc_184c: C=(0x206c), call loc_0a93, BC preserved, ret; 66 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x1234;
  m.mem.write8(0x206c, 0x5a);

  loc_184c(m);

  assert.equal(m.regs.a, 0x5a, "A := (0x206c)");
  assert.equal(m.regs.bc, 0x1234, "BC restored by pop b across the call");
  assert.deepEqual(m.calls, [0x0a93], "calls loc_0a93");
  assert.ok(m.pushed.includes(0x1854), "call 0x0a93 pushes return addr 0x1854");
  assert.equal(m.tstates, 11 + 13 + 5 + 17 + 10 + 10, "T: push(11)+lda(13)+mov(5)+call(17)+pop(10)+ret(10)");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.equal(m.regs.sp, 0x2400, "stack fully balanced");
  assert.deepEqual(m.pcSeq, [0x184d, 0x1850, 0x1851, 0x0a93, 0x1855, CALLER_RET], "step boundaries");
});

test("loc_184c MUTATION: `call 0x0a93` mis-charged 11T (cond not-taken) not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x1234;
  m.mem.write8(0x206c, 0x5a);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0a93 ? 11 : c);
  loc_184c(m);
  assert.equal(m.tstates, 60, "mutation loses 6 T (17 -> 11)");
  assert.notEqual(m.tstates, 66, "golden T-state total catches the mutant");
});
