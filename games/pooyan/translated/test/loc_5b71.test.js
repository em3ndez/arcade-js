// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5b71 (ROM 0x5b71, Pooyan) -- an actor fire gate. Three guards
 * (mode 5 at ix+2; fire-flag bit2 of ix+7; timer ix+6 < 0x11) must all pass before it delegates the
 * launch to loc_3a6c; any failing guard returns.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_3a6c's `ret`) -- 5b71
 * reads nothing back from loc_3a6c, so the only thing the mock must model is that pop, which is exactly
 * what gives the stack-balance assertion teeth: drop the push16 and the final ret pops garbage.
 *
 * Run: node --test games/pooyan/translated/test/loc_5b71.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5b71 } from "../loc_5b71.js";

const CALLER_RET = 0xabcd;
const IX = 0x9000;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5b71, pcSeq: [],
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
    // loc_3a6c's `ret` pops the return address 5b71 pushed at the call site -- model that pop so the
    // stack stays balanced (a missing push16 then desyncs SP and the final ret pops garbage).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_5b71 LAUNCH: mode 5 + fire flag + timer<0x11 -> call 0x3a6c then ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x02) & 0xffff, 0x05); // mode 5
  m.mem.write8((IX + 0x07) & 0xffff, 0x04); // bit2 set
  m.mem.write8((IX + 0x06) & 0xffff, 0x08); // timer < 0x11

  loc_5b71(m);

  assert.equal(m.tstates, 114, "LAUNCH T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5b74, 0x5b76, 0x5b77, 0x5b7b, 0x5b7c, 0x5b7f, 0x5b81, 0x5b82, 0x3a6c, CALLER_RET,
  ], "step boundaries visit the call target then ret to caller");
  assert.equal(m.pc, CALLER_RET, "final ret lands on the seated caller");
  assert.deepEqual(m.calls, [0x3a6c], "delegated the launch");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (push16 matched loc_3a6c's ret)");
});

test("loc_5b71 ret nz: mode != 5 -> immediate return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x02) & 0xffff, 0x03); // not mode 5

  loc_5b71(m);

  assert.equal(m.tstates, 19 + 7 + 11, "ld + cp + ret nz");
  assert.deepEqual(m.pcSeq, [0x5b74, 0x5b76, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
});

test("loc_5b71 ret z: fire flag clear -> return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x02) & 0xffff, 0x05);
  m.mem.write8((IX + 0x07) & 0xffff, 0x00); // bit2 clear

  loc_5b71(m);

  assert.equal(m.tstates, 19 + 7 + 5 + 20 + 11, "through bit test then ret z");
  assert.deepEqual(m.pcSeq, [0x5b74, 0x5b76, 0x5b77, 0x5b7b, CALLER_RET]);
  assert.deepEqual(m.calls, []);
});

test("loc_5b71 ret nc: timer >= 0x11 -> return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x02) & 0xffff, 0x05);
  m.mem.write8((IX + 0x07) & 0xffff, 0x04);
  m.mem.write8((IX + 0x06) & 0xffff, 0x11); // timer at threshold -> cp 0x11 clears carry -> ret nc

  loc_5b71(m);

  assert.equal(m.tstates, 19 + 7 + 5 + 20 + 5 + 19 + 7 + 11, "through timer check then ret nc");
  assert.deepEqual(m.pcSeq, [0x5b74, 0x5b76, 0x5b77, 0x5b7b, 0x5b7c, 0x5b7f, 0x5b81, CALLER_RET]);
  assert.deepEqual(m.calls, []);
});

test("loc_5b71 MUTATION: bit 2,(ix+7) mis-charged 8T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5b7b ? 8 : cycles);
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x02) & 0xffff, 0x05);
  m.mem.write8((IX + 0x07) & 0xffff, 0x04);
  m.mem.write8((IX + 0x06) & 0xffff, 0x08);

  loc_5b71(m);

  assert.equal(m.tstates, 102, "mutation loses 12 T (20 -> 8)");
  assert.throws(
    () => assert.equal(m.tstates, 114, "LAUNCH T-state total"),
    /114/,
    "the 114-T golden must fail on the mutant",
  );
});
