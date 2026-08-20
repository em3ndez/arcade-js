// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5f76 (ROM 0x5f76, Pooyan) -- the B-count driver loop around
 * loc_5f83. Each pass: exx, call loc_5f83, exx, add iy,de, ld a,b, ld i,a, djnz back; ret on B==0.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_5f83's `ret`); it does
 * not model loc_5f83's register effect (loc_5f76 runs it inside the exx pair, so the MAIN de/b it needs
 * afterward are the un-swapped ones). A missing push16 at 0x5f77 then desyncs the stack: the mock pops
 * the seated CALLER_RET on the first pass and the final `ret` misses it -- the balance tooth below.
 *
 * The exx pair is load-bearing: add iy,de must add the MAIN de, not the alternate de'. The setup seats
 * de'=0x00ff so a broken pair would land iy on a different value than the golden 0x8848+n*0x0010.
 *
 * Run: node --test games/pooyan/translated/test/loc_5f76.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5f76 } from "../loc_5f76.js";

const CALLER_RET = 0xabcd;
const BASELINE = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5f76, pcSeq: [],
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
    // loc_5f83's `ret` pops the return address loc_5f76 pushed at 0x5f77 -- model that pop so the stack
    // balances (a missing push16 there then desyncs SP and the final ret fails).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = BASELINE;
  m.push16(CALLER_RET);
}

function seatRegs(m, b) {
  m.regs.b = b;          // MAIN loop counter
  m.regs.de = 0x0010;    // MAIN de -- the increment add iy,de must use
  m.regs.d_ = 0x00;      // alternate de' = 0x00ff -- would give a wrong iy if the exx pair broke
  m.regs.e_ = 0xff;
  m.regs.iy = 0x8848;
}

test("loc_5f76 B=1: single pass -> ret; add uses MAIN de, i latches b", () => {
  const m = makeMachine();
  seatCaller(m);
  seatRegs(m, 1);

  loc_5f76(m);

  assert.equal(m.tstates, 71, "B=1 T total");
  assert.deepEqual(m.pcSeq, [
    0x5f77, 0x5f83, 0x5f7b, 0x5f7d, 0x5f7e, 0x5f80, 0x5f82, CALLER_RET,
  ], "call visits 0x5f83; djnz falls out at B==0; ret to caller");
  assert.equal(m.pc, CALLER_RET, "ret returns to the seated caller");
  assert.deepEqual(m.calls, [0x5f83], "one loc_5f83 call");
  assert.equal(m.regs.iy, 0x8858, "iy += MAIN de (0x8848 + 0x0010) -- exx pair restored de");
  assert.equal(m.regs.a, 0x01, "ld a,b latched b=1");
  assert.equal(m.regs.i, 0x01, "ld i,a latched into I");
  assert.equal(m.regs.b, 0x00, "djnz drained b");
  assert.equal(m.regs.sp, BASELINE, "stack fully unwound (every push16 matched loc_5f83's ret)");
});

test("loc_5f76 B=2: two passes prove the djnz-taken edge and the loop", () => {
  const m = makeMachine();
  seatCaller(m);
  seatRegs(m, 2);

  loc_5f76(m);

  assert.equal(m.tstates, 137, "B=2 T total (one taken djnz + one not-taken + ret)");
  assert.deepEqual(m.pcSeq, [
    0x5f77, 0x5f83, 0x5f7b, 0x5f7d, 0x5f7e, 0x5f80, 0x5f76, // pass 1: djnz taken, back to entry
    0x5f77, 0x5f83, 0x5f7b, 0x5f7d, 0x5f7e, 0x5f80, 0x5f82, CALLER_RET, // pass 2: djnz falls out
  ], "two passes; second falls out of djnz");
  assert.deepEqual(m.calls, [0x5f83, 0x5f83], "two loc_5f83 calls");
  assert.equal(m.regs.iy, 0x8868, "iy += 2*0x0010");
  assert.equal(m.regs.a, 0x01, "final ld a,b saw b=1");
  assert.equal(m.regs.b, 0x00, "djnz drained b");
  assert.equal(m.regs.sp, BASELINE, "stack balanced across both passes");
});

test("loc_5f76 MUTATION: `add iy,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5f7d ? 11 : cycles);
  seatCaller(m);
  seatRegs(m, 1);

  loc_5f76(m);

  assert.equal(m.tstates, 67, "mutation loses 4 T (15 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 71, "B=1 T total"),
    /71/,
    "the 71-T golden must fail on the mutant",
  );
});
