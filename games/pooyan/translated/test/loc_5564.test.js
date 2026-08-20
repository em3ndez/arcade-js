// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_5564 (ROM 0x5564, Pooyan) -- frame-timer gated spawner.
 * Decrements 0x8d06 and rets while running (ret nz). On expiry it reloads the timer from table 0x560f
 * (rst 0x20 -> loc_0020), advances phase 0x8d14, sets IX=0x8c60 / DE=0x18, chooses the spawn count B
 * from (0x8907) and (0x8820) thresholds, then TAIL-falls into loc_5594.
 *
 * The mock's `call` POPS the pushed return (models the callee `ret`); loc_0020 also does HL += A;
 * A = (HL). loc_5594 is a tail: it nets one `ret` to loc_5564's own caller, so the mock pops once and
 * sets pc -- a missing push16 before rst 0x20 then makes that tail pop miss CALLER_RET.
 *
 * Branch coverage: ret nz taken (TIMER); ret nz not taken (all EXPIRE paths); jr nc taken (0x8907>=4,
 * B=2); jr nc not taken; ret z taken (0x8820==0); ret z not taken; jr c taken (0x8820<4, B=1);
 * jr c not taken (0x8820>=4, B=2). MUTATION: `ld ix,nn` mis-charged 10T (not 14T).
 *
 * Run: node --test games/pooyan/translated/test/loc_5564.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5564 } from "../loc_5564.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5564, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) {
      this.calls.push(addr);
      if (addr === 0x5594) { this.pc = this.pop16(); return undefined; } // tail: loc_5594 rets to our caller
      this.pop16(); // normal callee `ret` consumes the pushed return
      if (addr === 0x0020) { regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      return undefined;
    },
  };
}

function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Common EXPIRE setup: timer 0x8d06 -> 1 (dec to 0), phase 0x8d14 -> 2 (rst 0x20 index), reload byte.
function seatExpire(m) {
  seat(m);
  m.mem.write8(0x8d06, 0x01);
  m.mem.write8(0x8d14, 0x02);
  m.mem.write8(0x5611, 0x30); // loc_0020: mem[0x560f + 2]
}

const EXPIRE_HEAD = [0x5567, 0x5568, 0x5569, 0x556c, 0x556f, 0x5571, 0x0020, 0x5575, 0x5578, 0x5579, 0x557d, 0x5580, 0x5583, 0x5585];

test("loc_5564 TIMER: 0x8d06 decrements nonzero -> ret nz, no work", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8d06, 0x05);

  loc_5564(m);

  assert.equal(m.tstates, 10 + 11 + 11, "ld hl + dec (hl) + ret nz");
  assert.deepEqual(m.pcSeq, [0x5567, 0x5568, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d06), 0x04, "timer decremented");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5564 EXPIRE + (0x8907)>=4 -> jr nc, B=2, tail into loc_5594", () => {
  const m = makeMachine();
  seatExpire(m);
  m.mem.write8(0x8907, 0x04); // >= 4 -> carry clear -> jr nc taken

  loc_5564(m);

  assert.equal(m.tstates, 164, "EXPIRE path to 0x5592 tail");
  assert.deepEqual(m.pcSeq, [...EXPIRE_HEAD, 0x5592, 0x5594]);
  assert.deepEqual(m.calls, [0x0020, 0x5594]);
  assert.equal(m.mem.read8(0x8d06), 0x30, "timer reloaded from rst 0x20");
  assert.equal(m.mem.read8(0x8d14), 0x03, "phase index advanced");
  assert.equal(m.regs.ix, 0x8c60);
  assert.equal(m.regs.de, 0x0018);
  assert.equal(m.regs.b, 0x02, "B=2");
  assert.equal(m.pc, CALLER_RET, "loc_5594 tail rets to our caller");
  assert.equal(m.regs.sp, 0x8780, "stack unwound (rst push16 balanced, tail pops caller ret)");
});

test("loc_5564 EXPIRE + (0x8907)<4 + (0x8820)==0 -> ret z", () => {
  const m = makeMachine();
  seatExpire(m);
  m.mem.write8(0x8907, 0x00); // < 4 -> jr nc not taken
  m.mem.write8(0x8820, 0x00); // == 0 -> ret z

  loc_5564(m);

  assert.equal(m.tstates, 180, "EXPIRE path to ret z");
  assert.deepEqual(m.pcSeq, [...EXPIRE_HEAD, 0x5587, 0x558a, 0x558b, CALLER_RET]);
  assert.deepEqual(m.calls, [0x0020]);
  assert.equal(m.pc, CALLER_RET, "ret z to the seated caller");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5564 EXPIRE + (0x8820)<4 -> jr c, B=1, tail into loc_5594", () => {
  const m = makeMachine();
  seatExpire(m);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x8820, 0x02); // nonzero, < 4 -> jr c taken, B=1

  loc_5564(m);

  assert.equal(m.tstates, 200, "EXPIRE path to jr c taken (0x5594)");
  assert.deepEqual(m.pcSeq, [...EXPIRE_HEAD, 0x5587, 0x558a, 0x558b, 0x558c, 0x558e, 0x5590, 0x5594]);
  assert.deepEqual(m.calls, [0x0020, 0x5594]);
  assert.equal(m.regs.b, 0x01, "B=1");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5564 EXPIRE + (0x8820)>=4 -> jr c not taken, B=2, tail into loc_5594", () => {
  const m = makeMachine();
  seatExpire(m);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x8820, 0x05); // >= 4 -> jr c not taken -> 0x5592, B=2

  loc_5564(m);

  assert.equal(m.tstates, 202, "EXPIRE path to 0x5592 fall-through");
  assert.deepEqual(m.pcSeq, [...EXPIRE_HEAD, 0x5587, 0x558a, 0x558b, 0x558c, 0x558e, 0x5590, 0x5592, 0x5594]);
  assert.deepEqual(m.calls, [0x0020, 0x5594]);
  assert.equal(m.regs.b, 0x02, "B=2");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5564 MUTATION: `ld ix,nn` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x557d ? 10 : cycles);
  seatExpire(m);
  m.mem.write8(0x8907, 0x04);

  loc_5564(m);

  assert.equal(m.tstates, 160, "mutation loses 4 T (14 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 164), /164/, "the 164-T golden must fail on the mutant");
});
