// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5e78 (ROM 0x5e78, Pooyan) -- the gated actor-sweep driver.
 * Runs only when (0x8907) bit0 is set; then sweeps the 0x8848 table B=2 times (stride DE=4),
 * calling loc_5e98 per pass with the I register as a phase latch (0 then 1). The exx pair parks
 * B and DE in the shadow set across the call.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_5e98's `ret`), then
 * clobbers main B and DE the way loc_5e98 does -- so the exx protection has teeth (a dropped exx would
 * let the clobbered B corrupt the djnz counter) AND a missing push16 desyncs the stack (the final ret
 * pops the wrong word, so pc/SP miss their baseline).
 *
 * Path RUN (gate open): prologue + 2 loop passes + ret. Full pcSeq + T=212, iy=0x8850, two loc_5e98
 * calls, I=1. Path GATE ((0x8907) bit0 clear): `ret z` fires immediately, T=31, no calls.
 * TEETH: mis-charge `ld iy,0x8848` (14 T) as 10 T -> the 212-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5e78.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5e78 } from "../loc_5e78.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5e78, pcSeq: [],
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
    // loc_5e98's `ret` pops the return address the call site pushed -- model that pop so the stack
    // stays balanced (a missing push16 then desyncs SP). loc_5e98 also clobbers B/DE; the exx pair in
    // loc_5e78 is what protects the loop counter and stride from that clobber, so model it here.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x5e98) { regs.b = 0x04; regs.de = 0xdead; }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_RUN = [
  0x5e7b, 0x5e7d, 0x5e7e, 0x5e82, 0x5e84, 0x5e87, 0x5e88, 0x5e8a, // prologue (gate open)
  0x5e8b, 0x5e98, 0x5e8f, 0x5e91, 0x5e93, 0x5e95, 0x5e8a,         // pass 1 (call -> target, djnz taken)
  0x5e8b, 0x5e98, 0x5e8f, 0x5e91, 0x5e93, 0x5e95, 0x5e97,         // pass 2 (djnz falls out)
  CALLER_RET,
];

test("loc_5e78 Path RUN: gate open -> 2 sweep passes, exx protects B/DE", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x03); // bit0 set -> gate open (and 0x01 -> nonzero)

  loc_5e78(m);

  assert.equal(m.tstates, 212, "Path RUN T-state total");
  assert.deepEqual(m.pcSeq, PC_RUN, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret at 0x5e97 to the seated caller");
  assert.deepEqual(m.calls, [0x5e98, 0x5e98], "two loc_5e98 passes");
  assert.equal(m.regs.iy, 0x8850, "IY advanced 0x8848 + 2*4 (DE preserved across each call by exx)");
  assert.equal(m.regs.b, 0x00, "loop counter fully drained (djnz, protected from loc_5e98's b=4)");
  assert.equal(m.regs.i, 0x01, "I latch = 1 after the passes");
  // Every call pushed 0x5e8e and loc_5e98's ret popped it; the final ret pops the seated CALLER_RET,
  // so the stack fully unwinds. A call site missing its push16 leaves SP off by 2 -- the stack tooth.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to the pre-seat baseline");
});

test("loc_5e78 Path GATE: (0x8907) bit0 clear -> ret z immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x02); // bit0 clear -> and 0x01 == 0 -> ret z

  loc_5e78(m);

  assert.equal(m.tstates, 13 + 7 + 11, "T = ld a,(nn) + and n + ret z taken");
  assert.deepEqual(m.pcSeq, [0x5e7b, 0x5e7d, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.deepEqual(m.calls, [], "no sweep done");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_5e78 MUTATION: `ld iy,0x8848` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5e82 ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x8907, 0x01);

  loc_5e78(m);

  assert.equal(m.tstates, 208, "mutation loses 4 T (14 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 212, "Path RUN T-state total"),
    /212/,
    "the 212-T golden must fail on the mutant",
  );
});
