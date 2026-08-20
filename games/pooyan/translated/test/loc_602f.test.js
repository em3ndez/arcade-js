// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_602f (ROM 0x602f-0x6047, Pooyan) -- runs slot handler 0x6048 once
 * per slot for both slots. Seeds IY=0x8848, B=2, I=0, DE=4; the B-count loop (loop top 0x603b, INLINED)
 * exx-guards the main BC/DE/HL across `call 0x6048`, advances IY by 4, and latches I to the remaining
 * count before djnz. B is a constant 0x02, so the routine has exactly one control path: the loop runs
 * twice (djnz taken then not-taken), which this single case fully covers.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling 0x6048's `ret`), and CLOBBERS
 * the active alt BC/DE/HL to sentinels -- exactly what a real handler may trash. The two exx swaps must
 * restore the loop counter B and increment DE, so a missing/wrong exx would corrupt djnz and IY. A call
 * site missing its push16 desyncs the stack (the pop16 eats CALLER_RET) and the SP-baseline tooth fires.
 *
 * TEETH: SP fully unwinds to the pre-seat baseline (0x8780) via the final ret; T=181 golden;
 * a mutation mis-charging `add iy,de` (15 T) as 11 T is caught.
 *
 * Run: node --test games/pooyan/translated/test/loc_602f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_602f } from "../loc_602f.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x602f, pcSeq: [],
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
    // 0x6048's `ret` pops the return address the call site pushed -- model that pop so a missing push16
    // desyncs the stack. The handler runs on the exx'd alt registers, so trash them: only correct exx
    // swaps keep the loop counter B and increment DE intact.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      regs.b = 0xee; regs.c = 0xee;
      regs.d = 0xee; regs.e = 0xee;
      regs.h = 0xee; regs.l = 0xee;
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_SEQ = [
  0x6033, 0x6035, 0x6036, 0x6038, 0x603b,
  0x603c, 0x6048, 0x6040, 0x6042, 0x6043, 0x6045, 0x603b, // iter1: call visits 0x6048, djnz taken
  0x603c, 0x6048, 0x6040, 0x6042, 0x6043, 0x6045, 0x6047, // iter2: djnz not taken
  CALLER_RET,
];

test("loc_602f: two slots -- exx-guarded 0x6048 call x2, IY += 4 each, I latches count", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_602f(m);

  assert.equal(m.tstates, 181, "T-state total (setup 44 + iter1 66 + iter2 61 + ret 10)");
  assert.deepEqual(m.pcSeq, PC_SEQ, "step boundaries match the ROM bytes");
  assert.deepEqual(m.calls, [0x6048, 0x6048], "0x6048 invoked once per slot");
  assert.equal(m.pc, CALLER_RET, "ret returns to the seated caller");
  assert.equal(m.regs.iy, 0x8850, "IY advanced 0x8848 -> +4 -> +4");
  assert.equal(m.regs.b, 0x00, "loop counter reached 0 (exx protected it from the call's clobber)");
  assert.equal(m.regs.a, 0x01, "last ld a,b saw the restored counter B=1");
  assert.equal(m.regs.i, 0x01, "I latched the remaining count on the final pass");
  // Stack tooth: the final ret pops the seated CALLER_RET; every push16(0x603f) matched a callee ret,
  // so SP unwinds to the pre-seat baseline. A missing push16 would leave SP off by 2 (pop eats CALLER_RET).
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_602f MUTATION: `add iy,de` mis-charged 11T (not 15T) is caught by the 181-T golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6042 ? 11 : cycles);
  seatCaller(m);

  loc_602f(m);

  assert.equal(m.tstates, 173, "mutation loses 4 T per pass x2 (15 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 181, "T-state total"),
    /181/,
    "the 181-T golden must fail on the mutant",
  );
});
