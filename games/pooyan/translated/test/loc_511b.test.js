// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_511b (ROM 0x511b, Pooyan) -- the (0x8907) bit0-gated per-frame
 * update dispatcher. bit0 set -> run 0x54c5/0x5519/0x5564 then branch on (0x8f61); bit0 clear ->
 * run 0x53b0 then join the shared tail at loc_5135 (call 0x5146, then (0x8d6d) gate + 0x56e8).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * call site that forgot its push16 desyncs the stack and the final `ret` misses CALLER_RET. All callees
 * here are boundaries (untranslated) -- the mock models only the pop; every register the routine needs
 * after a call is reloaded from memory, so no register effect is modelled.
 *
 * Run: node --test games/pooyan/translated/test/loc_511b.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_511b } from "../loc_511b.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x511b, pcSeq: [],
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
    // A boundary callee's `ret` pops the return address the call site pushed -- model just that pop so
    // the stack stays balanced (a missing push16 then desyncs SP and the final ret misses CALLER_RET).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_511b Path A: bit0 set, (0x8f61)!=0 -> updaters + tail 0x1171", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01); // bit0 set -> jr z at 0x5120 not taken
  m.mem.write8(0x8f61, 0x05); // non-zero -> jr z at 0x512f not taken -> 0x1171

  loc_511b(m);

  assert.equal(m.tstates, 130, "Path A T-state total");
  assert.deepEqual(m.pcSeq, [
    0x511e, 0x5120, 0x5122, 0x54c5, 0x5519, 0x5564, 0x512e, 0x512f, 0x5131, 0x1171, CALLER_RET,
  ], "Path A step boundaries");
  assert.deepEqual(m.calls, [0x54c5, 0x5519, 0x5564, 0x1171], "three updaters + tail 0x1171");
  assert.equal(m.pc, CALLER_RET, "ret at 0x5134 to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
});

test("loc_511b Path B: bit0 clear -> 0x53b0 then tail, (0x8d6d)!=0 -> ret nz at 0x513c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x00); // bit0 clear -> jr z at 0x5120 taken -> 0x5141
  m.mem.write8(0x8d6d, 0x01); // non-zero -> ret nz at 0x513c

  loc_511b(m);

  assert.equal(m.tstates, 107, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x511e, 0x5120, 0x5141, 0x53b0, 0x5135, 0x5146, 0x513b, 0x513c, CALLER_RET,
  ], "Path B step boundaries");
  assert.deepEqual(m.calls, [0x53b0, 0x5146], "0x53b0 then shared 0x5146");
  assert.equal(m.pc, CALLER_RET, "ret nz at 0x513c to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_511b Path C: bit0 set, (0x8f61)==0, (0x8d6d)==0 -> tail 0x56e8 + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01); // bit0 set
  m.mem.write8(0x8f61, 0x00); // zero -> jr z at 0x512f taken -> shared tail 0x5135
  m.mem.write8(0x8d6d, 0x00); // zero -> ret nz at 0x513c not taken -> 0x56e8

  loc_511b(m);

  assert.equal(m.tstates, 174, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [
    0x511e, 0x5120, 0x5122, 0x54c5, 0x5519, 0x5564, 0x512e, 0x512f,
    0x5135, 0x5146, 0x513b, 0x513c, 0x513d, 0x56e8, CALLER_RET,
  ], "Path C step boundaries");
  assert.deepEqual(m.calls, [0x54c5, 0x5519, 0x5564, 0x5146, 0x56e8], "updaters + 0x5146 + 0x56e8");
  assert.equal(m.pc, CALLER_RET, "ret at 0x5140 to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_511b MUTATION: `bit 0,a` mis-charged 4T (not 8T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5120 ? 4 : cycles);
  seatCaller(m);
  m.mem.write8(0x8907, 0x01);
  m.mem.write8(0x8f61, 0x05);

  loc_511b(m);

  assert.equal(m.tstates, 126, "mutation loses 4 T (8 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 130, "Path A T-state total"),
    /130/,
    "the 130-T golden must fail on the mutant",
  );
});
