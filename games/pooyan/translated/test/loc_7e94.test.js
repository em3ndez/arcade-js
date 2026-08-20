// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_7e94 (ROM 0x7e94, Pooyan) -- the rst 0x28 write-anim dispatcher.
 * It pushes 0x7fd6 (the shared epilogue every exit path `ret`s into), gates on the 0x8e2a run-once
 * latch and 0x89fc, then reads selector 0x8e26 and rst 0x28 -> loc_0028 reads the inline table at
 * 0x7eac and jp (hl)'s to the state handler (0x7eb2/0x7f0e/0x7f5d). Each handler `ret`s into 0x7fd6.
 *
 * The mock's `call` POPS: loc_7fd6's `ret` pops the caller return, and m.call(0x0028) pops TWICE --
 * loc_0028's own `pop hl` consumes the rst table base (0x7eac), and the dispatched handler's `ret`
 * consumes the pushed epilogue (0x7fd6). So a call site that forgot a push16 desyncs the stack and
 * fails the SP-baseline tooth (every path must unwind to the pre-seat baseline).
 *
 * Paths: LATCH (0x8e2a!=0 -> ret nz -> epilogue), ARM (0x8e2a==0, 0x89fc==0 -> inc a, latch:=1, ret
 * -> epilogue), DISPATCH (0x8e2a==0, 0x89fc!=0 -> rst 0x28 -> loc_0028 then epilogue). TEETH:
 * mis-charge `ld a,(0x8e2a)` (13 T) as 7 T -> the LATCH golden (49 T) catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_7e94.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7e94 } from "../loc_7e94.js";

const CALLER_RET = 0xabcd;
const BASELINE_SP = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x7e94, pcSeq: [],
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
    // The dispatch chain and the epilogue each consume stack slots via `ret`/`pop`; model them so a
    // missing push16 at any call site desyncs SP. loc_0028 pops the rst table base AND the dispatched
    // handler's ret pops the pushed epilogue (two pops); loc_7fd6's ret pops the caller return (one).
    call(addr, site) {
      this.calls.push(addr);
      this.site = site;
      if (addr === 0x0028) { this.pop16(); this.pop16(); } else { this.pop16(); }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = BASELINE_SP;
  m.push16(CALLER_RET);
}

test("loc_7e94 LATCH: 0x8e2a set -> ret nz -> shared epilogue", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8e2a, 0x01); // run-once latch already set -> ret nz taken

  loc_7e94(m);

  assert.equal(m.tstates, 10 + 11 + 13 + 4 + 11, "T = ld hl + push + ld a + and a + ret nz(taken)");
  assert.deepEqual(m.pcSeq, [0x7e97, 0x7e98, 0x7e9b, 0x7e9c, 0x7fd6], "ret nz pops 0x7fd6");
  assert.equal(m.pc, 0x7fd6, "control transfers to the shared epilogue");
  assert.deepEqual(m.calls, [0x7fd6], "runs loc_7fd6 (the popped epilogue)");
  assert.equal(m.regs.sp, BASELINE_SP, "stack fully unwound (push16 matched by ret + epilogue ret)");
});

test("loc_7e94 ARM: 0x8e2a==0, 0x89fc==0 -> inc a, arm latch, ret -> epilogue", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8e2a, 0x00); // latch clear
  m.mem.write8(0x89fc, 0x00); // gate clear -> jr nz not taken -> arm path

  loc_7e94(m);

  assert.equal(m.tstates, 10 + 11 + 13 + 4 + 5 + 13 + 4 + 7 + 4 + 13 + 10, "ARM path T total");
  assert.deepEqual(
    m.pcSeq,
    [0x7e97, 0x7e98, 0x7e9b, 0x7e9c, 0x7e9d, 0x7ea0, 0x7ea1, 0x7ea3, 0x7ea4, 0x7ea7, 0x7fd6],
    "arm the latch, then ret pops 0x7fd6",
  );
  assert.equal(m.pc, 0x7fd6, "control transfers to the shared epilogue");
  assert.deepEqual(m.calls, [0x7fd6], "runs loc_7fd6");
  assert.equal(m.mem.read8(0x8e2a), 0x01, "latch armed to 1 (inc a from 0)");
  assert.equal(m.regs.a, 0x01, "A = 1 after inc a");
  assert.equal(m.regs.sp, BASELINE_SP, "stack fully unwound");
});

test("loc_7e94 DISPATCH: 0x8e2a==0, 0x89fc!=0 -> rst 0x28 -> loc_0028 then epilogue", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8e2a, 0x00); // latch clear
  m.mem.write8(0x89fc, 0x01); // gate set -> jr nz taken -> dispatch
  m.mem.write8(0x8e26, 0x02); // selector 2 (read into A before the rst)

  loc_7e94(m);

  assert.equal(m.tstates, 10 + 11 + 13 + 4 + 5 + 13 + 4 + 12 + 13 + 11, "DISPATCH path T total");
  assert.deepEqual(
    m.pcSeq,
    [0x7e97, 0x7e98, 0x7e9b, 0x7e9c, 0x7e9d, 0x7ea0, 0x7ea1, 0x7ea8, 0x7eab, 0x0028],
    "jr nz taken -> read selector -> rst 0x28 (last boundary is the rst target 0x0028)",
  );
  assert.equal(m.pc, 0x0028, "rst 0x28 transfers to loc_0028");
  assert.deepEqual(m.calls, [0x0028, 0x7fd6], "dispatch via loc_0028, then the shared epilogue loc_7fd6");
  assert.equal(m.regs.a, 0x02, "A = selector read from 0x8e26");
  assert.equal(m.regs.sp, BASELINE_SP, "stack fully unwound (table base + epilogue + caller ret popped)");
});

test("loc_7e94 MUTATION: `ld a,(0x8e2a)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x7e9b ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8e2a, 0x01);

  loc_7e94(m);

  assert.equal(m.tstates, 43, "mutation loses 6 T (13 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 49, "LATCH T total"),
    /49/,
    "the 49-T LATCH golden must fail on the mutant",
  );
});
