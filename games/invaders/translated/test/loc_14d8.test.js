// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_14d8 (ROM 0x14d8-0x1537): state-0x02 prize handler. Data-dependent, so
// each test seats 0x2025/0x2029/... to run a specific arm:
//   - state != 0x02/0x05 -> rnz early return
//   - state == 0x05 -> rz early return
//   - state == 0x02 with 0x2029 >= 0xd8 -> jnc into loc_1530 (force state 3, tail into loc_154a)
//
// Run: node --test games/invaders/translated/test/loc_14d8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_14d8 } from "../loc_14d8.js";

const CALLER_RET = 0xbeef;

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_14d8 arm: state 0x02, 0x2029 >= 0xd8 -> loc_1530 forces state 3, tails loc_154a; 102 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2025, 0x02); // active state
  m.mem.write8(0x2029, 0xe0); // >= 0xd8 -> jnc taken at 0x14e7

  loc_14d8(m);

  assert.equal(m.regs.b, 0xe0, "B := candidate byte (mov b,a)");
  assert.equal(m.regs.a, 0x03, "loc_1530 loaded A=0x03");
  assert.equal(m.mem.read8(0x2025), 0x03, "state 0x2025 forced to 0x03");
  assert.deepEqual(m.calls, [0x154a], "tail-jumps into loc_154a");
  assert.equal(m.pc, 0x154a, "last step lands at loc_154a");
  assert.equal(m.tstates, 72 + 30, "pre-branch 72 T + loc_1530 arm 30 T");
  assert.deepEqual(
    m.pcSeq,
    [0x14db, 0x14dd, 0x14de, 0x14e0, 0x14e1, 0x14e4, 0x14e6, 0x14e7, 0x1530, 0x1532, 0x1535, 0x154a],
    "step boundaries through the loc_1530 arm",
  );
});

test("loc_14d8 arm: state 0x05 -> rz early return; 31 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2025, 0x05);

  loc_14d8(m);

  assert.equal(m.regs.a, 0x05, "A holds the read state");
  assert.equal(m.tstates, 13 + 7 + 11, "lda + cpi + rz(taken)");
  assert.deepEqual(m.calls, [], "no delegations on the early return");
  assert.equal(m.pc, CALLER_RET, "rz returns to caller");
});

test("loc_14d8 arm: state 0x07 (not 0x05/0x02) -> rnz early return; 43 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2025, 0x07);

  loc_14d8(m);

  assert.equal(m.tstates, 13 + 7 + 5 + 7 + 11, "lda+cpi05+rz(nt)+cpi02+rnz(taken)");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.pc, CALLER_RET, "rnz returns to caller");
});

test("loc_14d8 MUTATION: jnc-into-1530 mis-charged 11T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2025, 0x02);
  m.mem.write8(0x2029, 0xe0);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1530 ? 11 : c); // jnc 0x1530 is 10T on 8080
  loc_14d8(m);
  assert.notEqual(m.tstates, 102, "golden T-state total catches the mutant");
});
