// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1a7f (ROM 0x1a7f-0x1a8a): call loc_092e, guard on A (rz), then save A across
// loc_19e6 via push/pop psw and store A-1 at (HL), falling through into loc_1a8b. The mock's `call`
// pops the pushed return (models the callee ret), so pop psw recovers the exact A push psw saved --
// with a record-only call it would instead pop loc_19e6's stray return and A would come back wrong.
//
// Run: node --test games/invaders/translated/test/loc_1a7f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1a7f } from "../loc_1a7f.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1a7f, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; }, // pops the pushed return
  };
}

// call(17)+ana(4)+rz-nt(5)+push psw(11)+dcr(5)+mov m,a(7)+call(17)+pop psw(10)
const GOLDEN_T = 17 + 4 + 5 + 11 + 5 + 7 + 17 + 10;

test("loc_1a7f: A!=0 arm -- stores A-1 at (HL), restores A across loc_19e6, delegates to loc_1a8b", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x05; // loc_092e's result (record-only call leaves it seated); != 0 -> rz not taken
  m.regs.hl = 0x2500;

  loc_1a7f(m);

  assert.equal(m.mem.read8(0x2500), 0x04, "(HL) := A-1 = 0x04 (mov m,a after dcr a)");
  assert.equal(m.regs.a, 0x05, "A restored by pop psw (proves call popped loc_19e6's return)");
  assert.deepEqual(m.calls, [0x092e, 0x19e6, 0x1a8b], "092e, 19e6, then delegate to loc_1a8b");
  assert.equal(m.tstates, GOLDEN_T, "golden T total for the A!=0 fall-through path");
  assert.deepEqual(m.pcSeq, [0x092e, 0x1a83, 0x1a84, 0x1a85, 0x1a86, 0x1a87, 0x19e6, 0x1a8b], "step boundaries");
});

test("loc_1a7f: A==0 arm -- rz bails before the psw save, only loc_092e called", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x00; // loc_092e returned 0 -> ana a sets Z -> rz taken

  loc_1a7f(m);

  assert.deepEqual(m.calls, [0x092e], "rz rets before the second call/delegate");
  assert.equal(m.tstates, 17 + 4 + 11, "call + ana + rz(taken)");
  assert.equal(m.pc, CALLER_RET, "rz pops the caller return");
});

test("loc_1a7f MUTATION: pop psw mis-charged 11T not 10T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x05;
  m.regs.hl = 0x2500;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a8b ? c + 1 : c); // pop psw -> step 0x1a8b, real 10T
  loc_1a7f(m);
  assert.equal(m.tstates, GOLDEN_T + 1, "mis-charge shifts the total by 1");
  assert.notEqual(m.tstates, GOLDEN_T, "golden T-state total catches the mutant");
});
