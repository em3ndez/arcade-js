// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_092e (ROM 0x092e-0x0934): call 0x1611, force L=0xff, load A from (HL),
// ret. Expected values derived from dk.asm. The mock's call is record-only, so the internal
// `call 0x1611` leaves its pushed return (0x0931) on the stack and the routine's own ret pops THAT
// -- final PC lands on 0x0931 (a documented harness artifact, asserted directly).
//
// Run: node --test games/invaders/translated/test/loc_092e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_092e } from "../loc_092e.js";

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

test("loc_092e: calls 0x1611, L:=0xff, A:=(HL); 41 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write16(0x2400, 0x1234); // caller return (survives under the internal push)
  m.regs.h = 0x20;               // 0x1611 is record-only, so H is whatever we seat
  m.mem.write8(0x20ff, 0x7e);    // (HL) with L forced to 0xff

  loc_092e(m);

  assert.equal(m.regs.l, 0xff, "L := 0xff");
  assert.equal(m.regs.h, 0x20, "H unchanged (callee is record-only)");
  assert.equal(m.regs.a, 0x7e, "A := mem[0x20ff]");
  assert.equal(m.tstates, 17 + 7 + 7 + 10, "call(17)+mvi(7)+mov(7)+ret(10)");
  assert.deepEqual(m.calls, [0x1611], "one internal call");
  assert.equal(m.mem.read16(0x23fe), 0x0931, "call 0x1611 pushes return addr 0x0931");
  assert.equal(m.pc, 0x0931, "ARTIFACT: ret pops the internal call's return, not the caller's");
  assert.equal(m.regs.sp, 0x2400, "SP back above the internal push; caller return still at 0x2400");
  assert.deepEqual(m.pcSeq, [0x1611, 0x0933, 0x0934, 0x0931], "step boundaries");
});

test("loc_092e MUTATION: call 0x1611 mis-charged 11T not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x20ff, 0x7e);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1611 ? 11 : c);
  loc_092e(m);
  assert.equal(m.tstates, 11 + 7 + 7 + 10, "mutation loses 6 T (call 17 -> 11)");
  assert.notEqual(m.tstates, 41, "golden T-state total catches the mutant");
});
